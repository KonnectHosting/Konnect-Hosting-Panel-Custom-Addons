import React, { useContext, useEffect, useRef, useState } from 'react';
import { Subuser } from '@/state/server/subusers';
import { Form, Formik, Field as FormikField } from 'formik';
import { array, object, string } from 'yup';
import Field from '@/components/elements/Field';
import Input from '@/components/elements/Input';
import { Actions, useStoreActions, useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import createOrUpdateSubuser from '@/api/server/users/createOrUpdateSubuser';
import { ServerContext } from '@/state/server';
import FlashMessageRender from '@/components/FlashMessageRender';
import Can from '@/components/elements/Can';
import { usePermissions } from '@/plugins/usePermissions';
import { useDeepCompareMemo } from '@/plugins/useDeepCompareMemo';
import tw from 'twin.macro';
import { Button, styles } from '@/components/elements/button/index';
import PermissionTitleBox from '@/components/server/users/PermissionTitleBox';
import asDialog from '@/hoc/asDialog';
import PermissionRow from '@/components/server/users/PermissionRow';
import { Dialog, DialogWrapperContext } from '@/components/elements/dialog';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';
import { SubuserPreset, getPresets } from '@/api/server/users/subuserPreset';
import Select from '@/components/elements/Select';

type Props = {
    subuser?: Subuser;
};

interface Values {
    email: string;
    permissions: string[];
    expiresAt: string;
}

const EditSubuserModal = ({ subuser }: Props) => {
    const { t } = useTranslation('arix/server/users');
    const ref = useRef<HTMLHeadingElement>(null);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const appendSubuser = ServerContext.useStoreActions((actions) => actions.subusers.appendSubuser);
    const { clearFlashes, clearAndAddHttpError } = useStoreActions(
        (actions: Actions<ApplicationStore>) => actions.flashes
    );
    const { close } = useContext(DialogWrapperContext);

    const isRootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const permissions = useStoreState((state) => state.permissions.data);
    const [permissionSearch, setPermissionSearch] = useState('');
    // The currently logged in user's permissions. We're going to filter out any permissions
    // that they should not need.
    const loggedInPermissions = ServerContext.useStoreState((state) => state.server.permissions);
    const [canEditUser] = usePermissions(subuser ? ['user.update'] : ['user.create']);
    const [presets, setPresets] = useState<SubuserPreset[]>([]);

    useEffect(() => {
        getPresets(uuid)
            .then(setPresets)
            .catch(() => undefined);
    }, []);

    // The permissions that can be modified by this user.
    const editablePermissions = useDeepCompareMemo(() => {
        const cleaned = Object.keys(permissions).map((key) =>
            Object.keys(permissions[key].keys).map((pkey) => `${key}.${pkey}`)
        );

        const list: string[] = ([] as string[]).concat.apply([], Object.values(cleaned));

        if (isRootAdmin || (loggedInPermissions.length === 1 && loggedInPermissions[0] === '*')) {
            return list;
        }

        return list.filter((key) => loggedInPermissions.indexOf(key) >= 0);
    }, [isRootAdmin, permissions, loggedInPermissions]);

    const filteredPermissionGroups = useDeepCompareMemo(() => {
        const query = permissionSearch.trim().toLowerCase();

        return Object.keys(permissions)
            .filter((key) => key !== 'websocket')
            .map((key) => {
                const permissionKeys = Object.keys(permissions[key].keys);

                if (!query) {
                    return {
                        key,
                        permissionKeys,
                    };
                }

                const groupMatches =
                    key.toLowerCase().includes(query) ||
                    String(permissions[key].description || '')
                        .toLowerCase()
                        .includes(query);

                const matchedPermissionKeys = permissionKeys.filter((pkey) => {
                    const fullKey = `${key}.${pkey}`;
                    const permissionLabel = String(permissions[key].keys[pkey] || '');

                    return fullKey.toLowerCase().includes(query) || permissionLabel.toLowerCase().includes(query);
                });

                if (groupMatches) {
                    return {
                        key,
                        permissionKeys,
                    };
                }

                return {
                    key,
                    permissionKeys: matchedPermissionKeys,
                };
            })
            .filter((group) => group.permissionKeys.length > 0);
    }, [permissions, permissionSearch]);

    const submit = (values: Values) => {
        clearFlashes('user:edit');

        createOrUpdateSubuser(uuid, values, subuser)
            .then((subuser) => {
                appendSubuser(subuser);
                close();
            })
            .catch((error) => {
                console.error(error);
                clearAndAddHttpError({ key: 'user:edit', error });

                if (ref.current) {
                    ref.current.scrollIntoView();
                }
            });
    };

    useEffect(
        () => () => {
            clearFlashes('user:edit');
        },
        []
    );

    return (
        <Formik
            onSubmit={submit}
            initialValues={
                {
                    email: subuser?.email || '',
                    permissions: subuser?.permissions || [],
                    expiresAt: subuser?.expiresAt ? subuser.expiresAt.toISOString().split('T')[0] : '',
                } as Values
            }
            validationSchema={object().shape({
                email: string().max(191, t('must-not-exceed')).email(t('valid-email')).required(t('valid-email')),
                permissions: array().of(string()),
                expiresAt: string(),
            })}
        >
            {({ submitForm, setFieldValue }) => (
                <Form>
                    <p ref={ref}>
                        {subuser
                            ? `${canEditUser ? t('modify-permissions-for') : t('view-permissions-for')} ${
                                  subuser.email
                              }`
                            : t('create-new-subuser')}
                    </p>
                    <FlashMessageRender byKey={'user:edit'} css={tw`mt-4`} />
                    {!isRootAdmin && loggedInPermissions[0] !== '*' && (
                        <div className={'mt-4 pl-3 py-2 border-l-4 border-yellow-500 bg-yellow-500/20 rounded-[4px]'}>
                            <p css={tw`text-sm !text-yellow-100`}>{t('only-permissions-you-assigned')}</p>
                        </div>
                    )}
                    {!subuser && (
                        <div css={tw`mt-4`}>
                            <Field name={'email'} label={t('user-email')} description={t('user-email-description')} />
                        </div>
                    )}
                    <div css={tw`mt-4`}>
                        <Field
                            name={'expiresAt'}
                            label={'Expiration Date (Optional)'}
                            type={'date'}
                            description={'The date this subuser will be automatically removed.'}
                        />
                    </div>
                    <div className='mt-4 mb-6 flex gap-4'>
                        <div className='flex-1'>
                            <Input
                                type={'text'}
                                name={'permissionSearch'}
                                placeholder={'Search permissions...'}
                                value={permissionSearch}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    setPermissionSearch(e.currentTarget.value)
                                }
                            />
                        </div>
                        {presets.length > 0 && canEditUser && (
                            <Select
                                defaultValue={''}
                                onChange={(e) => {
                                    const preset = presets.find((p) => String(p.id) === e.target.value);
                                    if (preset) setFieldValue('permissions', preset.permissions);
                                }}
                                className={'!w-1/3'}
                            >
                                <option value={''} disabled>
                                    Select a preset...
                                </option>
                                {presets.map((preset) => (
                                    <option key={preset.id} value={preset.id}>
                                        {preset.name}
                                    </option>
                                ))}
                            </Select>
                        )}
                        {canEditUser && (
                            <FormikField name='permissions'>
                                {({ form }: any) => {
                                    const value: string[] = form.values.permissions || [];
                                    const allSelected =
                                        editablePermissions.length > 0 &&
                                        editablePermissions.every((p) => value.includes(p));

                                    return (
                                        <label className={classNames(styles.button, styles.text, '!flex items-center')}>
                                            <Input
                                                type={'checkbox'}
                                                checked={allSelected}
                                                disabled={editablePermissions.length === 0}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                    if (e.currentTarget.checked) {
                                                        form.setFieldValue(
                                                            'permissions',
                                                            Array.from(new Set([...value, ...editablePermissions]))
                                                        );
                                                    } else {
                                                        form.setFieldValue(
                                                            'permissions',
                                                            value.filter((p) => !editablePermissions.includes(p))
                                                        );
                                                    }
                                                }}
                                            />
                                            <span css={tw`ml-2`}>{t('select-all-permissions')}</span>
                                        </label>
                                    );
                                }}
                            </FormikField>
                        )}
                    </div>
                    <div css={tw`grid lg:grid-cols-2 gap-4`}>
                        {filteredPermissionGroups.map(({ key, permissionKeys }) => (
                            <PermissionTitleBox
                                key={`permission_${key}`}
                                title={key}
                                isEditable={canEditUser}
                                permissions={permissionKeys.map((pkey) => `${key}.${pkey}`)}
                            >
                                <p css={tw`text-sm text-gray-300 mb-4`}>{permissions[key].description}</p>
                                {permissionKeys.map((pkey) => (
                                    <PermissionRow
                                        key={`permission_${key}.${pkey}`}
                                        permission={`${key}.${pkey}`}
                                        disabled={!canEditUser || editablePermissions.indexOf(`${key}.${pkey}`) < 0}
                                    />
                                ))}
                            </PermissionTitleBox>
                        ))}
                        {filteredPermissionGroups.length === 0 && (
                            <p css={tw`text-sm text-gray-400`}>No permissions matched your search.</p>
                        )}
                    </div>
                    <Dialog.Footer>
                        <Can action={subuser ? 'user.update' : 'user.create'}>
                            <Button.Text onClick={close}>Cancel</Button.Text>
                            <Button type={'submit'} onClick={submitForm}>
                                {subuser ? t('save') : t('invite-user')}
                            </Button>
                        </Can>
                    </Dialog.Footer>
                </Form>
            )}
        </Formik>
    );
};

export default asDialog({
    title: 'Subuser',
    extraWidth: true,
})(EditSubuserModal);
