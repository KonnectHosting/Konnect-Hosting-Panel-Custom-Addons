import React, { useContext, useEffect, useState } from 'react';
import saveFileContents from '@/api/server/files/saveFileContents';
import { ServerContext } from '@/state/server';
import { object, string } from 'yup';
import asDialog from '@/hoc/asDialog';
import { DialogWrapperContext } from '@/components/elements/dialog';
import { useFlashKey } from '@/plugins/useFlash';
import { Form, Formik, FormikHelpers } from 'formik';
import FlashMessageRender from '@/components/FlashMessageRender';
import tw from 'twin.macro';
import Code from '@/components/elements/Code';
import { join } from 'pathe';
import { Dialog } from '@/components/elements/dialog/index';
import { Button } from '@/components/elements/button/index';
import { DropdownButtonRow } from '@/components/elements/DropdownMenu';
import { LuFilePlus } from 'react-icons/lu';
import Field from '@/components/elements/Field';
import { useTranslation } from 'react-i18next';

interface CreateFileProps {
    onRefresh?: () => void;
}

interface Values {
    filename: string;
}

const schema = object().shape({
    filename: string().required('A valid filename must be provided.'),
});

const CreateFileDialog = asDialog({
    title: 'Create File',
})(({ onRefresh }: CreateFileProps) => {
    const { t } = useTranslation('arix/server/files');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const directory = ServerContext.useStoreState((state) => state.files.directory);

    const { close } = useContext(DialogWrapperContext);
    const { clearAndAddHttpError } = useFlashKey('files:file-modal');

    useEffect(() => {
        return () => {
            clearAndAddHttpError();
        };
    }, []);

    const submit = ({ filename }: Values, { setSubmitting }: FormikHelpers<Values>) => {
        saveFileContents(uuid, join(directory, filename), '')
            .then(() => onRefresh?.())
            .then(() => close())
            .catch((error) => {
                setSubmitting(false);
                clearAndAddHttpError(error);
            });
    };

    return (
        <Formik onSubmit={submit} validationSchema={schema} initialValues={{ filename: '' }}>
            {({ submitForm, values }) => (
                <>
                    <FlashMessageRender key={'files:file-modal'} />
                    <Form css={tw`m-0`}>
                        <Field autoFocus id={'filename'} name={'filename'} label={t('file-name')} />
                        <p css={tw`mt-2 text-sm md:text-base break-all`}>
                            <span css={tw`text-neutral-200`}>{t('code-editor.file-be-created')}&nbsp;</span>
                            <Code>
                                /{t('home')}/{t('container')}/
                                <span css={tw`text-cyan-200`}>
                                    {join(directory, values.filename).replace(/^(\.\.\/|\/)+/, '')}
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

export default function CreateFile({ onRefresh }: CreateFileProps) {
    const { t } = useTranslation('arix/server/files');
    const [open, setOpen] = useState(false);

    return (
        <>
            <CreateFileDialog open={open} onClose={() => setOpen(false)} onRefresh={onRefresh} />
            <DropdownButtonRow className={`flex items-center gap-2`} onClick={() => setOpen(true)}>
                <LuFilePlus /> {t('edit.create-file')}
            </DropdownButtonRow>
        </>
    );
}
