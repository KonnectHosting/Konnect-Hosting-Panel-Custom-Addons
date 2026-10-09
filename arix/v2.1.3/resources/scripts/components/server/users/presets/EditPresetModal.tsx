import React, { useContext } from 'react';
import { Form, Formik } from 'formik';
import { object, string, array } from 'yup';
import { ServerContext } from '@/state/server';
import { useStoreState } from 'easy-peasy';
import { useDeepCompareMemo } from '@/plugins/useDeepCompareMemo';
import { Button } from '@/components/elements/button/index';
import PermissionTitleBox from '@/components/server/users/PermissionTitleBox';
import PermissionRow from '@/components/server/users/PermissionRow';
import Field from '@/components/elements/Field';
import tw from 'twin.macro';
import asDialog from '@/hoc/asDialog';
import { Dialog, DialogWrapperContext } from '@/components/elements/dialog';
import { SubuserPreset, createPreset, updatePreset } from '@/api/server/users/subuserPreset';
import useFlash from '@/plugins/useFlash';

type Props = {
    preset?: SubuserPreset;
    onSaved: () => void;
};

const EditPresetModal = ({ preset, onSaved }: Props) => {
    const { close } = useContext(DialogWrapperContext);
    const { clearFlashes, addFlash } = useFlash();
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const permissions = useStoreState((state) => state.permissions.data);

    const permissionGroups = useDeepCompareMemo(() => {
        return Object.keys(permissions)
            .filter((key) => key !== 'websocket')
            .map((key) => ({
                key,
                permissionKeys: Object.keys(permissions[key].keys),
            }));
    }, [permissions]);

    const submit = (values: { name: string; permissions: string[] }) => {
        clearFlashes();

        const action = preset
            ? updatePreset(uuid, preset.id, values.name, values.permissions)
                  .then(() => {
                      addFlash({
                          key: 'server:users:preset',
                          type: 'success',
                          title: 'Success',
                          message: `${values.name} updated.`,
                      });
                  })
                  .catch(() => {
                      addFlash({
                          key: 'server:users:preset',
                          type: 'error',
                          title: 'Error',
                          message: 'Failed to update preset.',
                      });
                  })
            : createPreset(uuid, values.name, values.permissions)
                  .then(() => {
                      addFlash({
                          key: 'server:users:preset',
                          type: 'success',
                          title: 'Success',
                          message: `${values.name} created.`,
                      });
                  })
                  .catch(() => {
                      addFlash({
                          key: 'server:users:preset',
                          type: 'error',
                          title: 'Error',
                          message: 'Failed to create preset.',
                      });
                  });

        action.then(() => {
            onSaved();
            close();
        });
    };

    return (
        <Formik
            onSubmit={submit}
            initialValues={{
                name: preset?.name || '',
                permissions: preset?.permissions || [],
            }}
            validationSchema={object().shape({
                name: string().required('Name is required'),
                permissions: array().of(string()),
            })}
        >
            {({ submitForm }) => (
                <Form>
                    <Field name={'name'} label={'Preset Name'} />
                    <div css={tw`mt-4 grid lg:grid-cols-2 gap-4`}>
                        {permissionGroups.map(({ key, permissionKeys }) => (
                            <PermissionTitleBox
                                key={`permission_${key}`}
                                title={key}
                                isEditable={true}
                                permissions={permissionKeys.map((pkey) => `${key}.${pkey}`)}
                            >
                                <p css={tw`text-sm text-gray-300 mb-4`}>{permissions[key].description}</p>
                                {permissionKeys.map((pkey) => (
                                    <PermissionRow
                                        key={`permission_${key}.${pkey}`}
                                        permission={`${key}.${pkey}`}
                                        disabled={false}
                                    />
                                ))}
                            </PermissionTitleBox>
                        ))}
                    </div>
                    <Dialog.Footer>
                        <Button.Text onClick={close}>Cancel</Button.Text>
                        <Button type={'submit'} onClick={submitForm}>
                            {preset ? 'Save Preset' : 'Create Preset'}
                        </Button>
                    </Dialog.Footer>
                </Form>
            )}
        </Formik>
    );
};

export default asDialog({ title: 'Edit Preset', extraWidth: true })(EditPresetModal);
