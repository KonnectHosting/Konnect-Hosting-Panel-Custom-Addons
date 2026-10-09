import React, { useEffect, useState, useMemo } from 'react';
import { ApplicationStore } from '@/state';
import { ServerContext } from '@/state/server';
import { useStoreState } from 'easy-peasy';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import PowerButtons from '@/components/server/console/PowerButtons';
import CopyOnClick from '@/components/elements/CopyOnClick';
import { GlobeIcon, ChipIcon, ChevronDownIcon } from '@heroicons/react/outline';
import { LuClock, LuMemoryStick } from 'react-icons/lu';
import Can from '@/components/elements/Can';
import { bytesToString, ip, mbToBytes } from '@/lib/formatters';
import { useTranslation } from 'react-i18next';
import tw from 'twin.macro';
import Badge from '@/components/elements/Badge';
import UptimeDuration from '@/components/server/UptimeDuration';

type Stats = Record<'memory' | 'cpu' | 'disk' | 'uptime', number>;

const SlimBar = () => {
    const [stats, setStats] = useState<Stats>({ memory: 0, cpu: 0, disk: 0, uptime: 0 });
    const [toggleStats, setToggleStats] = useState<boolean>(false);

    const { t } = useTranslation(['arix/utilities', 'arix/navigation']);

    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const layout = useStoreState((state: ApplicationStore) => state.settings.data!.arix.layout.layout);

    const name = ServerContext.useStoreState((state) => state.server.data?.name);
    const status = ServerContext.useStoreState((state) => state.status.value);
    const connected = ServerContext.useStoreState((state) => state.socket.connected);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);
    const limits = ServerContext.useStoreState((state) => state.server.data!.limits);
    const serverId = ServerContext.useStoreState((state) => state.server.data?.internalId);

    const textLimits = useMemo(
        () => ({
            cpu: limits?.cpu ? `${limits.cpu}%` : <>&infin;</>,
            memory: limits?.memory ? bytesToString(mbToBytes(limits.memory)) : <>&infin;</>,
            disk: limits?.disk ? bytesToString(mbToBytes(limits.disk)) : <>&infin;</>,
        }),
        [limits]
    );

    const allocation = ServerContext.useStoreState((state) => {
        const match = state.server.data?.allocations.find((allocation) => allocation.isDefault);

        return !match ? 'n/a' : `${match.alias || ip(match.ip)}:${match.port}`;
    });

    useEffect(() => {
        if (!connected || !instance) {
            return;
        }

        instance.send(SocketRequest.SEND_STATS);
    }, [instance, connected]);

    useWebsocketEvent(SocketEvent.STATS, (data) => {
        let stats: any = {};
        try {
            stats = JSON.parse(data);
        } catch (e) {
            return;
        }

        setStats({
            memory: stats.memory_bytes,
            cpu: stats.cpu_absolute,
            disk: stats.disk_bytes,
            uptime: stats.uptime || 0,
        });
    });

    return (
        <div className={`relative px-4 z-10 bg-gray-700 backdrop boxBorder !border-t-0 !border-x-0`}>
            <div className={`mx-auto w-full flex items-center justify-between max-w-[1200px] py-3`}>
                <div>
                    <div className={'flex items-center gap-x-6'}>
                        <div className='flex items-center gap-x-2'>
                            <p className={'text-lg font-semibold text-gray-50'}>{name}</p>
                            <Badge
                                color={
                                    status === 'offline' || status === 'stopping'
                                        ? 'danger'
                                        : status === 'running'
                                        ? 'success'
                                        : 'warning'
                                }
                            >
                                {status === 'offline'
                                    ? t('offline', { ns: 'arix/utilities' })
                                    : status === 'running'
                                    ? t('online', { ns: 'arix/utilities' })
                                    : status === 'starting'
                                    ? t('starting', { ns: 'arix/utilities' })
                                    : status === 'stopping'
                                    ? t('stopping', { ns: 'arix/utilities' })
                                    : ''}
                            </Badge>
                        </div>
                        <CopyOnClick text={allocation}>
                            <div
                                className={
                                    'flex items-center gap-x-1 py-1 privacy:blur-sm hover:privacy:blur-none duration-300'
                                }
                            >
                                <GlobeIcon className={'w-5 text-gray-300'} />
                                {allocation}
                            </div>
                        </CopyOnClick>
                        <div className={'flex items-center gap-x-1 py-1'}>
                            <ChipIcon className={'w-5 text-gray-300'} />
                            {status !== 'offline' ? <span>{stats.cpu.toFixed(2)}%</span> : '0%'}
                            <span className={'text-sm text-gray-300'}>/ {textLimits.cpu}</span>
                        </div>
                        <div className={'flex items-center gap-x-1'}>
                            <LuMemoryStick className={'w-5 text-[2rem] text-gray-300'} />
                            {status !== 'offline' ? <span>{bytesToString(stats.memory)}</span> : '0 GiB'}
                            <span className={'text-sm text-gray-300'}>/ {textLimits.memory}</span>
                        </div>
                        {status === null && stats.uptime > 0 && (
                            <div className={'flex items-center gap-x-1'}>
                                <LuClock className={'w-5 text-[2rem] text-gray-300'} />
                                <span>
                                    <UptimeDuration uptime={stats.uptime / 1000} />
                                </span>
                            </div>
                        )}
                    </div>
                    <div
                        className={'md:hidden flex items-center gap-x-1 text-gray-300 cursor-pointer'}
                        onClick={() => setToggleStats(!toggleStats)}
                    >
                        <span>Server stats</span>
                        <ChevronDownIcon className={`w-4 duration-300 ${toggleStats ? 'rotate-180' : ''}`} />
                    </div>
                </div>
                <Can action={['control.start', 'control.stop', 'control.restart']} matchAny>
                    <PowerButtons className='md:grid grid-cols-3 gap-2 hidden' icons />
                </Can>
            </div>
        </div>
    );
};
export default SlimBar;
