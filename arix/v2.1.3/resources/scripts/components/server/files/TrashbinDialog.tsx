import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import asDialog from '@/hoc/asDialog';
import { Button } from '@/components/elements/button/index';
import { deleteTrashbin, getTrashbin, restoreTrashbin, TrashbinItem } from '@/api/server/files/trashbin';
import { ServerContext } from '@/state/server';
import Spinner from '@/components/elements/Spinner';
import { LuFileText, LuFolder, LuTrash } from 'react-icons/lu';
import Code from '@/components/elements/Code';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import useFlash from '@/plugins/useFlash';
import useFileManagerSwr from '@/plugins/useFileManagerSwr';
import { Alert } from '@/components/elements/alert';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import Input from '@/components/elements/Input';
import { Dialog } from '@/components/elements/dialog';
import { bytesToString } from '@/lib/formatters';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { useTranslation } from 'react-i18next';

const BinItem = ({
    item,
    remove,
    selected,
    onSelect,
}: {
    item: TrashbinItem;
    remove: (item: TrashbinItem) => void;
    selected: boolean;
    onSelect: (checked: boolean) => void;
}) => {
    const { t } = useTranslation('arix/server/files');
    const gracePeriod = useStoreState((state: ApplicationStore) => state.settings.data!.arix.advanced.gracePeriod);
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const [loading, setLoading] = useState(false);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { mutate } = useFileManagerSwr();
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    const onRestore = () => {
        setLoading(true);
        clearFlashes('files');

        restoreTrashbin(uuid, [item.trashName])
            .then(() => {
                clearFlashes('files');
                remove(item);
                mutate();
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'files', error });
            })
            .finally(() => setLoading(false));
    };

    const onDelete = () => {
        setLoading(true);
        clearFlashes('files');

        deleteTrashbin(uuid, [item.trashName])
            .then(() => {
                clearFlashes('files');
                remove(item);
                mutate();
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'files', error });
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (confirmingDelete) {
            const timeout = setTimeout(() => {
                setConfirmingDelete(false);
            }, 5000);

            return () => clearTimeout(timeout);
        }

        return undefined;
    }, [confirmingDelete]);

    const onClickDelete = () => {
        if (confirmingDelete) {
            onDelete();
        } else {
            setConfirmingDelete(true);
        }
    };

    const deleteAt = new Date(item.createdAt.getTime() + gracePeriod * 24 * 60 * 60 * 1000);
    const deleteAtFormatted = format(deleteAt, 'MMMM do, yyyy');

    return (
        <>
            <SpinnerOverlay visible={loading} />
            <div className='py-2 flex items-center justify-between gap-6'>
                <div className='flex items-center gap-x-3 w-1/3'>
                    <Input
                        type={'checkbox'}
                        id={item.trashName}
                        checked={selected}
                        onChange={(e) => onSelect(e.currentTarget.checked)}
                    />
                    {item.isDirectory ? (
                        <LuFolder className='text-yellow-500 w-5 h-5 shrink-0' />
                    ) : (
                        <LuFileText className='text-gray-300 w-5 h-5 shrink-0' />
                    )}
                    <p className='w-full whitespace-nowrap overflow-hidden text-ellipsis'>{item.displayName}</p>
                </div>
                <div className='flex-1'>
                    <p className='text-xs text-gray-300 font-medium'>{t('trashbin.original-path')}</p>
                    <Code dark>{item.originalRoot ?? '/'}</Code>
                </div>
                <div className='w-1/5'>
                    <p className='text-xs text-gray-300 font-medium'>{t('trashbin.deleted-at')}</p>
                    <span className='text-sm'>{deleteAtFormatted}</span>
                </div>
                <div className='space-x-2'>
                    <Button.Text size={Button.Sizes.Small} onClick={onRestore}>
                        {t('trashbin.restore')}
                    </Button.Text>
                    <Button.Danger size={Button.Sizes.Small} onClick={onClickDelete}>
                        {confirmingDelete ? t('trashbin.confirm-delete') : t('trashbin.delete')}
                    </Button.Danger>
                </div>
            </div>
        </>
    );
};

