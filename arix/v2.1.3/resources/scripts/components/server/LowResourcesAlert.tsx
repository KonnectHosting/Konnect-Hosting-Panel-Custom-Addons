import React, { useEffect, useMemo, useState } from 'react';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { ServerContext } from '@/state/server';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import { Button } from '@/components/elements/button/index';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import { ExclamationIcon } from '@heroicons/react/outline';
import { useTranslation } from 'react-i18next';

type Stats = Record<'memory' | 'cpu' | 'disk' | 'uptime', number>;

const getBackgroundColor = (value: number, uptime: number | null, max: number | null): string | undefined => {
    const delta = !max ? 0 : value / max;
    const running = !uptime ? 0 : uptime;

    if (running > 300) {
        if (delta > 0.95) {
            return 'w-full px-4 mt-4 !block';
        }
    }

    return 'hidden';
};

export default () => {
    const { t } = useTranslation('arix/utilities');
    const [stats, setStats] = useState<Stats>({ memory: 0, cpu: 0, disk: 0, uptime: 0 });
    const { lowResourcesAlert, alertLink } = useStoreState(
        (state: ApplicationStore) => state.settings.data!.arix.advanced
    );

    const connected = ServerContext.useStoreState((state) => state.socket.connected);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);
    const limits = ServerContext.useStoreState((state) => state.server.data!.limits);

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

    return lowResourcesAlert ? (
        <div
            className={`
            ${getBackgroundColor(stats.cpu, stats.uptime / 1000, limits.cpu)}
            ${getBackgroundColor(stats.memory / 1024, stats.uptime / 1000, limits.memory * 1024)}
            ${getBackgroundColor(stats.disk / 1024, stats.uptime / 1000, limits.disk * 1024)}
        `}
        >
            <div className={'mx-auto w-full max-w-[1200px]'}>
                <div className={'bg-danger-200 px-4 py-3 flex items-center gap-x-4 rounded-component'}>
                    <div>
                        <ExclamationIcon className={'w-6 text-danger-50'} />
                    </div>
                    <div>
                        <p className={'text-danger-50 font-medium'}>{t('low-resources')}</p>
                        <p className={'text-sm text-danger-50'}>{t('low-resources-desc')}</p>
                    </div>
                    <a href={alertLink ?? '/'} target={'_blank'} className={'ml-auto'}>
                        <Button.Danger>{t('upgrade-server')}</Button.Danger>
                    </a>
                </div>
            </div>
        </div>
    ) : null;
};
