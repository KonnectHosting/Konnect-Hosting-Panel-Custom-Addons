import React, { useEffect, useRef, useState } from 'react';
import deleteFiles from '@/api/server/files/deleteFiles';
import { deleteResourceItem } from '@/api/server/platform/api';
import { useInstalledItems } from '@/components/elements/platform/InstalledItemsContext';
import { ServerContext } from '@/state/server';
import { Actions, useStoreActions } from 'easy-peasy';
import { TrashIcon } from '@heroicons/react/outline';
import { ApplicationStore } from '@/state';
import Can from '@/components/elements/Can';
import { Button } from '@/components/elements/button/index';
import Spinner from '@/components/elements/Spinner';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import FlashMessageRender from '@/components/FlashMessageRender';
import { Dialog } from '@/components/elements/dialog';
import tw from 'twin.macro';
import { useTranslation } from 'react-i18next';

export default function DeleteResourceButton({
    resource,
    installDirectory,
    itemId,
    fileName,
    managedPaths,
}: {
    resource: string;
    installDirectory: string;
    itemId?: number | null;
    fileName: string;
    managedPaths: string[];
}) {
    const { t } = useTranslation('arix/server/addons/plugins');
    const [isOpen, setIsOpen] = useState(false);
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { removeItem } = useInstalledItems();
    const { clearFlashes, addFlash } = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes);
    const [loading, setLoading] = useState(false);

    // removeItem() drops this row out of the installed list on success, which
    // unmounts this component before the request settles - guard the local
    // state update that follows so it doesn't fire against an unmounted row.
    const isMountedRef = useRef(true);
    useEffect(
        () => () => {
            isMountedRef.current = false;
        },
        []
    );

    const onDelete = () => {
        setLoading(true);
        clearFlashes('resource-browser:delete');

        const request = itemId
            ? deleteResourceItem({ id, resource, itemId })
            : deleteFiles(uuid, installDirectory, managedPaths.length > 0 ? managedPaths : [fileName]);

        request
            .then(() => {
                removeItem(itemId ?? fileName);

                addFlash({
                    type: 'success',
                    key: 'resource-browser',
                    message: t('delete.deleted-succesfully'),
                });
            })
            .catch((error) => {
                addFlash({
                    type: 'error',
                    key: 'resource-browser',
                    message: error.response?.data?.error ?? error.message,
                });
            })
            .finally(() => {
                if (isMountedRef.current) {
                    setLoading(false);
                }
            });
    };

    return (
        <>
            <Dialog.Confirm
                open={isOpen}
                hideCloseIcon
                onClose={() => setIsOpen(false)}
                title={t('delete.delete')}
                confirm={t('delete.continue')}
                onConfirmed={onDelete}
            >
                {t('delete.are-you-sure')} <code>{fileName}</code>?
            </Dialog.Confirm>

            <Can action={'file.delete'}>
                <Tooltip content={`${t('delete.delete')}`} placement={'top'}>
                    <Button.Danger onClick={() => setIsOpen(true)} disabled={loading} className={'ml-auto'}>
                        {loading ? <Spinner size={'small'} /> : <TrashIcon className={'w-4'} />}
                    </Button.Danger>
                </Tooltip>
            </Can>
        </>
    );
}
