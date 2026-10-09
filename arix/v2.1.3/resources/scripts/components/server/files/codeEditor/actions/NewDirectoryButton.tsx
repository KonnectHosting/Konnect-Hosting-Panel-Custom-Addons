import React, { useContext, useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import { Form, Formik, FormikHelpers } from 'formik';
import Field from '@/components/elements/Field';
import { join } from 'pathe';
import { object, string } from 'yup';
import createDirectory from '@/api/server/files/createDirectory';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import { useFlashKey } from '@/plugins/useFlash';
import { WithClassname } from '@/components/types';
import FlashMessageRender from '@/components/FlashMessageRender';
import { Dialog, DialogWrapperContext } from '@/components/elements/dialog';
import { LuFolderPlus } from 'react-icons/lu';
import Code from '@/components/elements/Code';
import asDialog from '@/hoc/asDialog';
import { useTranslation } from 'react-i18next';
import { DropdownButtonRow } from '@/components/elements/DropdownMenu';

interface Values {
    directoryName: string;
}

const schema = object().shape({
    directoryName: string().required('A valid directory name must be provided.'),
});

const NewDirectoryDialog = asDialog({
    title: 'Create Directory',
})(({ onRefresh }: { onRefresh?: () => void }) => {
    const { t } = useTranslation('arix/server/files');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const directory = ServerContext.useStoreState((state) => state.files.directory);

    const { close } = useContext(DialogWrapperContext);
    const { clearAndAddHttpError } = useFlashKey('files:directory-modal');

    useEffect(() => {
        return () => {
            clearAndAddHttpError();
        };
    }, []);

    const submit = ({ directoryName }: Values, { setSubmitting }: FormikHelpers<Values>) => {
        createDirectory(uuid, directory, directoryName)
            .then(() => onRefresh?.())
            .then(() => close())
            .catch((error) => {
                setSubmitting(false);
                clearAndAddHttpError(error);
            });
    };

    return (
        <Formik onSubmit={submit} validationSchema={schema} initialValues={{ directoryName: '' }}>
            {({ submitForm, values }) => (
                <>
                    <FlashMessageRender key={'files:directory-modal'} />
                    <Form css={tw`m-0`}>
                        <Field autoFocus id={'directoryName'} name={'directoryName'} label={'Name'} />
                        <p css={tw`mt-2 text-sm md:text-base break-all`}>
                            <span css={tw`text-neutral-200`}>{t('directory-will-be-as')}&nbsp;</span>
                            <Code>
                                /{t('home')}/{t('container')}/
                                <span css={tw`text-cyan-200`}>
                                    {join(directory, values.directoryName).replace(/^(\.\.\/|\/)+/, '')}
                                </span>
                            </Code>
                        </p>
                    </Form>
                    <Dialog.Footer>
                        <Button.Text className={'w-full sm:w-auto'} onClick={close}>
                            {t('cancel')}
                        </Button.Text>
                        <Button className={'w-full sm:w-auto'} onClick={submitForm}>
                            {t('create')}
                        </Button>
                    </Dialog.Footer>
                </>
            )}
        </Formik>
    );
});

export default ({ className, onRefresh }: WithClassname & { onRefresh?: () => void }) => {
    const { t } = useTranslation('arix/server/files');
    const [open, setOpen] = useState(false);

    return (
        <>
            <NewDirectoryDialog open={open} onClose={setOpen.bind(this, false)} onRefresh={onRefresh} />
            <DropdownButtonRow className={`flex items-center gap-2 ${className}`} onClick={setOpen.bind(this, true)}>
                <LuFolderPlus /> {t('create-directory')}
            </DropdownButtonRow>
        </>
    );
};
