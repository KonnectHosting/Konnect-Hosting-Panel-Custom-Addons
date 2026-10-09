import React, { useEffect, useState } from 'react';
import { Server } from '@/api/server/getServer';
import { ApplicationStore } from '@/state';
import getServers from '@/api/getServers';
import ServerCard from '@/components/dashboard/dashboard/ServerCard';
import ServerCardBanner from '@/components/dashboard/dashboard/ServerCardBanner';
import ServerCardGradient from '@/components/dashboard/dashboard/ServerCardGradient';
import LinearCardBanner from '@/components/dashboard/dashboard/LinearCardBanner';
import Spinner from '@/components/elements/Spinner';
import PageContentBlock from '@/components/elements/PageContentBlock';
import useFlash from '@/plugins/useFlash';
import { useStoreState } from 'easy-peasy';
import { usePersistedState } from '@/plugins/usePersistedState';
import Switch from '@/components/elements/Switch';
import tw from 'twin.macro';
import useSWR from 'swr';
import { PaginatedResult } from '@/api/http';
import Pagination from '@/components/elements/Pagination';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    useDroppable,
    pointerWithin,
    MeasuringStrategy,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { getServerOrder, updateServerOrder } from '@/api/serverOrder';
import { addServerToFolder, getServerFolders, removeServerFromFolder, ServerFolder } from '@/api/serverFolders';
import GreyRowBox from '../../elements/GreyRowBox';
import { FolderIcon, HeartIcon, HomeIcon, StarIcon } from '@heroicons/react/outline';
import MassAction from './MassAction';
import SocialButton from './SocialButton';
import DiscordWidget from './DiscordWidget';
import { DeleteFolderDialog, EditOrUpdateFolderDialog } from './FolderDialogs';
import SortableServerCard from './SortableServerCard';
import ServerCardMinimal from './ServerCardMinimal';
import ServerCardCompact from './ServerCardCompact';

// Prevent ResizeObserver "loop completed" warnings caused by rapid observation cycles
if (typeof window !== 'undefined') {
    const _RO = window.ResizeObserver;
    window.ResizeObserver = class extends _RO {
        constructor(cb: ResizeObserverCallback) {
            super((entries, observer) => requestAnimationFrame(() => cb(entries, observer)));
        }
    };
}

const SERVER_CARD_COMPONENTS = {
    default: ServerCardGradient,
    banner: ServerCardBanner,
    flat: ServerCard,
    linear: LinearCardBanner,
    minimal: ServerCardMinimal,
    compact: ServerCardCompact,
} as const;

const CARD_BASE_CLASS = 'bg-gray-700 backdrop boxBorder rounded-box';

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

interface DiscordGuildData {
    instant_invite: string;
    presence_count: number;
}

const useDiscordGuildData = (guildId: string | undefined): DiscordGuildData | null => {
    const [guildData, setGuildData] = useState<DiscordGuildData | null>(null);

    useEffect(() => {
        if (!guildId) return;

        const fetchGuildData = async () => {
            try {
                const response = await fetch(`https://discord.com/api/guilds/${guildId}/widget.json`);
                if (!response.ok) throw new Error('Failed to fetch guild data');
                const data = await response.json();
                setGuildData(data);
            } catch (error) {
                console.error('Error fetching guild data:', error);
            }
        };

        fetchGuildData();
    }, [guildId]);

    return guildData;
};

const saveServerOrder = async (servers: Server[]): Promise<void> => {
    const order = servers.map((server) => server.uuid);
    try {
        const previousOrder = await getServerOrder();
        const newOrder = [...order, ...previousOrder.filter((id) => !order.includes(id))];
        await updateServerOrder({ server_ordered: newOrder });
    } catch (error) {
        console.error('Failed to save server order:', error);
    }
};

const applyStoredOrder = (servers: Server[], storedOrder: string[]): Server[] => {
    const currentServerIds = servers.map((server) => server.uuid);
    const validStoredOrder = storedOrder.filter((id) => currentServerIds.includes(id));
    if (validStoredOrder.length > 0 && validStoredOrder.length === currentServerIds.length) {
        return validStoredOrder.map((id) => servers.find((server) => server.uuid === id)!);
    }
    return [...servers];
};

