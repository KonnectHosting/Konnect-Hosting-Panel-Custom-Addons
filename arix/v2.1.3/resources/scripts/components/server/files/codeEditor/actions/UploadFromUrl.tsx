import { DropdownButtonRow } from '@/components/elements/DropdownMenu';
import asDialog from '@/hoc/asDialog';
import { ServerContext } from '@/state/server';
import { Form, Formik, FormikHelpers } from 'formik';
import Field from '@/components/elements/Field';
import React, { useContext, useEffect, useState } from 'react';
import { LuCloudDownload } from 'react-icons/lu';
import { Dialog, DialogWrapperContext } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import { useFlashKey } from '@/plugins/useFlash';
import FlashMessageRender from '@/components/FlashMessageRender';
import pullFile from '@/api/server/files/pullFile';
import { useTranslation } from 'react-i18next';

interface Values {
    url: string;
    filename: string;
}

const PullFromUrl = asDialog({
    title: 'Upload from URL',
    description: 'Upload a file to the server by providing a direct URL to the file.',
})(({ onRefresh }: { onRefresh?: () => void }) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const directory = ServerContext.useStoreState((state) => state.files.directory);

    const { clearAndAddHttpError } = useFlashKey('files:upload-from-url');
    const { close } = useContext(DialogWrapperContext);

    useEffect(() => {
        return () => {
            clearAndAddHttpError();
        };
    }, []);

    const handleSubmit = ({ url, filename }: Values, { setSubmitting }: FormikHelpers<Values>) => {
        pullFile(uuid, url, directory, filename)
            .then(() => {
                onRefresh?.();
            })
            .catch((error) => {
                clearAndAddHttpError(error);
            })
            .finally(() => {
                setSubmitting(false);
                close();
            });
    };

    const extractFilenameFromUrl = (url: string): string | null => {
        if (!url) return null;
        try {
            const parsed = new URL(url, 'http://example.com');
            const pathname = parsed.pathname || '';
            const parts = pathname.split('/').filter(Boolean);
            if (!parts.length) return null;
            const last = parts[parts.length - 1].split('?')[0].split('#')[0];
            return last || null;
        } catch (e) {
            const last = url.split('/').pop() || '';
            const clean = last.split('?')[0].split('#')[0];
            return clean || null;
        }
    };

    return (
        <Formik onSubmit={handleSubmit} initialValues={{ url: '', filename: '' }}>
            {({ submitForm, handleChange, setFieldValue, values }) => (
                <>
                    <FlashMessageRender key={'files:upload-from-url'} />
                    <Form>
                        <div className='mt-3'>
                            <Field
                                required
                                autoFocus
                                id={'url'}
                                name={'url'}
                                label={'URL'}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    handleChange(e);
                                    const extracted = extractFilenameFromUrl(e.target.value || '');
                                    if (extracted && (!values.filename || values.filename.length === 0)) {
                                        setFieldValue('filename', extracted);
                                    }
                                }}
                            />
                        </div>
                        <div className='mt-3'>
                            <Field required id={'filename'} name={'filename'} label={'Filename'} />
                        </div>
                    </Form>
                    <Dialog.Footer>
                        <Button.Text className={'w-full sm:w-auto'} onClick={close}>
                            Cancel
                        </Button.Text>
                        <Button className={'w-full sm:w-auto'} onClick={submitForm}>
                            Upload
                        </Button>
                    </Dialog.Footer>
                </>
            )}
        </Formik>
    );
});

export default function UploadFromUrl({ className, onRefresh }: { className?: string; onRefresh?: () => void }) {
    const { t } = useTranslation('arix/server/files');
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <PullFromUrl open={isOpen} onClose={() => setIsOpen(false)} onRefresh={onRefresh} />
            <DropdownButtonRow className={className} onClick={() => setIsOpen(true)}>
                <LuCloudDownload /> {t('upload-from-url')}
            </DropdownButtonRow>
        </>
    );
}
