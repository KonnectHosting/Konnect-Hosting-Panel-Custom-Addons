import React, { memo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisH } from '@fortawesome/free-solid-svg-icons';
import RenameFileModal from '@/components/server/files/RenameFileModal';
import MoveFileDialog from '@/components/server/files/MoveFileDialog';
import { ServerContext } from '@/state/server';
import { join } from 'pathe';
import deleteFiles from '@/api/server/files/deleteFiles';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import copyFile from '@/api/server/files/copyFile';
import Can from '@/components/elements/Can';
import getFileDownloadUrl from '@/api/server/files/getFileDownloadUrl';
import useFlash from '@/plugins/useFlash';
import tw from 'twin.macro';
import { FileObject } from '@/api/server/files/loadDirectory';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import DropdownMenu, { DropdownButtonRow, DropdownDivider } from '@/components/elements/DropdownMenu';
import styled from 'styled-components/macro';
import useEventListener from '@/plugins/useEventListener';
import compressFiles from '@/api/server/files/compressFiles';
import decompressFiles from '@/api/server/files/decompressFiles';
import isEqual from 'react-fast-compare';
import ChmodFileModal from '@/components/server/files/ChmodFileModal';
import { Dialog } from '@/components/elements/dialog';
import { useTranslation } from 'react-i18next';
import {
    LuTextCursor,
    LuMove,
    LuKey,
    LuFileArchive,
    LuFolderOpenDot,
    LuTrash2,
    LuCopy,
    LuDownload,
} from 'react-icons/lu';
import Button from '@/components/elements/button/Button';
import { moveToTrashbin } from '@/api/server/files/trashbin';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';

type ModalType = 'rename' | 'move' | 'chmod';

interface RowProps extends React.HTMLAttributes<HTMLDivElement> {
    icon: React.ComponentType;
    title: string;
    onClick?: () => void;
    danger?: boolean;
}

const Row = ({ icon: Icon, title, danger, onClick }: RowProps) => (
    <DropdownButtonRow onClick={onClick} danger={danger}>
        <Icon />
        <span css={tw`ml-2`}>{title}</span>
    </DropdownButtonRow>
);

