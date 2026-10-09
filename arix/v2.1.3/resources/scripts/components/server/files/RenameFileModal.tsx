import React from 'react';
import Modal, { RequiredModalProps } from '@/components/elements/Modal';
import { Form, Formik, FormikHelpers } from 'formik';
import Field from '@/components/elements/Field';
import renameFiles from '@/api/server/files/renameFiles';
import { ServerContext } from '@/state/server';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import useFlash from '@/plugins/useFlash';
import { useTranslation } from 'react-i18next';

interface FormikValues {
    name: string;
}

type OwnProps = RequiredModalProps & { files: string[]; onRefresh?: () => void };

const RenameFileModal = ({ files, onRefresh, ...props }: OwnProps) => {
    const { t } = useTranslation('arix/server/files');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { mutate } = useFileManagerSwr();
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const setSelectedFiles = ServerContext.useStoreActions((actions) => actions.files.setSelectedFiles);

    const submit = ({ name }: FormikValues, { setSubmitting }: FormikHelpers<FormikValues>) => {
        clearFlashes('files');

        // Ensure we only rename (strip any path components so this cannot be used to move files).
        const sanitized = name.split('/').pop() || name;

        // Optimistically update single-file entry to the new name.
        if (files.length === 1) {
            mutate((data) => data.map((f) => (f.name === files[0] ? { ...f, name: sanitized } : f)), false);
        }

        const data = files.map((f) => ({ from: f, to: sanitized }));

        renameFiles(uuid, directory, data)
            .then((): Promise<any> => (files.length > 0 ? mutate() : Promise.resolve()))
            .then(() => setSelectedFiles([]))
            .catch((error) => {
                mutate();
                setSubmitting(false);
                clearAndAddHttpError({ key: 'files', error });
            })
            .then(() => {
                props.onDismissed();
                onRefresh?.();
            });
    };

    return (
        <Formik onSubmit={submit} initialValues={{ name: files.length > 1 ? '' : files[0] || '' }}>
            {({ isSubmitting }) => (
                <Modal {...props} dismissable={!isSubmitting} showSpinnerOverlay={isSubmitting}>
                    <Form css={tw`m-0`}>
                        <div css={[tw`flex flex-wrap`, tw`items-end`]}>
                            <div css={tw`w-full sm:flex-1 sm:mr-4`}>
                                <Field type={'string'} id={'file_name'} name={'name'} label={'File Name'} autoFocus />
                            </div>
                            <div css={tw`w-full sm:w-auto mt-4 sm:mt-0`}>
                                <Button css={tw`w-full`}>{t('rename')}</Button>
                            </div>
                        </div>
                    </Form>
                </Modal>
            )}
        </Formik>
    );
};

export default RenameFileModal;
