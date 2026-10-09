import React, { useEffect, useMemo, useState } from 'react';
import { ChipIcon } from '@heroicons/react/outline';
import { LuSave, LuMemoryStick } from 'react-icons/lu';
import { bytesToString, ip, mbToBytes } from '@/lib/formatters';
import { ServerContext } from '@/state/server';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import { useTranslation } from 'react-i18next';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';

type Stats = Record<'memory' | 'cpu' | 'disk', number>;

const Icon = ({ type, className, size }: { type: string; className?: string; size?: string }) => {
    return (
        <div className={`${className} text-white bg-arix flex items-center justify-center`}>
            {type == 'cpu' ? (
                <ChipIcon className={size === 'large' ? 'w-10' : 'w-5'} />
            ) : type == 'disk' ? (
                <LuSave className={size === 'large' ? 'text-[2.5rem]' : 'w-5'} />
            ) : (
                <LuMemoryStick className={size === 'large' ? 'text-[2.5rem]' : 'text-[1.25rem]'} />
            )}
        </div>
    );
};

const StatsBlock = ({ title, usage, limit, alwaysShow, type }: any) => {
    const { t } = useTranslation('arix/utilities');
    const status = ServerContext.useStoreState((state) => state.status.value);
    const { statsStyle } = useStoreState((state: ApplicationStore) => state.settings.data!.arix.components);

    return (
        <div
            className={`bg-gray-700 backdrop boxBorder rounded-box px-6 py-5 flex ${
                statsStyle.includes('minimal') ? '' : 'items-center'
            }`}
        >
            {statsStyle === 'reversed' && (
                <Icon type={type} className={'mr-4 w-16 h-16 rounded-component'} size={'large'} />
            )}
            <div>
                <div className={'text-gray-300 flex items-center'}>
                    {statsStyle === 'minimalReversed' && (
                        <Icon type={type} className={'mr-2 w-8 h-8 rounded-md'} size={'small'} />
                    )}
                    {title}:
                </div>
                <div className={'flex items-center gap-x-1'}>
                    {alwaysShow || status !== 'offline' ? (
                        <p className={'text-lg font-medium'}>{usage}</p>
                    ) : (
                        <p>{t('offline')}</p>
                    )}
                    <span className={'text-gray-300 font-medium'}>/ {limit}</span>
                </div>
            </div>
            {statsStyle === 'default' && (
                <Icon type={type} className={'ml-auto w-16 h-16 rounded-component'} size={'large'} />
            )}
            {statsStyle === 'minimal' && <Icon type={type} className={'ml-auto w-8 h-8 rounded-md'} size={'small'} />}
        </div>
    );
};

const ServerDetailsBlock = () => {
    const { t } = useTranslation('arix/utilities');
    const [stats, setStats] = useState<Stats>({ memory: 0, cpu: 0, disk: 0 });

    const status = ServerContext.useStoreState((state) => state.status.value);
    const connected = ServerContext.useStoreState((state) => state.socket.connected);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);
    const limits = ServerContext.useStoreState((state) => state.server.data!.limits);

    const textLimits = useMemo(
        () => ({
            cpu: limits?.cpu ? `${limits.cpu}%` : <>&infin;</>,
            memory: limits?.memory ? bytesToString(mbToBytes(limits.memory)) : <>&infin;</>,
            disk: limits?.disk ? bytesToString(mbToBytes(limits.disk)) : <>&infin;</>,
        }),
        [limits]
    );

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
        });
    });

    return (
        <>
            <div className={'grid md:grid-cols-3 gap-4'}>
                <StatsBlock
                    title={t('cpu-usage')}
                    usage={stats.cpu.toFixed(2) + '%'}
                    limit={textLimits.cpu}
                    alwaysShow={true}
                    type={'cpu'}
                />
                <StatsBlock
                    title={t('memory-usage')}
                    usage={bytesToString(stats.memory)}
                    limit={textLimits.memory}
                    alwaysShow={true}
                    type={'memory'}
                />
                <StatsBlock
                    title={t('disk-usage')}
                    usage={bytesToString(stats.disk)}
                    limit={textLimits.disk}
                    alwaysShow={true}
                    type={'disk'}
                />
            </div>
        </>
    );
};

export default ServerDetailsBlock;