const filterServersByFolder = (
    servers: Server[],
    folders: ServerFolder[],
    selectedFolderId: number | null
): Server[] => {
    if (selectedFolderId !== null) {
        const selectedFolder = folders.find((f) => f.id === selectedFolderId);
        if (!selectedFolder) return [];

        return servers.filter((server) =>
            selectedFolder.servers ? selectedFolder.servers.includes(server.uuid) : false
        );
    } else {
        const allServerUuidsInFolders = new Set(folders.flatMap((folder) => folder.servers?.map(String) || []));

        return servers.filter((server) => !allServerUuidsInFolders.has(server.uuid));
    }
};

const DroppableFolder: React.FC<{ id: string; className?: string; children: React.ReactNode }> = ({
    id,
    className,
    children,
}) => {
    const { setNodeRef, isOver } = useDroppable({ id });

    return (
        <div ref={setNodeRef} className={`relative ${className ?? ''}`}>
            {children}
            {isOver && (
                <div className='pointer-events-none absolute inset-0 rounded-[inherit] outline outline-2 outline-arix' />
            )}
        </div>
    );
};

export default () => {
    const { t } = useTranslation('arix/dashboard');
    const { search } = useLocation();
    const defaultPage = Number(new URLSearchParams(search).get('page') || '1');

    const [page, setPage] = useState(!isNaN(defaultPage) && defaultPage > 0 ? defaultPage : 1);
    const [sortedServers, setSortedServers] = useState<Server[]>([]);
    const [storedOrder, setStoredOrder] = useState<string[] | null>(null);
    const [foldersLoaded, setFoldersLoaded] = useState(false);
    const [selectedServers, setSelectedServers] = useState<string[]>([]);

    const { clearFlashes, clearAndAddHttpError } = useFlash();

    const uuid = useStoreState((state) => state.user.data!.uuid);
    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const discordId = useStoreState((state: ApplicationStore) => state.settings.data!.arix.general.discord);
    const { discordBox, socialButtons, socials } = useStoreState(
        (state: ApplicationStore) => state.settings.data!.arix.social
    );

    const serverRow = useStoreState((state: ApplicationStore) => state.settings.data!.arix.components.serverRow);

    const [showOnlyAdmin, setShowOnlyAdmin] = usePersistedState(`${uuid}:show_all_servers`, false);
    const [folders, setFolders] = useState<ServerFolder[]>([]);
    const [folder, setFolder] = useState<number | null>(null);

    useEffect(() => {
        setSelectedServers([]);
    }, [folder, showOnlyAdmin, page]);

    useEffect(() => {
        const fetchFolders = async () => {
            try {
                const data = await getServerFolders();
                setFolders(data.map((f) => ({ ...f, servers: f.servers ?? [] })));
                setFoldersLoaded(true);
            } catch (error) {
                console.error('Failed to fetch server folders:', error);
            }
        };

        fetchFolders();
    }, []);

    useEffect(() => {
        getServerOrder()
            .then(setStoredOrder)
            .catch((e) => console.error('Failed to load server order:', e));
    }, []);

    const { data: servers, error } = useSWR<PaginatedResult<Server>>(
        ['/api/client/servers', showOnlyAdmin && rootAdmin, page],
        () => getServers({ page, type: showOnlyAdmin && rootAdmin ? 'admin' : undefined })
    );

    const guildData = useDiscordGuildData(discordId);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        if (!servers?.items || !foldersLoaded || storedOrder === null) {
            return;
        }

        const updateSortedServers = () => {
            const filtered = filterServersByFolder(servers.items, folders, folder);
            const sorted = applyStoredOrder(filtered, storedOrder);
            setSortedServers(sorted);
        };

        updateSortedServers();
    }, [servers?.items, folders, folder, foldersLoaded, storedOrder]);

    useEffect(() => {
        if (!servers) return;
        if (servers.pagination.currentPage > 1 && !servers.items.length) {
            setPage(1);
        }
    }, [servers?.pagination.currentPage]);

    useEffect(() => {
        const hash = window.location.hash || '';
        window.history.replaceState(null, document.title, `/${page <= 1 ? '' : `?page=${page}`}${hash}`);
    }, [page]);

    useEffect(() => {
        if (error) {
            clearAndAddHttpError({ key: 'dashboard', error });
        } else {
            clearFlashes('dashboard');
        }
    }, [error]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const overId = String(over.id);
        if (overId.startsWith('folder:')) {
            const serverUuid = String(active.id);
            const targetFolderId = overId === 'folder:home' ? null : parseInt(overId.split(':')[1]);
            const currentFolder = folders.find((f) => f.servers?.includes(serverUuid));

            if (currentFolder) {
                removeServerFromFolder(currentFolder.id, serverUuid);
                setFolders((prev) =>
                    prev.map((f) =>
                        f.id !== currentFolder.id
                            ? f
                            : { ...f, servers: (f.servers ?? []).filter((id) => id !== serverUuid) }
                    )
                );
            }

            if (targetFolderId !== null) {
                addServerToFolder(targetFolderId, serverUuid);
                setFolders((prev) =>
                    prev.map((f) =>
                        f.id !== targetFolderId ? f : { ...f, servers: [...(f.servers ?? []), serverUuid] }
                    )
                );
            }
            return;
        }

        if (active.id !== over.id) {
            setSortedServers((items) => {
                const oldIndex = items.findIndex((item) => item.uuid === active.id);
                const newIndex = items.findIndex((item) => item.uuid === over?.id);
                const newOrder = arrayMove(items, oldIndex, newIndex);
                saveServerOrder(newOrder);
                return newOrder;
            });
        }
    };

    const renderServerCard = (server: Server, index: number) => {
        const cardProps = {
            key: server.uuid,
            server,
            css: index > 0 ? tw`mt-2` : undefined,
            count: index,
        };

        const ServerCardComponent =
            SERVER_CARD_COMPONENTS[serverRow as keyof typeof SERVER_CARD_COMPONENTS] || ServerCard;
        return <ServerCardComponent {...cardProps} />;
    };

    return (
        <PageContentBlock title={'Dashboard'} showFlashKey={'dashboard'}>
            {socialButtons && (
                <div className={'flex lg:gap-4 gap-2 lg:flex-row flex-col mb-4'}>
                    {socials.map((social, index) => (
                        <SocialButton key={index} social={social} index={index} />
                    ))}
                </div>
            )}

            <div className={'flex gap-4 md:flex-nowrap flex-wrap mb-6'}>
                <div className={`${CARD_BASE_CLASS} px-6 py-5 w-full flex items-center justify-between`}>
                    <div>
                        <p className={'text-gray-50'}>{t('welcome-back')}</p>
                        <p className={'font-light'}>{t('all-servers-you-have-access-to')}</p>
                    </div>
                    {rootAdmin && (
                        <div css={tw`flex justify-end items-center`}>
                            <p css={tw`uppercase text-xs text-neutral-400 mr-2`}>
                                {showOnlyAdmin ? t('others-servers') : t('your-servers')}
                            </p>
                            <Switch
                                name={'show_all_servers'}
                                defaultChecked={showOnlyAdmin}
                                onChange={() => setShowOnlyAdmin((s) => !s)}
                            />
                        </div>
                    )}
                </div>

                {discordBox && <DiscordWidget guildData={guildData} t={t} />}
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                onDragEnd={handleDragEnd}
                measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
            >
                <div className={`flex items-center gap-1 text-sm mb-3`}>
                    {folder === null ? (
                        <p className='px-1 py-0.5 text-white'>{t('folder.home')}</p>
                    ) : (
                        <DroppableFolder id={'folder:home'} className={'rounded'}>
                            <button onClick={() => setFolder(null)} className='px-1 py-0.5 rounded hover:bg-gray-500'>
                                {t('folder.home')}
                            </button>
                        </DroppableFolder>
                    )}
                    {(() => {
                        const path: number[] = [];
                        let current = folders.find((f) => f.id === folder);
                        while (current) {
                            path.unshift(current.id);
                            if (current.parent_id === null) break;
                            current = folders.find((f) => f.id === current?.parent_id);
                        }
                        return path.map((id: number, idx: number) => (
                            <React.Fragment key={idx}>
                                <span>/</span>
                                {folder === id ? (
                                    <span className='px-1 py-0.5 rounded text-white'>
                                        {folders.find((f) => f.id === id)?.name || 'Unknown'}
                                    </span>
                                ) : (
                                    <DroppableFolder id={`folder:${id}`} className={'rounded'}>
                                        <button
                                            onClick={() => setFolder(id)}
                                            className='px-1 py-0.5 rounded hover:bg-gray-500'
                                        >
                                            {folders.find((f) => f.id === id)?.name || 'Unknown'}
                                        </button>
                                    </DroppableFolder>
                                )}
                            </React.Fragment>
                        ));
                    })()}
                    <span>/</span>
                    <EditOrUpdateFolderDialog currentFolder={folder || undefined} updateFolders={setFolders} />
                </div>

                {foldersLoaded && folders.filter((folderItem) => folderItem.parent_id === folder).length > 0 && (
                    <div className={'mb-6 grid xl:grid-cols-4 md:grid-cols-3 gap-4'}>
                        {folders.length > 0 && (
                            <>
                                {folders
                                    .filter((folderItem) => folderItem.parent_id === folder)
                                    .map((folderItem) => (
                                        <DroppableFolder
                                            key={folderItem.id}
                                            id={`folder:${folderItem.id}`}
                                            className={'rounded-box'}
                                        >
                                            <GreyRowBox key={folderItem.id} className='!p-0 !pr-5' $hoverable>
                                                <button
                                                    onClick={() => setFolder(folderItem.id)}
                                                    className='flex-1 text-left flex items-center gap-x-4 p-4'
                                                >
                                                    <div
                                                        className='w-10 h-10 rounded flex items-center justify-center'
                                                        style={{
                                                            backgroundColor: `${folderItem?.color || '#FFFFFF'}40`,
                                                        }}
                                                    >
                                                        <FolderIconRenderer
                                                            icon={folderItem.icon}
                                                            className='w-6'
                                                            style={{ color: `${folderItem.color || '#FFFFFF'}` }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <p>{folderItem.name}</p>
                                                        <p className='text-sm text-gray-300'>
                                                            {folderItem.servers?.length || 0} Servers
                                                        </p>
                                                    </div>
                                                </button>
                                                <div className='flex items-center gap-x-2'>
                                                    <EditOrUpdateFolderDialog
                                                        folder={folderItem}
                                                        updateFolders={setFolders}
                                                    />
                                                    <DeleteFolderDialog
                                                        folderId={folderItem.id}
                                                        updateFolders={setFolders}
                                                    />
                                                </div>
                                            </GreyRowBox>
                                        </DroppableFolder>
                                    ))}
                            </>
                        )}
                    </div>
                )}
                <MassAction
                    servers={selectedServers}
                    setServers={setSelectedServers}
                    folders={folders}
                    updateFolder={setFolders}
                />
                {!servers ? (
                    <Spinner centered size={'large'} />
                ) : (
                    <Pagination data={servers} onPageSelect={setPage}>
                        {({ items }) => {
                            if (items.length === 0) {
                                return (
                                    <p css={tw`text-center text-sm text-neutral-400 lg:col-span-2 col-span-1`}>
                                        {showOnlyAdmin
                                            ? t('there-are-no-servers')
                                            : t('there-are-no-servers-associated')}
                                    </p>
                                );
                            }
                            const displayList = storedOrder === null || !foldersLoaded ? items : sortedServers;
                            return (
                                <SortableContext
                                    items={displayList.map((server) => server.uuid)}
                                    strategy={rectSortingStrategy}
                                >
                                    <div
                                        className={`grid ${
                                            serverRow === 'linear' || serverRow === 'minimal'
                                                ? 'grid-cols-1'
                                                : 'lg:grid-cols-2'
                                        } gap-4`}
                                    >
                                        {displayList.map((server, index) => (
                                            <SortableServerCard
                                                key={server.uuid}
                                                server={server}
                                                index={index}
                                                renderServerCard={renderServerCard}
                                                updateFolder={setFolders}
                                                folders={folders}
                                                selectedServers={selectedServers}
                                                selectServer={setSelectedServers}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            );
                        }}
                    </Pagination>
                )}
            </DndContext>
        </PageContentBlock>
    );
};
