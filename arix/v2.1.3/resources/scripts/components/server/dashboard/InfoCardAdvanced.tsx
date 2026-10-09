import React, { useState } from 'react';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import { ServerContext } from '@/state/server';
import CopyOnClick from '@/components/elements/CopyOnClick';
import { ip } from '@/lib/formatters';
import { SocketEvent } from '@/components/server/events';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import UptimeDuration from '@/components/server/UptimeDuration';
import { HashtagIcon, ServerIcon } from '@heroicons/react/outline';
import { useTranslation } from 'react-i18next';
import Badge from '@/components/elements/Badge';

type Stats = Record<'uptime', number>;

const InfoCardAdvanced = () => {
    const { t } = useTranslation(['arix/server/dashboard', 'arix/utilities']);
    const [stats, setStats] = useState<Stats>({ uptime: 0 });

    const status = ServerContext.useStoreState((state) => state.status.value);
    const node = ServerContext.useStoreState((state) => state.server.data!.node);
    const nodeIcon = ServerContext.useStoreState((state) => state.server.data!.nodeIcon);
    const id = ServerContext.useStoreState((state) => state.server.data!.id);

    const hostname = ServerContext.useStoreState((state) => {
        const match = state.server.data?.allocations.find((allocation) => allocation.isDefault);

        return !match ? 'n/a' : `${match.alias || ip(match.ip)}:${match.port}`;
    });

    const allocation = ServerContext.useStoreState((state) => {
        const match = state.server.data?.allocations.find((allocation) => allocation.isDefault);

        return !match ? 'n/a' : `${match.ip}`;
    });

    useWebsocketEvent(SocketEvent.STATS, (data) => {
        let stats: any = {};
        try {
            stats = JSON.parse(data);
        } catch (e) {
            return;
        }

        setStats({
            uptime: stats.uptime || 0,
        });
    });

    return (
        <TitledGreyBox title={t('server-info.title')}>
            <div className={'grid grid-cols-2 pb-4 border-b-2 border-gray-600'}>
                <span className={'text-gray-300'}>{t('status', { ns: 'arix/utilities' })}:</span>
                <p>
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
                </p>
            </div>
            <div className={'grid grid-cols-2 py-4 border-b-2 border-gray-600'}>
                <span className={'text-gray-300'}>{t('server-info.uptime')}:</span>
                {status === null ? (
                    t('offline', { ns: 'arix/utilities' })
                ) : stats.uptime > 0 ? (
                    <UptimeDuration uptime={stats.uptime / 1000} />
                ) : (
                    <div className={'capitalize'}>{status}</div>
                )}
            </div>
            <div className={'grid grid-cols-2 py-4 border-b-2 border-gray-600'}>
                <span className={'text-gray-300'}>{t('server-info.hostname')}:</span>
                <CopyOnClick text={hostname}>
                    <p className='privacy:blur-sm hover:privacy:blur-none duration-300'>{hostname}</p>
                </CopyOnClick>
            </div>
            <div className={'grid grid-cols-2 py-4 border-b-2 border-gray-600'}>
                <span className={'text-gray-300'}>{t('server-info.server-ip')}:</span>
                <CopyOnClick text={allocation}>
                    <p className='privacy:blur-sm hover:privacy:blur-none duration-300'>{allocation}</p>
                </CopyOnClick>
            </div>
            <div className={'grid grid-cols-2 py-4 border-b-2 border-gray-600'}>
                <span className={'text-gray-300'}>{t('server-info.node-id')}:</span>
                <CopyOnClick text={node}>
                    <div className={'flex items-center gap-x-1'}>
                        {nodeIcon ? (
                            <img src={nodeIcon} alt={node} className={'w-5 h-5 object-cover rounded-sm'} />
                        ) : (
                            <ServerIcon className={'w-5 text-gray-300'} />
                        )}
                        {node}
                    </div>
                </CopyOnClick>
            </div>
            <div className={'grid grid-cols-2 pt-4'}>
                <span className={'text-gray-300'}>{t('server-info.server-id')}:</span>
                <CopyOnClick text={id}>
                    <div className={'flex items-center gap-x-1'}>
                        <HashtagIcon className={'w-5 text-gray-300'} />
                        {id}
                    </div>
                </CopyOnClick>
            </div>
        </TitledGreyBox>
    );
};
export default InfoCardAdvanced;
