import React, { useState } from 'react';
import Modal from '@/components/elements/Modal';
import { Form, Formik, FormikHelpers } from 'formik';
import Field from '@/components/elements/Field';
import { object, string } from 'yup';
import FlashMessageRender from '@/components/FlashMessageRender';
import { ServerContext } from '@/state/server';
import deleteServerDatabase from '@/api/server/databases/deleteServerDatabase';
import { httpErrorToHuman } from '@/api/http';
import RotatePasswordButton from '@/components/server/databases/RotatePasswordButton';
import Can from '@/components/elements/Can';
import { ServerDatabase } from '@/api/server/databases/getServerDatabases';
import useFlash from '@/plugins/useFlash';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import Label from '@/components/elements/Label';
import Input from '@/components/elements/Input';
import CopyOnClick from '@/components/elements/CopyOnClick';
import { TrashIcon } from '@heroicons/react/outline';
import { useTranslation } from 'react-i18next';
import { ItemCell, ItemRow } from '@/components/elements/ItemList';

interface Props {
    database: ServerDatabase;
    className?: string;
}

export default ({ database, className }: Props) => {
    const { t } = useTranslation('arix/server/databases');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { addError, clearFlashes } = useFlash();
    const [visible, setVisible] = useState(false);
    const [connectionVisible, setConnectionVisible] = useState(false);

    const appendDatabase = ServerContext.useStoreActions((actions) => actions.databases.appendDatabase);
    const removeDatabase = ServerContext.useStoreActions((actions) => actions.databases.removeDatabase);

    const jdbcConnectionString = `jdbc:mysql://${database.username}${
        database.password ? `:${encodeURIComponent(database.password)}` : ''
    }@${database.connectionString}/${database.name}`;

    const schema = object().shape({
        confirm: string()
            .required('The database name must be provided.')
            .oneOf([database.name.split('_', 2)[1], database.name], 'The database name must be provided.'),
    });

    const submit = (values: { confirm: string }, { setSubmitting }: FormikHelpers<{ confirm: string }>) => {
        clearFlashes();
        deleteServerDatabase(uuid, database.id)
            .then(() => {
                setVisible(false);
                setTimeout(() => removeDatabase(database.id), 150);
            })
            .catch((error) => {
                console.error(error);
                setSubmitting(false);
                addError({ key: 'database:delete', message: httpErrorToHuman(error) });
            });
    };

    return (
        <>
            <Formik onSubmit={submit} initialValues={{ confirm: '' }} validationSchema={schema} isInitialValid={false}>
                {({ isSubmitting, isValid, resetForm }) => (
                    <Modal
                        visible={visible}
                        dismissable={!isSubmitting}
                        showSpinnerOverlay={isSubmitting}
                        onDismissed={() => {
                            setVisible(false);
                            resetForm();
                        }}
                    >
                        <FlashMessageRender byKey={'database:delete'} css={tw`mb-6`} />
                        <h2 css={tw`text-2xl mb-6`}>{t('confirm-deletion')}</h2>
                        <p css={tw`text-sm`}>
                            {t('delete-description-1')} <strong>{database.name}</strong> {t('delete-description-2')}
                        </p>
                        <Form css={tw`m-0 mt-6`}>
                            <Field
                                type={'text'}
                                id={'confirm_name'}
                                name={'confirm'}
                                label={t('confirm-database-name')}
                                description={t('confirm-database-description')}
                            />
                            <div css={tw`mt-6 text-right`}>
                                <Button
                                    type={'button'}
                                    variant={Button.Variants.Secondary}
                                    css={tw`mr-2`}
                                    onClick={() => setVisible(false)}
                                >
                                    {t('cancel')}
                                </Button>
                                <Button.Danger type={'submit'} disabled={!isValid}>
                                    {t('delete-database')}
                                </Button.Danger>
                            </div>
                        </Form>
                    </Modal>
                )}
            </Formik>
            <Modal visible={connectionVisible} onDismissed={() => setConnectionVisible(false)}>
                <FlashMessageRender byKey={'database-connection-modal'} css={tw`mb-6`} />
                <h3 css={tw`mb-6 text-2xl`}>{t('database-connection-details')}</h3>
                <div>
                    <Label>{t('endpoint')}</Label>
                    <CopyOnClick text={database.connectionString}>
                        <Input type={'text'} readOnly value={database.connectionString} />
                    </CopyOnClick>
                </div>
                <div css={tw`mt-6`}>
                    <Label>{t('connection-from')}</Label>
                    <Input type={'text'} readOnly value={database.allowConnectionsFrom} />
                </div>
                <div css={tw`mt-6`}>
                    <Label>{t('username')}</Label>
                    <CopyOnClick text={database.username}>
                        <Input type={'text'} readOnly value={database.username} />
                    </CopyOnClick>
                </div>
                <Can action={'database.view_password'}>
                    <div css={tw`mt-6`}>
                        <Label>{t('password')}</Label>
                        <CopyOnClick text={database.password} showInNotification={false}>
                            <Input type={'text'} readOnly value={database.password} />
                        </CopyOnClick>
                    </div>
                </Can>
                <div css={tw`mt-6`}>
                    <Label>{t('connection-string')}</Label>
                    <CopyOnClick text={jdbcConnectionString} showInNotification={false}>
                        <Input type={'text'} readOnly value={jdbcConnectionString} />
                    </CopyOnClick>
                </div>
                <div css={tw`mt-6 text-right`}>
                    <Can action={'database.update'}>
                        <RotatePasswordButton databaseId={database.id} onUpdate={appendDatabase} />
                    </Can>
                    <Button variant={Button.Variants.Secondary} onClick={() => setConnectionVisible(false)}>
                        {t('close')}
                    </Button>
                </div>
            </Modal>

            <ItemRow>
                <ItemCell>{database.name}</ItemCell>
                <ItemCell>
                    <CopyOnClick text={database.username}>
                        <p>{database.username}</p>
                    </CopyOnClick>
                </ItemCell>
                <ItemCell>
                    <CopyOnClick text={database.connectionString}>
                        <p className='privacy:blur-sm hover:privacy:blur-none duration-300'>
                            {database.connectionString}
                        </p>
                    </CopyOnClick>
                </ItemCell>
                <ItemCell className={'w-1'}>
                    <div className={'flex justify-end items-center gap-x-2'}>
                        <Button.Text onClick={() => setConnectionVisible(true)}>{t('database-details')}</Button.Text>
                        <Can action={'database.delete'}>
                            <Button.Danger onClick={() => setVisible(true)}>
                                <TrashIcon className={'w-5'} />
                            </Button.Danger>
                        </Can>
                    </div>
                </ItemCell>
            </ItemRow>
        </>
    );
};