const BinDialog = asDialog(() => {
    const { t } = useTranslation('arix/server/files');

    return {
        title: t('trashbin.title'),
        description: t('trashbin.description'),
        extraWidth: true,
    }
})(() => {
    const { t } = useTranslation('arix/server/files');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const gracePeriod = useStoreState((state: ApplicationStore) => state.settings.data!.arix.advanced.gracePeriod);
    const [selected, setSelected] = useState<string[]>([]);
    const [trashbinItems, setTrashbinItems] = useState<TrashbinItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [spinner, setSpinner] = useState(false);
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const { mutate } = useFileManagerSwr();

    const allSelected = trashbinItems.length > 0 && selected.length === trashbinItems.length;

    useEffect(() => {
        getTrashbin(uuid)
            .then((items) => {
                setTrashbinItems(items);
            })
            .catch((error) => {
                console.error('Failed to fetch trashbin items:', error);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [uuid]);

    useEffect(() => {
        const validNames = new Set(trashbinItems.map((item) => item.trashName));
        setSelected((prev) => prev.filter((name) => validNames.has(name)));
    }, [trashbinItems]);

    const onToggleSelectAll = (checked: boolean) => {
        setSelected(checked ? trashbinItems.map((item) => item.trashName) : []);
    };

    const onDelete = () => {
        setSpinner(true);
        clearFlashes('files');

        deleteTrashbin(uuid, [...selected])
            .then(() => {
                clearFlashes('files');
                setTrashbinItems((items) => items.filter((i) => !selected.includes(i.trashName)));
                setSelected([]);
                mutate();
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'files', error });
            })
            .finally(() => setSpinner(false));
    };

    const onRestore = () => {
        setSpinner(true);
        clearFlashes('files');

        restoreTrashbin(uuid, [...selected])
            .then(() => {
                clearFlashes('files');
                setTrashbinItems((items) => items.filter((i) => !selected.includes(i.trashName)));
                setSelected([]);
                mutate();
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'files', error });
            })
            .finally(() => setSpinner(false));
    };
    return (
        <>
            <SpinnerOverlay visible={spinner} />
            <div className='w-full'>
                <Alert type='warning' className='my-2'>
                    {t('trashbin.will-be-deleted', { days: gracePeriod })}
                </Alert>

                {!loading && trashbinItems.length > 0 && (
                    <div className='flex items-center justify-between py-2 border-b border-gray-700 mb-2'>
                        <label className='flex items-center gap-3 cursor-pointer'>
                            <Input
                                type={'checkbox'}
                                id={'trashbin-select-all'}
                                checked={allSelected}
                                onChange={(e) => onToggleSelectAll(e.currentTarget.checked)}
                            />
                            <span className='text-sm text-gray-300'>{t('trashbin.select-all')}</span>
                        </label>
                        <span className='text-sm text-gray-300'>{selected.length} {t('trashbin.selected')}</span>
                    </div>
                )}

                {loading ? (
                    <Spinner />
                ) : trashbinItems.length === 0 ? (
                    <p className='text-center text-gray-300 py-3'>{t('trashbin.is-empty')}</p>
                ) : (
                    <div className='divide-y divide-gray-600'>
                        {trashbinItems.map((item) => (
                            <BinItem
                                key={item.trashName}
                                selected={selected.includes(item.trashName)}
                                onSelect={(checked) => {
                                    setSelected((prev) =>
                                        checked
                                            ? Array.from(new Set([...prev, item.trashName]))
                                            : prev.filter((s) => s !== item.trashName)
                                    );
                                }}
                                item={item}
                                remove={(item) => {
                                    setTrashbinItems((items) => items.filter((i) => i.trashName !== item.trashName));
                                    setSelected((prev) => prev.filter((name) => name !== item.trashName));
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
            <Dialog.Footer>
                {trashbinItems.length > 0 && (
                    <div className='mr-auto flex items-center gap-x-3 text-sm text-gray-300'>
                        <span>
                            {trashbinItems.length} {trashbinItems.length === 1 ? t('trashbin.item') : t('trashbin.items')}
                        </span>
                        <span>{bytesToString(trashbinItems.reduce((total, item) => total + item.size, 0))}</span>
                    </div>
                )}
                <Button.Text disabled={selected.length === 0} onClick={onRestore}>
                    {t('trashbin.restore')}
                </Button.Text>
                <Button.Danger disabled={selected.length === 0} onClick={onDelete}>
                    {t('trashbin.delete-permanently')}
                </Button.Danger>
            </Dialog.Footer>
        </>
    );
});

export default function TrashbinDialog() {
    const { t } = useTranslation('arix/server/files');
    const trashbin = useStoreState((state: ApplicationStore) => state.settings.data!.arix.advanced.trashbin);
    const [open, setOpen] = useState(false);

    return (
        <>
            {trashbin && (
                <Tooltip content={`${t('trashbin.title')}`}>
                    <Button.Text className={'h-10'} onClick={() => setOpen(true)}>
                        <LuTrash className='w-5 h-5' />
                    </Button.Text>
                </Tooltip>
            )}
            <BinDialog open={open} onClose={() => setOpen(false)} />
        </>
    );
}
