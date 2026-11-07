import React, { useEffect, useState } from 'react';
import http from '@/api/http';
import Can from '@/components/elements/Can';
import ToolkitPage, { useToolkit, button, secondary, box, field, code } from './ToolkitPage';
import WorkshopCards, { WorkshopCollection } from './WorkshopCards';

interface Status {
    backups: { id: string; created: string }[];
    target: string;
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
    const { base, status, busy, error, notice, run, refresh, setNotice } = useToolkit<Status>('workshop');
    const [collection, setCollection] = useState('');
    const [preview, setPreview] = useState<LuaPreview>();
    useEffect(() => {
        setCollection('');
        setPreview(undefined);
    }, [base]);
    useEffect(() => {
        if (status?.collection?.collection) setCollection((current) => current || status.collection!.collection!);
    }, [status]);
    const displayed = preview?.restoring ? undefined : preview || status?.collection;
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
                            setCollection(event.target.value);
                            setPreview(undefined);
                        }}
                        placeholder={'https://steamcommunity.com/sharedfiles/filedetails/?id=123456789'}
                    />
                    <button className={button} disabled={busy || !collection.trim()} onClick={load}>
                        {busy ? 'Working…' : 'Load collection'}
                    </button>
                </div>
                <p className={'text-xs text-neutral-300'}>
                    The collection ID is the number after id= in its Steam URL. Nested collections are resolved
                    automatically.
                </p>
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
                        Load a collection to see its addons, artwork and download sizes.
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
