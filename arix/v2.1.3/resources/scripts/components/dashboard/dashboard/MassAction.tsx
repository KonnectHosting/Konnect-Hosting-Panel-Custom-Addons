import React, { useState } from 'react';
import { Button } from '@/components/elements/button/index';
import { Dialog } from '@/components/elements/dialog';
import {
    ArchiveIcon,
    FolderIcon,
    HeartIcon,
    HomeIcon,
    PlayIcon,
    RefreshIcon,
    StarIcon,
    StopIcon,
    TerminalIcon,
    XIcon,
} from '@heroicons/react/outline';
import powerAction, { sendCommand } from '@/api/server/powerAction';
import createServerBackup from '@/api/server/backups/createServerBackup';
import useFlash from '@/plugins/useFlash';
import FlashMessageRender from '@/components/FlashMessageRender';
import { ServerFolder, addServerToFolder, removeServerFromFolder } from '@/api/serverFolders';
import Input from '@/components/elements/Input';
import Label from '@/components/elements/Label';
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

export default ({
    servers,
    setServers,
    folders,
    updateFolder,
}: {
    servers: string[];
    setServers: React.Dispatch<React.SetStateAction<string[]>>;
    folders: ServerFolder[];
    updateFolder: React.Dispatch<React.SetStateAction<ServerFolder[]>>;
}) => {
    const { t } = useTranslation('arix/dashboard');
    const { clearFlashes, addFlash } = useFlash();
    const [moveFolderOpen, setMoveFolderOpen] = useState(false);
    const [selectedFolder, setSelectedFolder] = useState<number | null>(null);
    const [sendCommandOpen, setSendCommandOpen] = useState(false);
    const [command, setCommand] = useState('');

    const PowerAction = (action: string) => {
        clearFlashes('dashboard:mass-action');
        servers.forEach((uuid) => {
            powerAction(uuid, action);
        });
        addFlash({
            key: 'dashboard:mass-action',
            type: 'success',
            message: `Sent ${action} signal to ${servers.length} server(s).`,
        });
        setServers([]);
    };

    const CreateBackups = () => {
        clearFlashes('dashboard:mass-action');
        servers.forEach((uuid) => {
            createServerBackup(uuid, {
                isLocked: false,
            });
        });
        addFlash({
            key: 'dashboard:mass-action',
            type: 'success',
            message: `Creating backup for ${servers.length} server(s).`,
        });
        setServers([]);
    };

    const handleFolderChange = () => {
        servers.forEach((uuid) => {
            const currentFolder = folders.find((folder) => (folder.servers ? folder.servers.includes(uuid) : false));

            if (currentFolder?.id) {
                removeServerFromFolder(currentFolder.id, uuid);
                updateFolder((prev) =>
                    prev.map((folder) => {
                        if (folder.id !== currentFolder.id) return folder;
                        const list = folder.servers ?? [];
                        return { ...folder, servers: list.filter((id) => id !== uuid) };
                    })
                );
            }

            if (selectedFolder !== null) {
                const folderId = selectedFolder;
                const folderToUpdate = folders.find((folder) => folder.id === folderId);
                if (folderToUpdate) {
                    addServerToFolder(folderId, uuid);
                    updateFolder((prev) =>
                        prev.map((folder) => {
                            if (folder.id !== folderId) return folder;
                            const list = folder.servers ?? [];
                            return { ...folder, servers: [...list, uuid] };
                        })
                    );
                }
            }
        });

        clearFlashes('dashboard:mass-action');
        addFlash({ key: 'dashboard:mass-action', type: 'success', message: `Moved ${servers.length} server(s).` });
        setMoveFolderOpen(false);
        setServers([]);
    };

    const handleSendCommand = () => {
        clearFlashes('dashboard:mass-action');
        servers.forEach((uuid) => {
            sendCommand(uuid, command);
        });
        addFlash({
            key: 'dashboard:mass-action',
            type: 'success',
            message: `Sent command to ${servers.length} server(s).`,
        });
        setSendCommandOpen(false);
        setCommand('');
        setServers([]);
    };

    return (
        <>
            <FlashMessageRender byKey={'dashboard:mass-action'} className='mb-4' />
            <Dialog open={moveFolderOpen} onClose={() => setMoveFolderOpen(false)} title={'Move Servers'} hideCloseIcon>
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
                            </button>
                        ))
                    ) : (
                        <p className='text-gray-400'>{t('folder.no-folders-available')}</p>
                    )}
                </div>
                <Dialog.Footer>
                    <Button.Text onClick={() => setMoveFolderOpen(false)}>Close</Button.Text>
                    <Button onClick={handleFolderChange}>{t('folder.move')}</Button>
                </Dialog.Footer>
            </Dialog>
            <Dialog
                open={sendCommandOpen}
                onClose={() => setSendCommandOpen(false)}
                title={'Send Command'}
                hideCloseIcon
            >
                <div className='space-y-4'>
                    <div>
                        <Label htmlFor='mass-action-command'>{t('command')}</Label>
                        <Input
                            id='mass-action-command'
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            placeholder='Command'
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && command.length > 0) {
                                    handleSendCommand();
                                }
                            }}
                        />
                    </div>
                </div>
                <Dialog.Footer>
                    <Button.Text onClick={() => setSendCommandOpen(false)}>Close</Button.Text>
                    <Button onClick={handleSendCommand} disabled={command.length === 0}>
                        {t('send')}
                    </Button>
                </Dialog.Footer>
            </Dialog>
            <div
                className={`sticky w-full left-0 top-3 z-50 duration-300
                ${servers.length > 0 ? 'h-auto pb-3 opacity-100' : 'h-0 pb-0 opacity-0 pointer-events-none'}
            `}
            >
                <div className='bg-gray-600 backdrop boxBorder p-3 flex flex-wrap items-center gap-x-2 rounded-box'>
                    <Button.Success size={Button.Sizes.Small} onClick={() => PowerAction('start')} className='gap-x-1'>
                        <PlayIcon className='w-4' />
                        {t('start')}
                    </Button.Success>
                    <Button.Text size={Button.Sizes.Small} onClick={() => PowerAction('restart')} className='gap-x-1'>
                        <RefreshIcon className='w-4' />
                        {t('restart')}
                    </Button.Text>
                    <Button.Danger size={Button.Sizes.Small} onClick={() => PowerAction('stop')} className='gap-x-1'>
                        <StopIcon className='w-4' />
                        {t('stop')}
                    </Button.Danger>
                    <div className='w-[1px] h-4 bg-gray-400' />
                    <Button.Text size={Button.Sizes.Small} onClick={() => setMoveFolderOpen(true)} className='gap-x-1'>
                        <FolderIcon className='w-4' />
                        {t('move-folder')}
                    </Button.Text>
                    <Button.Text size={Button.Sizes.Small} onClick={() => setSendCommandOpen(true)} className='gap-x-1'>
                        <TerminalIcon className='w-4' />
                        {t('send-command')}
                    </Button.Text>
                    <Button.Text size={Button.Sizes.Small} onClick={CreateBackups} className='gap-x-1'>
                        <ArchiveIcon className='w-4' />
                        {t('create-backup')}
                    </Button.Text>
                    <div className='w-[1px] h-4 bg-gray-400 ml-auto' />
                    <button
                        className='cursor-pointer whitespace-nowrap text-sm flex items-center gap-x-1'
                        onClick={() => setServers([])}
                    >
                        <XIcon className='w-4' /> {t('deselect-all')}
                    </button>
                </div>
            </div>
        </>
    );
};
