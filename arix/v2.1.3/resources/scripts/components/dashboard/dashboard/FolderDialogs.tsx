import React, { useState } from 'react';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import {
    FolderIcon,
    HeartIcon,
    HomeIcon,
    PencilAltIcon,
    PlusIcon,
    StarIcon,
    TrashIcon,
} from '@heroicons/react/outline';
import { ServerFolder, createServerFolder, deleteServerFolder, updateServerFolder } from '@/api/serverFolders';
import Label from '@/components/elements/Label';
import Input from '@/components/elements/Input';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import { useTranslation } from 'react-i18next';

export const DeleteFolderDialog = ({
    folderId,
    updateFolders,
}: {
    folderId: number;
    updateFolders: React.Dispatch<React.SetStateAction<ServerFolder[]>>;
}) => {
    const { t } = useTranslation('arix/dashboard');
    const [isOpen, setIsOpen] = useState(false);

    const deleteFolder = () => {
        deleteServerFolder(folderId)
            .then(() => {
                updateFolders((prev) => prev.filter((folder) => folder.id !== folderId));
            })
            .catch((error) => {
                console.error('Failed to delete folder:', error);
            });
        setIsOpen(false);
    };

    return (
        <>
            <Dialog
                open={isOpen}
                onClose={() => setIsOpen(false)}
                title={t('folder.delete')}
                description={t('folder.are-you-sure-delete')}
            >
                <Dialog.Footer>
                    <Button.Text onClick={() => setIsOpen(false)}>Cancel</Button.Text>
                    <Button.Danger onClick={deleteFolder} color={'red'}>
                        {t('folder.delete')}
                    </Button.Danger>
                </Dialog.Footer>
            </Dialog>

            <Tooltip content={`${t('folder.delete')}`}>
                <button onClick={() => setIsOpen(true)} className='p-1 duration-300 hover:text-danger-50'>
                    <TrashIcon className='w-5' />
                </button>
            </Tooltip>
        </>
    );
};

export const EditOrUpdateFolderDialog = ({
    folder,
    updateFolders,
    currentFolder,
}: {
    folder?: ServerFolder;
    updateFolders: React.Dispatch<React.SetStateAction<ServerFolder[]>>;
    currentFolder?: number;
}) => {
    const { t } = useTranslation('arix/dashboard');
    const [name, setName] = useState(folder?.name || '');
    const [color, setColor] = useState(folder?.color || '');
    const [icon, setIcon] = useState(folder?.icon || 'folder');
    const [isOpen, setIsOpen] = useState(false);

    const updateOrCreateFolder = () => {
        if (folder) {
            updateServerFolder(folder.id, { name, color, icon })
                .then((updatedFolder) => {
                    const normalized = { ...updatedFolder, servers: updatedFolder.servers ?? [] };
                    updateFolders((prevFolders) => prevFolders.map((f) => (f.id === normalized.id ? normalized : f)));
                })
                .catch((error) => {
                    console.error('Failed to update folder:', error);
                });
        } else {
            createServerFolder({ name, color, icon, parent_id: currentFolder })
                .then((newFolder) => {
                    const normalized = { ...newFolder, servers: newFolder.servers ?? [] };
                    updateFolders((prevFolders) => [...prevFolders, normalized]);
                })
                .catch((error) => {
                    console.error('Failed to create folder:', error);
                });
        }
        setIsOpen(false);
    };

    return (
        <>
            <Dialog open={isOpen} onClose={() => setIsOpen(false)} title={folder ? t('folder.edit') : t('folder.create')}>
                <div className='space-y-4'>
                    <div>
                        <Label htmlFor='folder-name'>{t('folder.name')}</Label>
                        <Input
                            id='folder-name'
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('folder.name')}
                        />
                    </div>
                    <div>
                        <Label htmlFor='folder-color'>{t('folder.color')}</Label>
                        <Input
                            id='folder-color'
                            type='color'
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            placeholder={t('folder.color')}
                        />
                    </div>
                    <div>
                        <Label>{t('folder.icon')}</Label>
                        <div className='grid grid-cols-4 gap-x-2'>
                            <Button.Text
                                onClick={() => setIcon('folder')}
                                className={icon === 'folder' ? '!bg-secondary-100' : ''}
                            >
                                <FolderIcon className='w-5' />
                            </Button.Text>
                            <Button.Text
                                onClick={() => setIcon('heart')}
                                className={icon === 'heart' ? '!bg-secondary-100' : ''}
                            >
                                <HeartIcon className='w-5' />
                            </Button.Text>
                            <Button.Text
                                onClick={() => setIcon('star')}
                                className={icon === 'star' ? '!bg-secondary-100' : ''}
                            >
                                <StarIcon className='w-5' />
                            </Button.Text>
                            <Button.Text
                                onClick={() => setIcon('home')}
                                className={icon === 'home' ? '!bg-secondary-100' : ''}
                            >
                                <HomeIcon className='w-5' />
                            </Button.Text>
                        </div>
                    </div>
                </div>
                <Dialog.Footer>
                    <Button.Text onClick={() => setIsOpen(false)}>Cancel</Button.Text>
                    <Button
                        onClick={() => {
                            updateOrCreateFolder();
                        }}
                    >
                        {folder ? t('folder.update') : t('folder.create')}
                    </Button>
                </Dialog.Footer>
            </Dialog>

            {folder ? (
                <Tooltip content={`${t('folder.edit')} ${folder.name}`}>
                    <button onClick={() => setIsOpen(true)} className='p-1'>
                        <PencilAltIcon className='w-5' />
                    </button>
                </Tooltip>
            ) : (
                <div
                    onClick={() => setIsOpen(true)}
                    className='px-2 py-1 rounded-md border cursor-pointer flex gap-x-1 items-center text-sm border-gray-600
                    hover:bg-gray-600 hover:border-solid duration-300 ml-1'
                >
                    {t('folder.create')}
                    <PlusIcon className='w-4' />
                </div>
            )}
        </>
    );
};
