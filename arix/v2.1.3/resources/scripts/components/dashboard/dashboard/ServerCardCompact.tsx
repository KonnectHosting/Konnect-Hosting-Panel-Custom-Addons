import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Server } from '@/api/server/getServer';
import getServerResourceUsage, { ServerStats } from '@/api/server/getServerResourceUsage';
import { ip } from '@/lib/formatters';
import tw from 'twin.macro';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components/macro';
import Badge from '@/components/elements/Badge';
import { GlobeIcon } from '@heroicons/react/outline';

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
        if (isSuspended) return;

        let active = true;
        const getStats = async () => {
            try {
                const data = await getServerResourceUsage(server.uuid);
                if (active) setStats(data);
            } catch (error) {
                if (active) console.error(error);
            }
        };

        void getStats();
        interval.current = setInterval(() => void getStats(), 30000);

        return () => {
            active = false;
            if (interval.current) {
                clearInterval(interval.current);
                interval.current = null;
            }
        };
    }, [isSuspended, server.uuid]);

    const statusColor =
        stats?.status === 'offline' || stats?.status === 'stopping'
            ? 'danger'
            : stats?.status === 'running'
            ? 'success'
            : 'warning';

    const statusLabel =
        stats?.status === 'offline'
            ? t('offline', { ns: 'arix/utilities' })
            : stats?.status === 'running'
            ? t('online', { ns: 'arix/utilities' })
            : stats?.status === 'starting'
            ? t('starting', { ns: 'arix/utilities' })
            : stats?.status === 'stopping'
            ? t('stopping', { ns: 'arix/utilities' })
            : '';

    return (
        <CardAnimator
            className='bg-gray-700 backdrop boxBorder px-6 py-5 rounded-box'
            style={{ animationDelay: `${count * 100}ms` }}
        >
            <Link to={`/server/${server.id}`}>
                <div className='flex items-center justify-between'>
                    <p className='text-lg font-semibold text-gray-50'>{server.name}</p>
                    <Badge color={statusColor}>{statusLabel}</Badge>
                </div>
                {server.description && <p className='text-gray-300 mt-1 line-clamp-2'>{server.description}</p>}
                <div className='flex items-center gap-1 mt-3'>
                    <GlobeIcon css={tw`w-4 h-4 text-gray-300`} />
                    <span className='text-sm text-gray-300 privacy:blur-sm hover:privacy:blur-none duration-300'>
                        {server.allocations
                            .filter((alloc) => alloc.isDefault)
                            .map((allocation) => (
                                <React.Fragment key={allocation.ip + allocation.port.toString()}>
                                    {allocation.alias || ip(allocation.ip)}:{allocation.port}
                                </React.Fragment>
                            ))}
                    </span>
                </div>
            </Link>
        </CardAnimator>
    );
};