const FileDropdownMenu = ({ file }: { file: FileObject }) => {
    const { t } = useTranslation('arix/server/files');
    const onClickRef = useRef<DropdownMenu>(null);
    const [showSpinner, setShowSpinner] = useState(false);
    const [modal, setModal] = useState<ModalType | null>(null);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { mutate } = useFileManagerSwr();
    const { clearAndAddHttpError, clearFlashes } = useFlash();
    const directory = ServerContext.useStoreState((state) => state.files.directory);
    const trashbin = useStoreState((state: ApplicationStore) => state.settings.data!.arix.advanced.trashbin);

    useEventListener(`pterodactyl:files:ctx:${file.key}`, (e: CustomEvent) => {
        if (onClickRef.current) {
            onClickRef.current.triggerMenu(e.detail.clientX, e.detail.clientY);
        }
    });

    const doDeletion = () => {
        clearFlashes('files');

        // For UI speed, immediately remove the file from the listing before calling the deletion function.
        // If the delete actually fails, we'll fetch the current directory contents again automatically.
        mutate((files) => files.filter((f) => f.key !== file.key), false);

        deleteFiles(uuid, directory, [file.name]).catch((error) => {
            mutate();
            clearAndAddHttpError({ key: 'files', error });
        });
    };

    const doTrashbin = () => {
        clearFlashes('files');

        moveToTrashbin(uuid, directory, [file.name])
            .then(() => mutate())
            .catch((error) => clearAndAddHttpError({ key: 'files', error }));
    };

    const doCopy = () => {
        setShowSpinner(true);
        clearFlashes('files');

        copyFile(uuid, join(directory, file.name))
            .then(() => mutate())
            .catch((error) => clearAndAddHttpError({ key: 'files', error }))
            .then(() => setShowSpinner(false));
    };

    const doDownload = () => {
        setShowSpinner(true);
        clearFlashes('files');

        getFileDownloadUrl(uuid, join(directory, file.name))
            .then((url) => {
                // @ts-expect-error this is valid
                window.location = url;
            })
            .catch((error) => clearAndAddHttpError({ key: 'files', error }))
            .then(() => setShowSpinner(false));
    };

    const doArchive = () => {
        setShowSpinner(true);
        clearFlashes('files');

        compressFiles(uuid, directory, [file.name])
            .then(() => mutate())
            .catch((error) => clearAndAddHttpError({ key: 'files', error }))
            .then(() => setShowSpinner(false));
    };

    const doUnarchive = () => {
        setShowSpinner(true);
        clearFlashes('files');

        decompressFiles(uuid, directory, file.name)
            .then(() => mutate())
            .catch((error) => clearAndAddHttpError({ key: 'files', error }))
            .then(() => setShowSpinner(false));
    };

    return (
        <>
            <Dialog
                open={showConfirmation}
                onClose={() => setShowConfirmation(false)}
                title={`Delete ${file.isFile ? 'File' : 'Directory'}`}
            >
                {t('you-cant-recover')}&nbsp;
                <span className={'font-semibold text-gray-50'}>{file.name}</span> {t('once-deleted')}
                <Dialog.Footer>
                    <div className='flex gap-2 justify-end'>
                        <Button.Text onClick={() => setShowConfirmation(false)}>Cancel</Button.Text>
                        <Button.Danger onClick={doDeletion} variant={Button.Variants.Secondary}>
                            Permanently delete
                        </Button.Danger>
                        {trashbin && <Button.Danger onClick={doTrashbin}>Move to trash</Button.Danger>}
                    </div>
                </Dialog.Footer>
            </Dialog>
            <DropdownMenu
                ref={onClickRef}
                renderToggle={(onClick) => (
                    <div css={tw`px-4 py-2 hover:text-white`} onClick={onClick}>
                        <FontAwesomeIcon icon={faEllipsisH} />
                        {modal ? (
                            modal === 'chmod' ? (
                                <ChmodFileModal
                                    visible
                                    appear
                                    files={[{ file: file.name, mode: file.modeBits }]}
                                    onDismissed={() => setModal(null)}
                                />
                            ) : modal === 'move' ? (
                                <MoveFileDialog open={true} files={[file.name]} onClose={() => setModal(null)} />
                            ) : (
                                <RenameFileModal
                                    visible
                                    appear
                                    files={[file.name]}
                                    onDismissed={() => setModal(null)}
                                />
                            )
                        ) : null}
                        <SpinnerOverlay visible={showSpinner} fixed size={'large'} />
                    </div>
                )}
            >
                <Can action={'file.update'}>
                    <Row onClick={() => setModal('rename')} icon={LuTextCursor} title={t('rename')} />
                    <Row onClick={() => setModal('move')} icon={LuMove} title={t('move')} />
                    <Row onClick={() => setModal('chmod')} icon={LuKey} title={t('permissions')} />
                </Can>
                {file.isFile && (
                    <Can action={'file.create'}>
                        <Row onClick={doCopy} icon={LuCopy} title={t('copy')} />
                    </Can>
                )}
                {file.isArchiveType() ? (
                    <Can action={'file.create'}>
                        <Row onClick={doUnarchive} icon={LuFolderOpenDot} title={t('unarchive')} />
                    </Can>
                ) : (
                    <Can action={'file.archive'}>
                        <Row onClick={doArchive} icon={LuFileArchive} title={t('archive')} />
                    </Can>
                )}
                {file.isFile && <Row onClick={doDownload} icon={LuDownload} title={t('download')} />}
                <Can action={'file.delete'}>
                    <div>
                        <DropdownDivider />
                        <Row onClick={() => setShowConfirmation(true)} icon={LuTrash2} title={t('delete')} danger />
                    </div>
                </Can>
            </DropdownMenu>
        </>
    );
};

export default memo(FileDropdownMenu, isEqual);
