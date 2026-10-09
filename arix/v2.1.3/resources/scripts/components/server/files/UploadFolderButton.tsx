import axios, { AxiosProgressEvent } from 'axios';
import getFileUploadUrl from '@/api/server/files/getFileUploadUrl';
import decompressFiles from '@/api/server/files/decompressFiles';
import deleteFiles from '@/api/server/files/deleteFiles';
import tw from 'twin.macro';
import React, { useEffect, useRef } from 'react';
import { ModalMask } from '@/components/elements/Modal';
import Fade from '@/components/elements/Fade';
import { useFlashKey } from '@/plugins/useFlash';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import { ServerContext } from '@/state/server';
import { WithClassname } from '@/components/types';
import Portal from '@/components/elements/Portal';
import { CloudUploadIcon } from '@heroicons/react/outline';
import { useSignal } from '@preact/signals-react';
import { LuFolderUp } from 'react-icons/lu';
import { useTranslation } from 'react-i18next';
import JSZip from 'jszip';
import { DropdownButtonRow } from '@/components/elements/DropdownMenu';

export default ({ className }: WithClassname) => {
    const { t } = useTranslation('arix/server/files');
    const fileUploadInput = useRef<HTMLInputElement>(null);
    const visible = useSignal(false);

    const timeouts = useSignal<NodeJS.Timeout[]>([]);

    const { mutate } = useFileManagerSwr();
    const { addError, clearAndAddHttpError } = useFlashKey('files');

    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const { clearFileUploads, removeFileUpload, pushFileUpload, setUploadProgress } = ServerContext.useStoreActions(
        (actions) => actions.files
    );

    useEffect(() => {
        return () => timeouts.value.forEach(clearTimeout);
    }, []);

    const onUploadProgress = (data: AxiosProgressEvent, name: string) => {
        setUploadProgress({ name, loaded: data.loaded });
    };

    const onFileSubmission = async (files: FileList) => {
        clearAndAddHttpError();
        const list = Array.from(files);

        if (list.length === 0) {
            return addError('No files selected.', 'Error');
        }

        const totalSize = list.reduce((acc, file) => acc + file.size, 0);
        const maxSize = 10 * 1024 * 1024;

        if (totalSize > maxSize) {
            return addError(t('folder-too-big'), 'Error');
        }

        visible.value = false;

        const zip = new JSZip();
        const folderName = list[0].webkitRelativePath.split('/')[0] || 'upload';

        list.forEach((file) => {
            const relativePath = file.webkitRelativePath || file.name;
            zip.file(relativePath, file);
        });

        try {
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const zipFileName = `${folderName}.zip`;
            const zipFile = new File([zipBlob], zipFileName, { type: 'application/zip' });

            const controller = new AbortController();
            pushFileUpload({
                name: zipFileName,
                data: { abort: controller, loaded: 0, total: zipFile.size },
            });

            const url = await getFileUploadUrl(uuid);

            await axios.post(
                url,
                { files: zipFile },
                {
                    signal: controller.signal,
                    headers: { 'Content-Type': 'multipart/form-data' },
                    params: { directory },
                    onUploadProgress: (data) => onUploadProgress(data, zipFileName),
                }
            );

            await decompressFiles(uuid, directory, zipFileName);

            await deleteFiles(uuid, directory, [zipFileName]);

            await mutate();

            timeouts.value.push(
                setTimeout(() => {
                    removeFileUpload(zipFileName);
                    visible.value = false;
                }, 500)
            );
        } catch (error) {
            clearFileUploads();
            clearAndAddHttpError(error as Error);
            visible.value = false;
        }
    };

    useEffect(() => {
        if (fileUploadInput.current) {
            fileUploadInput.current.setAttribute('webkitdirectory', '');
            fileUploadInput.current.setAttribute('directory', '');
        }
    }, []);

    return (
        <>
            <Portal>
                <Fade appear in={visible.value} timeout={75} key={'upload_modal_mask'} unmountOnExit>
                    <ModalMask onClick={() => (visible.value = false)}>
                        <div className={'w-full flex items-center justify-center pointer-events-none'}>
                            <div
                                className={
                                    'flex items-center space-x-4 bg-black w-full ring-4 ring-blue-200 ring-opacity-60 rounded p-6 mx-10 max-w-sm'
                                }
                            >
                                <CloudUploadIcon className={'w-10 h-10 flex-shrink-0'} />
                                <p className={'font-header flex-1 text-lg text-neutral-100 text-center'}>
                                    {t('drag-and-drop')}
                                </p>
                            </div>
                        </div>
                    </ModalMask>
                </Fade>
            </Portal>
            <input
                type='file'
                ref={fileUploadInput}
                css={tw`hidden`}
                multiple
                onChange={(e) => {
                    if (!e.currentTarget.files) return;
                    onFileSubmission(e.currentTarget.files);
                    e.currentTarget.value = '';
                }}
            />
            <DropdownButtonRow
                className={className}
                onClick={() => fileUploadInput.current && fileUploadInput.current.click()}
            >
                <LuFolderUp /> {t('upload-folders')}
            </DropdownButtonRow>
        </>
    );
};
