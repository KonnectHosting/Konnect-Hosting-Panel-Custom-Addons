import React, { useEffect, useState } from 'react';
import { Button } from '@/components/elements/button/index';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import useFlash from '@/plugins/useFlash';
import compressFiles from '@/api/server/files/compressFiles';
import { ServerContext } from '@/state/server';
import deleteFiles from '@/api/server/files/deleteFiles';
import { LuTrash2, LuFolderInput, LuFileArchive } from 'react-icons/lu';
import MoveFileDialog from '@/components/server/files/MoveFileDialog';
import { Dialog } from '@/components/elements/dialog';
import { useTranslation } from 'react-i18next';
import { moveToTrashbin } from '@/api/server/files/trashbin';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';

const MassActionsBar = () => {
    const { t } = useTranslation('arix/server/files');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);

    const { mutate } = useFileManagerSwr();
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [showMove, setShowMove] = useState(false);
    const directory = ServerContext.useStoreState((state) => state.files.directory);

    const selectedFiles = ServerContext.useStoreState((state) => state.files.selectedFiles);
    const setSelectedFiles = ServerContext.useStoreActions((actions) => actions.files.setSelectedFiles);
    const trashbin = useStoreState((state: ApplicationStore) => state.settings.data!.arix.advanced.trashbin);

    useEffect(() => {
        if (!loading) setLoadingMessage('');
    }, [loading]);

    const onClickCompress = () => {
        setLoading(true);
        clearFlashes('files');
        setLoadingMessage('Archiving files...');

        compressFiles(uuid, directory, selectedFiles)
            .then(() => mutate())
            .then(() => setSelectedFiles([]))
            .catch((error) => clearAndAddHttpError({ key: 'files', error }))
            .then(() => setLoading(false));
    };

    const onClickConfirmDeletion = () => {
        setLoading(true);
        setShowConfirm(false);
        clearFlashes('files');
        setLoadingMessage('Deleting files...');

        deleteFiles(uuid, directory, selectedFiles)
            .then(() => {
                mutate((files) => files.filter((f) => selectedFiles.indexOf(f.name) < 0), false);
                setSelectedFiles([]);
            })
            .catch((error) => {
                mutate();
                clearAndAddHttpError({ key: 'files', error });
            })
            .then(() => setLoading(false));
    };

    const onClickMoveToTrash = () => {
        setLoading(true);
        setShowConfirm(false);
        clearFlashes('files');
        setLoadingMessage('Moving files to trash...');

        moveToTrashbin(uuid, directory, selectedFiles)
            .then(() => {
                mutate((files) => files.filter((f) => selectedFiles.indexOf(f.name) < 0), false);
                setSelectedFiles([]);
            })
            .catch((error) => {
                mutate();
                clearAndAddHttpError({ key: 'files', error });
            })
            .then(() => setLoading(false));
    };

    return (
        <>
            <div>
                <SpinnerOverlay visible={loading} size={'large'} fixed>
                    {loadingMessage}
                </SpinnerOverlay>
                <Dialog title={t('delete-files')} open={showConfirm} onClose={() => setShowConfirm(false)}>
                    <p className={'mb-2'}>
                        {t('are-you-sure')}&nbsp;
                        <span className={'font-semibold text-gray-50'}>{selectedFiles.length} files</span>?{' '}
                        {t('this-is-permanent-action')}
                    </p>
                    {selectedFiles.slice(0, 15).map((file) => (
                        <li key={file}>{file}</li>
                    ))}
                    {selectedFiles.length > 15 && <li>and {selectedFiles.length - 15} others</li>}

                    <Dialog.Footer>
                        <div className='flex gap-2 justify-end'>
                            <Button.Text onClick={() => setShowConfirm(false)}>Cancel</Button.Text>
                            <Button.Danger onClick={onClickConfirmDeletion} variant={Button.Variants.Secondary}>
                                Permanently delete
                            </Button.Danger>
                            {trashbin && <Button.Danger onClick={onClickMoveToTrash}>Move to trash</Button.Danger>}
                        </div>
                    </Dialog.Footer>
                </Dialog>
                {showMove && <MoveFileDialog files={selectedFiles} open={true} onClose={() => setShowMove(false)} />}
                <div className={`${selectedFiles.length < 1 ? 'opacity-0 pointer-events-none' : ''} flex gap-4`}>
                    <Button.Text onClick={onClickCompress} className={'flex items-center gap-2'}>
                        <LuFileArchive /> {t('archive')}
                    </Button.Text>
                    <Button.Text onClick={() => setShowMove(true)} className={'flex items-center gap-2'}>
                        <LuFolderInput /> {t('move')}
                    </Button.Text>
                    <Button.Danger onClick={() => setShowConfirm(true)} className={'flex items-center gap-2'}>
                        <LuTrash2 /> {t('delete')}
                    </Button.Danger>
                </div>
            </div>
        </>
    );
};

export default MassActionsBar;
