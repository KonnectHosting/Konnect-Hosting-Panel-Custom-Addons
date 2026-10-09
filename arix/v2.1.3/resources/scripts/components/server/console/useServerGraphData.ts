import { useEffect, useMemo, useRef, useState } from 'react';
import { ServerContext } from '@/state/server';
import { SocketEvent } from '@/components/server/events';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';

const GRAPH_POINT_COUNT = 20;

type StatsSnapshot = Record<'memory' | 'cpu' | 'rx' | 'tx', number>;

export interface GraphPoint {
    index: number;
    cpu: number | null;
    memory: number | null;
    networkIn: number | null;
    networkOut: number | null;
}

interface UseServerGraphDataResult {
    limits: {
        cpu: number;
        memory: number;
    };
    stats: StatsSnapshot;
    points: GraphPoint[];
}

const createEmptySeries = (): GraphPoint[] =>
    Array.from({ length: GRAPH_POINT_COUNT }, (_, index) => ({
        index,
        cpu: null,
        memory: null,
        networkIn: null,
        networkOut: null,
    }));

interface ParsedStats {
    cpu: number;
    memoryBytes: number;
    txBytes: number;
    rxBytes: number;
}

const parseStats = (data: string): ParsedStats | null => {
    let values: any = {};

    try {
        values = JSON.parse(data);
    } catch {
        return null;
    }

    if (
        typeof values.cpu_absolute !== 'number' ||
        typeof values.memory_bytes !== 'number' ||
        typeof values?.network?.tx_bytes !== 'number' ||
        typeof values?.network?.rx_bytes !== 'number'
    ) {
        return null;
    }

    return {
        cpu: values.cpu_absolute,
        memoryBytes: values.memory_bytes,
        txBytes: values.network.tx_bytes,
        rxBytes: values.network.rx_bytes,
    };
};

export const useServerGraphData = (): UseServerGraphDataResult => {
    const status = ServerContext.useStoreState((state) => state.status.value);
    const limits = ServerContext.useStoreState((state) => state.server.data!.limits);

    const [stats, setStats] = useState<StatsSnapshot>({ memory: 0, cpu: 0, rx: 0, tx: 0 });
    const [points, setPoints] = useState<GraphPoint[]>(() => createEmptySeries());
    const previous = useRef<Record<'tx' | 'rx', number>>({ tx: -1, rx: -1 });

    useEffect(() => {
        if (status !== 'offline') {
            return;
        }

        setPoints(createEmptySeries());
        previous.current = { tx: -1, rx: -1 };
    }, [status]);

    useWebsocketEvent(SocketEvent.STATS, (data: string) => {
        const next = parseStats(data);

        if (!next) {
            return;
        }

        setStats({
            memory: next.memoryBytes,
            cpu: next.cpu,
            tx: next.txBytes,
            rx: next.rxBytes,
        });

        setPoints((state) => {
            const networkIn = previous.current.rx < 0 ? 0 : Math.max(0, next.rxBytes - previous.current.rx);
            const networkOut = previous.current.tx < 0 ? 0 : Math.max(0, next.txBytes - previous.current.tx);

            return [
                ...state.slice(1),
                {
                    index: state[state.length - 1].index + 1,
                    cpu: Number(next.cpu.toFixed(2)),
                    memory: Math.floor(next.memoryBytes / 1024 / 1024),
                    networkIn,
                    networkOut,
                },
            ];
        });

        previous.current = { tx: next.txBytes, rx: next.rxBytes };
    });

    return useMemo(
        () => ({
            limits: {
                cpu: limits.cpu,
                memory: limits.memory,
            },
            points,
            stats,
        }),
        [limits.cpu, limits.memory, points, stats]
    );
};
