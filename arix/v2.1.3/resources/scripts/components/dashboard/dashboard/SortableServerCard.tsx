import React, { useState } from 'react';
import { Server } from '@/api/server/getServer';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import { CheckIcon, FolderIcon, HeartIcon, HomeIcon, StarIcon, XIcon } from '@heroicons/react/outline';
import { ServerFolder, addServerToFolder, removeServerFromFolder } from '@/api/serverFolders';
import { RiDragMove2Fill } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';

const FOLDER_ICONS = {
    folder: FolderIcon,
    heart: HeartIcon,
    star: StarIcon,
    home: HomeIcon,
} as const;

const FolderIconMap = (icon: string) => {
    const IconComponent = FOLDER_ICONS[icon as keyof typeof FOLDER_ICONS];
    return IconComponent || FolderIcon;
};

const FolderIconRenderer: React.FC<{ icon?: string | null; className?: string; style?: React.CSSProperties }> = ({
    icon,
    className,
    style,
}) => {
    const IconComponent = FolderIconMap(icon || 'folder');
    return <IconComponent className={className} style={style} />;
};

interface SortableServerCardProps {
    server: Server;
    index: number;
    renderServerCard: (server: Server, index: number) => React.ReactNode;
    updateFolder: React.Dispatch<React.SetStateAction<ServerFolder[]>>;
    folders: ServerFolder[];
    selectedServers: string[];
    selectServer: React.Dispatch<React.SetStateAction<string[]>>;
}

export default ({
    server,
    index,
    renderServerCard,
    updateFolder,
    folders,
    selectedServers,
    selectServer,
}: SortableServerCardProps) => {
    const { t } = useTranslation('arix/dashboard');
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: server.uuid });
    const currentFolder = folders.find((folder) => (folder.servers ? folder.servers.includes(server.uuid) : false));
    const [open, setOpen] = useState(false);
    const [selectedFolder, setSelectedFolder] = useState<number | null>(currentFolder?.id || null);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const handleFolderChange = () => {
        if (currentFolder?.id) {
            removeServerFromFolder(currentFolder.id, server.uuid);
            updateFolder((prev) =>
                prev.map((folder) => {
                    if (folder.id !== currentFolder.id) return folder;
                    const list = folder.servers ?? [];
                    return { ...folder, servers: list.filter((id) => id !== server.uuid) };
                })
            );
        }
        if (selectedFolder !== null) {
            const folderId = selectedFolder;
            const folderToUpdate = folders.find((folder) => folder.id === folderId);
            if (folderToUpdate) {
                addServerToFolder(folderId, server.uuid);
                updateFolder((prev) =>
                    prev.map((folder) => {
                        if (folder.id !== folderId) return folder;
                        const list = folder.servers ?? [];
                        return { ...folder, servers: [...list, server.uuid] };
                    })
                );
            }
        }

        setOpen(false);
    };

    const handleSelectServer = () => {
        selectServer((prev) =>
            prev.includes(server.uuid) ? prev.filter((id) => id !== server.uuid) : [...prev, server.uuid]
        );
    };

    return (
        <div ref={setNodeRef} style={style} className='relative group'>
            <Dialog open={open} onClose={() => setOpen(false)} title={'Move Server'} hideCloseIcon>
                <div className='space-y-1 rounded-component p-4 bg-gray-600'>
                    <button
                        key={'no-folder'}
                        onClick={() => setSelectedFolder(null)}
                        className={`flex items-center gap-x-2 w-full text-left px-3 py-2 rounded ${
                            selectedFolder === null ? 'bg-gray-500 text-white' : 'hover:bg-gray-500'
                        }`}
                    >
                        <div className='w-8 h-8 rounded flex items-center justify-center'>
                            <HomeIcon className='w-5 text-white' />
                        </div>
                        {t('folder.home')}
                        {!currentFolder?.id && (
                            <div className='px-2 py-1 rounded bg-gray-400 text-gray-100 text-sm font-medium ml-auto'>
                                {t('folder.current')}
                            </div>
                        )}
                    </button>
                    {folders.length > 0 ? (
                        folders.map((folder) => (
                            <button
                                key={folder.id}
                                onClick={() => setSelectedFolder(folder.id)}
                                className={`flex items-center gap-x-2 w-full text-left px-3 py-2 rounded ${
                                    selectedFolder === folder.id ? 'bg-gray-500 text-white' : 'hover:bg-gray-500'
                                }`}
                            >
                                <div
                                    className='w-8 h-8 rounded flex items-center justify-center'
                                    style={{ backgroundColor: `${folder?.color || '#FFFFFF'}40` }}
                                >
                                    <FolderIconRenderer
                                        icon={folder.icon}
                                        className='w-5'
                                        style={{ color: `${folder.color || '#FFFFFF'}` }}
                                    />
                                </div>
                                {folder.name}
                                {currentFolder?.id === folder.id && (
                                    <div className='px-2 py-1 rounded bg-gray-400 text-gray-100 text-sm font-medium ml-auto'>
                                        {t('folder.current')}
                                    </div>
                                )}
                            </button>
                        ))
                    ) : (
                        <p className='text-gray-400'>{t('folder.no-folders-available')}</p>
                    )}
                </div>
                <Dialog.Footer>
                    <Button.Text onClick={() => setOpen(false)}>Close</Button.Text>
                    <Button onClick={handleFolderChange}>{t('folder.move')}</Button>
                </Dialog.Footer>
            </Dialog>
            <div
                className={`absolute ${selectedServers.includes(server.uuid) ? 'opacity-100 top-0' : 'top-2 opacity-0'} 
                    left-0 w-full group-hover:top-0 group-hover:opacity-100 duration-300 z-10 flex 
                    bg-gray-500/60 backdrop-blur p-1 text-sm rounded-component !rounded-b-none`}
            >
                <button
                    onClick={handleSelectServer}
                    className='flex items-center gap-x-1 hover:bg-gray-400 py-1 p-2 rounded-component'
                >
                    {selectedServers.includes(server.uuid) ? (
                        <>
                            <CheckIcon className={`text-white w-5`} />
                            <span className='text-white'>{t('deselect')}</span>
                        </>
                    ) : (
                        <>
                            <XIcon className={`w-4`} />
                            <span>{t('select')}</span>
                        </>
                    )}
                </button>
                <button
                    onClick={() => setOpen(true)}
                    className='flex items-center gap-x-1 hover:bg-gray-400 py-1 p-2 rounded-component'
                >
                    <FolderIcon className='w-4' /> {t('move-folder')}
                </button>
                <button
                    type='button'
                    {...attributes}
                    {...listeners}
                    className='flex items-center gap-x-1 bg-gray-400 py-1 px-4 rounded-component cursor-move ml-auto'
                    aria-label='Drag server card'
                >
                    <RiDragMove2Fill className='w-5 h-5 text-gray-100' />
                </button>
            </div>
            <div>{renderServerCard(server, index)}</div>
        </div>
    );
};
