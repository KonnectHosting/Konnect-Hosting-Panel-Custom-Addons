import React, { useCallback, useEffect, useRef, useState } from 'react';
import http from '@/api/http';
import Can from '@/components/elements/Can';
import ToolkitPage, { useToolkit, button, secondary, box, field, code } from './ToolkitPage';
import WorkshopCards, { WorkshopCollection } from './WorkshopCards';

interface Status {
    backups: { id: string; created: string }[];
    target: string;
    input: string;
    refreshedAt?: string | null;
    refreshError?: string | null;
    collection?: WorkshopCollection | null;
}
interface LuaPreview extends WorkshopCollection {
    preview: string;
    lua: string;
    before: string | null;
    added: string[];
    removed: string[];
    restoring?: boolean;
}

export default () => {
    const { base, status, busy, error, notice, run, refresh, setNotice, setError } = useToolkit<Status>('workshop');
    const [collection, setCollection] = useState('');
    const [preview, setPreview] = useState<LuaPreview>();
    const [saving, setSaving] = useState(false);
    const edited = useRef(false);
    const revision = useRef(0);
    const queue = useRef<Promise<void>>(Promise.resolve());
    const timer = useRef<number>();
    const autosaved = useRef(-1);
    useEffect(() => {
        edited.current = false;
        ++revision.current;
        setCollection('');
        setPreview(undefined);
        setSaving(false);
        return () => {
            ++revision.current;
        };
    }, [base]);
    useEffect(() => {
        if (status && !edited.current) setCollection(status.input);
    }, [status]);
    // Serialize saves so a slower earlier request cannot replace newer input.
    const persist = useCallback(
        (input: string, version: number) => {
            const task = queue.current
                .catch(() => undefined)
                .then(async () => {
                    if (version !== revision.current) return;
                    await http.post(`${base}/workshop/selection`, { collection: input });
                    if (version === revision.current) await refresh(() => version === revision.current);
                });
            queue.current = task;
            return task;
        },
        [base, refresh]
    );
    const autosave = useCallback(
        (input: string, version: number) => {
            if (autosaved.current === version) return;
            autosaved.current = version;
            setSaving(true);
            setError('');
            persist(input, version)
                .catch(() => {
                    if (version === revision.current) {
                        autosaved.current = -1;
                        setError('Could not save or refresh your collection. Use Refresh to retry.');
                    }
                })
                .finally(() => {
                    if (version === revision.current) setSaving(false);
                });
        },
        [persist, setError]
    );
    useEffect(() => {
        if (!edited.current) return;
        const version = revision.current;
        timer.current = window.setTimeout(() => autosave(collection, version), 700);
        return () => window.clearTimeout(timer.current);
    }, [collection, autosave]);
    const displayed = preview?.restoring
        ? undefined
        : preview || (status?.input === collection.trim() ? status.collection : undefined);
    const load = () =>
        run(async () => {
            setPreview(undefined);
            const { data } = await http.post<LuaPreview>(
                `${base}/workshop/preview`,
                { collection },
                { timeout: 60000 }
            );
            setPreview(data);
        });
    return (
        <ToolkitPage title={'Workshop Collection Sync'} error={error} notice={notice}>
            <section className={box}>
                <div
                    className={
                        'rounded border border-blue-500 bg-blue-900 bg-opacity-20 p-3 text-sm text-blue-200 mb-5'
                    }
                >
                    Generate client-download Lua from a Steam collection. Your server file is backed up before
                    replacement.
                    <span className={'block mt-1 break-all text-xs'}>
                        {status?.target || '/garrysmod/lua/autorun/server/gmod_toolkit_workshop.lua'}
                    </span>
                </div>
                <label
                    className={'block text-sm font-semibold uppercase tracking-wide'}
                    htmlFor={'workshop-collection'}
                >
                    Collection ID or Steam link
                </label>
                <div className={'flex flex-col sm:flex-row sm:items-start gap-2'}>
                    <input
                        id={'workshop-collection'}
                        className={field + ' sm:flex-1 min-w-0'}
                        value={collection}
                        maxLength={1024}
                        onChange={(event) => {
                            edited.current = true;
                            ++revision.current;
                            setSaving(true);
                            setCollection(event.target.value);
                            setPreview(undefined);
                        }}
                        onBlur={() => {
                            if (!edited.current) return;
                            window.clearTimeout(timer.current);
                            autosave(collection, revision.current);
                        }}
                        placeholder={'https://steamcommunity.com/sharedfiles/filedetails/?id=123456789'}
                    />
                    <button
                        className={secondary}
                        disabled={busy || saving}
                        onClick={() => {
                            window.clearTimeout(timer.current);
                            setPreview(undefined);
                            run(async () => {
                                if (edited.current) await persist(collection, revision.current);
                                else await refresh();
                            });
                        }}
                    >
                        {saving ? 'Saving and refreshing…' : busy ? 'Working…' : 'Refresh collection'}
                    </button>
                </div>
                <p className={'text-xs text-neutral-300'}>
                    The collection ID is the number after id= in its Steam URL. Nested collections are resolved
                    automatically. Your selection is saved automatically and refreshed each time you open this page.
                </p>
                {status?.refreshError && status.input === collection.trim() && (
                    <p role={'alert'} className={'text-sm text-yellow-200 mt-3'}>
                        {status.collection ? 'Showing the last successful refresh. ' : ''}
                        {status.refreshError}
                    </p>
                )}
                {status?.refreshedAt && status.input === collection.trim() && (
                    <p className={'text-xs text-neutral-300 mt-2'}>
                        Last refreshed {new Date(status.refreshedAt).toLocaleString()}
                    </p>
                )}
                <button className={button} disabled={busy || saving || !collection.trim()} onClick={load}>
                    Preview download Lua
                </button>
                {displayed?.title && <h2 className={'text-lg font-semibold mt-5'}>{displayed.title}</h2>}
                {preview && (
                    <div className={'mt-5 rounded border border-neutral-500 bg-neutral-800 p-4'}>
                        <p className={'font-semibold'}>
                            {preview.restoring ? 'Review backup restoration' : 'Review changes before applying'}
                        </p>
                        {!preview.restoring && (
                            <p className={'text-sm text-neutral-300 mt-1'}>
                                {preview.added.length} added · {preview.removed.length} removed from the generated Lua ·{' '}
                                {preview.collections} collections resolved
                            </p>
                        )}
                        <Can action={['file.read', 'file.read-content', 'file.create', 'file.update']}>
                            <button
                                className={button}
                                disabled={busy}
                                onClick={() =>
                                    run(async () => {
                                        const { data } = await http.post<{ message: string }>(
                                            `${base}/workshop/apply`,
                                            { preview: preview.preview }
                                        );
                                        setNotice(data.message);
                                        await refresh();
                                        setPreview(undefined);
                                    })
                                }
                            >
                                {preview.restoring
                                    ? 'Back up and restore this version'
                                    : 'Back up and apply download Lua'}
                            </button>
                        </Can>
                        <details className={'mt-4'} open={preview.restoring || undefined}>
                            <summary className={'cursor-pointer text-sm'}>
                                Compare generated Lua with the current file
                            </summary>
                            <p className={'text-sm mt-3'}>Current file</p>
                            <pre className={code}>{preview.before ?? '(File does not exist)'}</pre>
                            <p className={'text-sm mt-3'}>New file</p>
                            <pre className={code}>{preview.lua}</pre>
                        </details>
                    </div>
                )}
                {!displayed && !preview && (
                    <div className={'py-10 text-center text-neutral-300'}>
                        {!status
                            ? 'Refreshing your saved collection…'
                            : saving
                            ? 'Saving your selection and loading its addons…'
                            : 'Enter a collection to see its addons, artwork and download sizes.'}
                    </div>
                )}
                {displayed && <WorkshopCards collection={displayed} fallback={`${base}/workshop/cover`} />}
                {status && status.backups.length > 0 && (
                    <details className={'mt-8 border-t border-neutral-600 pt-4'}>
                        <summary className={'cursor-pointer text-sm'}>Restore a previous download Lua file</summary>
                        <label className={'block text-sm mt-3'}>
                            Choose a backup to preview
                            <select
                                className={field}
                                value={''}
                                disabled={busy}
                                onChange={(event) => {
                                    const backup = event.target.value;
                                    if (backup)
                                        run(async () => {
                                            setPreview(
                                                (await http.post<LuaPreview>(`${base}/workshop/preview`, { backup }))
                                                    .data
                                            );
                                        });
                                }}
                            >
                                <option value={''}>Choose a previous version</option>
                                {status.backups.map((backup) => (
                                    <option key={backup.id} value={backup.id}>
                                        {new Date(backup.created).toLocaleString()}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </details>
                )}
                {preview && (
                    <button className={secondary} disabled={busy} onClick={() => setPreview(undefined)}>
                        Discard this preview
                    </button>
                )}
            </section>
        </ToolkitPage>
    );
};
