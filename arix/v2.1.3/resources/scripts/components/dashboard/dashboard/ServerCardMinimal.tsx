import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Server } from '@/api/server/getServer';
import getServerResourceUsage, { ServerStats } from '@/api/server/getServerResourceUsage';
import { bytesToString, ip, mbToBytes } from '@/lib/formatters';
import tw from 'twin.macro';
import Spinner from '@/components/elements/Spinner';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components/macro';
import { styles } from '@/components/elements/button/index';
import classNames from 'classnames';
import Badge from '@/components/elements/Badge';
import { ChipIcon, GlobeIcon } from '@heroicons/react/outline';
import { LuMemoryStick, LuSave } from 'react-icons/lu';

const CardAnimator = styled.div`
    animation: fadeIn 0.3s ease-in-out forwards;
    opacity: 0;

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;

// Determines if the current value is in an alarm threshold so we can show it in red rather
// than the more faded default style.
const isAlarmState = (current: number, limit: number): boolean => limit > 0 && current / (limit * 1024 * 1024) >= 0.9;

type Timer = ReturnType<typeof setInterval>;

export default ({ server, count }: { server: Server; count: number }) => {
    const { t } = useTranslation(['arix/utilities', 'arix/dashboard']);
    const interval = useRef<Timer | null>(null);
    const [isSuspended, setIsSuspended] = useState(server.status === 'suspended');
    const [stats, setStats] = useState<ServerStats | null>(null);

    useEffect(() => {
        setIsSuspended(stats?.isSuspended || server.status === 'suspended');
    }, [stats?.isSuspended, server.status]);

    useEffect(() => {
        // Don't waste a HTTP request if there is nothing important to show to the user because
        // the server is suspended.
        if (isSuspended) return;

        let active = true;
        const getStats = async () => {
            try {
                const data = await getServerResourceUsage(server.uuid);
                if (active) {
                    setStats(data);
                }
            } catch (error) {
                if (active) {
                    console.error(error);
                }
            }
        };

        void getStats();
        interval.current = setInterval(() => {
            void getStats();
        }, 30000);

        return () => {
            active = false;
            if (interval.current) {
                clearInterval(interval.current);
                interval.current = null;
            }
        };
    }, [isSuspended, server.uuid]);

    const alarms = { cpu: false, memory: false, disk: false };
    if (stats) {
        alarms.cpu = server.limits.cpu === 0 ? false : stats.cpuUsagePercent >= server.limits.cpu * 0.9;
        alarms.memory = isAlarmState(stats.memoryUsageInBytes, server.limits.memory);
        alarms.disk = server.limits.disk === 0 ? false : isAlarmState(stats.diskUsageInBytes, server.limits.disk);
    }

    const diskLimit = server.limits.disk !== 0 ? bytesToString(mbToBytes(server.limits.disk)) : t('unlimited');
    const memoryLimit = server.limits.memory !== 0 ? bytesToString(mbToBytes(server.limits.memory)) : t('unlimited');
    const cpuLimit = server.limits.cpu !== 0 ? server.limits.cpu + '%' : t('unlimited');

    return (
        <>
            <CardAnimator
                className='bg-gray-700 backdrop boxBorder px-6 py-5 rounded-box'
                style={{ animationDelay: `${count * 100}ms` }}
            >
                <Link to={`/server/${server.id}`}>
                    <div className='flex items-center justify-between'>
                        <p className='text-lg font-semibold text-gray-50'>{server.name}</p>
                        <Badge
                            color={
                                stats?.status === 'offline' || stats?.status === 'stopping'
                                    ? 'danger'
                                    : stats?.status === 'running'
                                    ? 'success'
                                    : 'warning'
                            }
                        >
                            {stats?.status === 'offline'
                                ? t('offline', { ns: 'arix/utilities' })
                                : stats?.status === 'running'
                                ? t('online', { ns: 'arix/utilities' })
                                : stats?.status === 'starting'
                                ? t('starting', { ns: 'arix/utilities' })
                                : stats?.status === 'stopping'
                                ? t('stopping', { ns: 'arix/utilities' })
                                : ''}
                        </Badge>
                    </div>
                    <div className='flex flex-wrap gap-5 mt-4'>
                        <div className='flex items-center gap-1'>
                            <span className='text-sm text-gray-300 font-light'>
                                <GlobeIcon css={tw`w-4 h-4`} />
                            </span>
                            <span className='privacy:blur-sm hover:privacy:blur-none duration-300'>
                                {server.allocations
                                    .filter((alloc) => alloc.isDefault)
                                    .map((allocation) => (
                                        <React.Fragment key={allocation.ip + allocation.port.toString()}>
                                            {allocation.alias || ip(allocation.ip)}:{allocation.port}
                                        </React.Fragment>
                                    ))}
                            </span>
                        </div>
                        {!stats || isSuspended ? (
                            isSuspended ? (
                                <div className='flex items-center gap-1'>
                                    <span className='text-sm text-gray-300 font-light'>{t('status')}:</span>
                                    <span css={tw`bg-danger-200 rounded px-2 py-1 text-danger-50`}>
                                        {server.status === 'suspended' ? t('suspended') : t('connection-error')}
                                    </span>
                                </div>
                            ) : server.isTransferring || server.status ? (
                                <div className='flex items-center gap-1'>
                                    <span className='text-sm text-gray-300 font-light'>{t('status')}:</span>
                                    <span css={tw`bg-gray-400 rounded px-2 py-1 text-gray-200`}>
                                        {server.isTransferring
                                            ? t('transferring')
                                            : server.status === 'installing'
                                            ? t('installing')
                                            : server.status === 'restoring_backup'
                                            ? t('restoring-backup')
                                            : t('unavailable')}
                                    </span>
                                </div>
                            ) : (
                                <Spinner size={'small'} />
                            )
                        ) : (
                            <React.Fragment>
                                <div className='flex items-center gap-1'>
                                    <span className='text-sm text-gray-300 font-light uppercase'>
                                        <ChipIcon css={tw`w-4 h-4`} />
                                    </span>
                                    <p className={alarms.cpu ? 'text-danger-50' : ''}>
                                        {stats.cpuUsagePercent.toFixed(2)}%
                                    </p>
                                    <span className='text-sm text-gray-300'>/ {cpuLimit}</span>
                                </div>
                                <div className='flex items-center gap-1'>
                                    <span className='text-sm text-gray-300 font-light'>
                                        <LuMemoryStick css={tw`w-4 h-4`} />
                                    </span>
                                    <p className={alarms.memory ? 'text-danger-50' : ''}>
                                        {bytesToString(stats.memoryUsageInBytes)}
                                    </p>
                                    <span className='text-sm text-gray-300'>/ {memoryLimit}</span>
                                </div>
                                <div className='flex items-center gap-1'>
                                    <span className='text-sm text-gray-300 font-light'>
                                        <LuSave css={tw`w-4 h-4`} />
                                    </span>
                                    <p className={alarms.disk ? 'text-danger-50' : ''}>
                                        {bytesToString(stats.diskUsageInBytes)}
                                    </p>
                                    <span className='text-sm text-gray-300'>/ {diskLimit}</span>
                                </div>
                            </React.Fragment>
                        )}
                    </div>
                </Link>
            </CardAnimator>
        </>
    );
};
