import React, { useCallback, useEffect, useRef, useState } from 'react';
import http, { httpErrorToHuman } from '@/api/http';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';

export const button = 'px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50 mr-2 mt-2';
export const secondary =
    'px-4 py-2 rounded border border-neutral-500 text-neutral-100 hover:bg-neutral-700 disabled:opacity-50 mr-2 mt-2';
export const box = 'rounded border border-neutral-600 p-5 mb-6';
export const field = 'block w-full rounded bg-neutral-900 border border-neutral-500 p-2 mt-2 mb-3 text-neutral-100';
export const code =
    'whitespace-pre-wrap break-all rounded bg-neutral-900 text-neutral-100 p-3 mt-3 overflow-auto max-h-72 text-sm';

export function formatBytes(bytes?: number | null): string {
    if (bytes === undefined || bytes === null) return 'Size unavailable';
    if (bytes === 0) return '0 B';
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** unit).toFixed(unit > 0 ? 1 : 0)} ${units[unit]}`;
}
const errorMessage = (error: unknown) =>
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? httpErrorToHuman(error);

export function useToolkit<T>(page: 'workshop' | 'fastdl', poll = false) {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const base = `/api/client/servers/${uuid}/gmod-toolkit`;
    const endpoint = `${base}/${page}`;
    const [status, setStatus] = useState<T>();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const sequence = useRef(0);
    const timeout = page === 'workshop' ? 60000 : 20000;

    useEffect(() => {
        let disposed = false;
        let loading = false;
        setStatus(undefined);
        setError('');
        setNotice('');
        const load = async () => {
            if (loading) return;
            loading = true;
            const request = ++sequence.current;
            try {
                const { data } = await http.get<T>(endpoint, { timeout });
                if (!disposed && request === sequence.current) setStatus(data);
            } catch (err) {
                if (!disposed && request === sequence.current) setError(errorMessage(err));
            } finally {
                loading = false;
            }
        };
        load();
        const timer = poll ? window.setInterval(load, 3000) : undefined;
        return () => {
            disposed = true;
            ++sequence.current;
            if (timer !== undefined) window.clearInterval(timer);
        };
    }, [endpoint, poll, timeout]);

    const refresh = useCallback(
        async (accept = () => true) => {
            const request = ++sequence.current;
            const { data } = await http.get<T>(endpoint, { timeout });
            if (request === sequence.current && accept()) setStatus(data);
        },
        [endpoint, timeout]
    );
    const run = async (operation: () => Promise<void>) => {
        setBusy(true);
        setError('');
        setNotice('');
        try {
            await operation();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };
    return { id, base, status, busy, error, notice, setError, setNotice, run, refresh };
}

export default ({
    title,
    error,
    notice,
    children,
}: React.PropsWithChildren<{ title: string; error: string; notice: string }>) => (
    <ServerContentBlock title={title}>
        <h1 className={'text-2xl mb-4'}>{title}</h1>
        {error && (
            <p role={'alert'} className={'p-3 mb-4 bg-red-900 text-white rounded'}>
                {error}
            </p>
        )}
        {notice && (
            <p role={'status'} className={'p-3 mb-4 bg-green-900 text-white rounded'}>
                {notice}
            </p>
        )}
        {children}
    </ServerContentBlock>
);
