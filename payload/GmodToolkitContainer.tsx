import React, { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import http, { httpErrorToHuman } from '@/api/http';
import Can from '@/components/elements/Can';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import { Link } from 'react-router-dom';
import copy from 'copy-to-clipboard';

interface Fastdl {
    url?: string;
    files?: number;
    message?: string;
    preview?: DownloadPreview;
    job?: {
        status: string;
        phase: string;
        message: string;
        completed: number;
        total: number;
        inspected: number;
        pendingDirectories: number;
        waiting: boolean;
    };
}
interface Status {
    fastdl: Fastdl;
    backups: { id: string; created: string }[];
    mounting: string;
}
interface LuaPreview {
    preview: string;
    collection?: string;
    lua: string;
    before: string | null;
    duplicates: number;
    collections: number;
    added: string[];
    removed: string[];
    items: { id: string; title: string }[];
    restoring?: boolean;
}
interface DownloadPreview {
    preview: string;
    files: number;
    bytes: number;
    skipped: number;
    added: string[];
    changed: string[];
    removed: string[];
}
const button = 'px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50 mr-2 mt-2';
const box = 'rounded border border-neutral-600 p-5 mb-6';
const field = 'block w-full rounded bg-neutral-900 border border-neutral-500 p-2 mt-2 mb-3 text-neutral-100';
const code =
    'whitespace-pre-wrap break-all rounded bg-neutral-900 text-neutral-100 p-3 mt-3 overflow-auto max-h-72 text-sm';
const errorMessage = (error: unknown) =>
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? httpErrorToHuman(error);

export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const base = `/api/client/servers/${uuid}/gmod-toolkit`;
    const [status, setStatus] = useState<Status>();
    const [collection, setCollection] = useState('');
    const [lua, setLua] = useState<LuaPreview>();
    const [download, setDownload] = useState<DownloadPreview>();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const fastdlConfig = status?.fastdl.url
        ? `sv_downloadurl "${status.fastdl.url}"\nsv_allowdownload 1\nsv_allowupload 0`
        : '';
    const copyValue = (value: string, label: string) => {
        if (copy(value)) setNotice(`${label} copied.`);
        else setError('Copy failed. Select the text and copy it manually.');
    };

    useEffect(() => {
        let disposed = false;
        let loading = false;
        const load = async () => {
            if (loading) return;
            loading = true;
            try {
                const { data } = await http.get<Status>(base);
                if (!disposed) {
                    setStatus(data);
                    setDownload(data.fastdl.preview);
                }
            } catch (err) {
                if (!disposed) setError(errorMessage(err));
            } finally {
                loading = false;
            }
        };
        load();
        const timer = window.setInterval(load, 3000);
        return () => {
            disposed = true;
            window.clearInterval(timer);
        };
    }, [base]);

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
    const refresh = async () => {
        const { data } = await http.get<Status>(base);
        setStatus(data);
        setDownload(data.fastdl.preview);
    };
    const downloadAction = (action: string) =>
        run(async () => {
            await http.post(`${base}/fastdl/${action}`);
            setDownload(undefined);
            setNotice(
                action === 'revoke'
                    ? 'FastDL URL revoked.'
                    : 'FastDL URL rotated; update sv_downloadurl in your server.cfg.'
            );
            await refresh();
        });

    return (
        <ServerContentBlock title={'GMod Toolkit'}>
            <h1 className={'text-2xl mb-4'}>GMod Toolkit</h1>
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
            <section className={box}>
                <h2 className={'text-xl mb-2'}>Workshop client downloads</h2>
                <p>
                    Resolve a Garry&apos;s Mod collection, including nested collections, into client
                    resource.AddWorkshop calls. Existing Lua is shown before replacement and backed up privately on the
                    Panel.
                </p>
                <label className={'block mt-3'}>
                    Collection ID or Steam collection link
                    <input
                        className={field}
                        value={collection}
                        maxLength={1024}
                        onChange={(event) => {
                            setCollection(event.target.value);
                            setLua(undefined);
                        }}
                        placeholder={'https://steamcommunity.com/sharedfiles/filedetails/?id=123456789'}
                    />
                </label>
                <button
                    className={button}
                    disabled={busy || !collection.trim()}
                    onClick={() =>
                        run(async () => {
                            setLua(undefined);
                            setLua(
                                (
                                    await http.post<LuaPreview>(
                                        `${base}/workshop/preview`,
                                        { collection },
                                        { timeout: 60000 }
                                    )
                                ).data
                            );
                        })
                    }
                >
                    Preview Workshop Lua
                </button>
                {status && status.backups.length > 0 && (
                    <label className={'block mt-4'}>
                        Preview a backup to restore
                        <select
                            className={field}
                            value={''}
                            disabled={busy}
                            onChange={(event) => {
                                const backup = event.target.value;
                                if (backup)
                                    run(async () => {
                                        setLua(undefined);
                                        setLua(
                                            (await http.post<LuaPreview>(`${base}/workshop/preview`, { backup })).data
                                        );
                                    });
                            }}
                        >
                            <option value={''}>Choose a previous version</option>
                            {status.backups.map((backup) => (
                                <option key={backup.id} value={backup.id}>
                                    {backup.created}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                {lua && (
                    <div className={'mt-4'}>
                        <p>
                            {lua.restoring
                                ? 'Backup restoration preview'
                                : `${lua.items.length} addons, ${lua.collections} collections, ${lua.duplicates} duplicate references removed.`}
                        </p>
                        {!lua.restoring && (
                            <p>
                                Added: {lua.added.length}. Removed from this generated file: {lua.removed.length}.
                            </p>
                        )}
                        {lua.items.length > 0 && (
                            <details>
                                <summary>Resolved Workshop addons</summary>
                                <ul>
                                    {lua.items.map((item) => (
                                        <li key={item.id}>
                                            {item.id} — {item.title}
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        )}
                        <details>
                            <summary>Current Lua</summary>
                            <pre className={code}>{lua.before ?? '(File does not exist)'}</pre>
                        </details>
                        <p className={'mt-3'}>New /garrysmod/lua/autorun/server/gmod_toolkit_workshop.lua</p>
                        <pre className={code}>{lua.lua}</pre>
                        <Can action={['file.read', 'file.read-content', 'file.create', 'file.update']}>
                            <button
                                className={button}
                                disabled={busy}
                                onClick={() =>
                                    run(async () => {
                                        const { data } = await http.post<{ message: string }>(
                                            `${base}/workshop/apply`,
                                            { preview: lua.preview }
                                        );
                                        setLua(undefined);
                                        setNotice(data.message);
                                        await refresh();
                                    })
                                }
                            >
                                Back up existing file and apply preview
                            </button>
                        </Can>
                    </div>
                )}
            </section>
            <section className={box}>
                <h2 className={'text-xl mb-2'}>Workshop server mounting</h2>
                <p>
                    {status?.mounting ??
                        'Server mounting is separate from client downloads. The egg startup must mount the collection on the server.'}
                </p>
                {lua?.collection && <pre className={code}>{`+host_workshop_collection ${lua.collection}`}</pre>}
                <p className={'mt-2'}>
                    Use the corresponding editable Workshop collection variable in Startup, or ask your host to
                    configure it. Applying the client Lua does not change startup variables or download server-side
                    addons.
                </p>
                <Can action={['startup.read', 'startup.update']}>
                    <Link className={'underline inline-block mt-3'} to={`/server/${id}/startup`}>
                        Open server mounting settings in Startup
                    </Link>
                </Can>
            </section>
            <section className={box}>
                <h2 className={'text-xl mb-2'}>FastDL</h2>
                <p>
                    Upload your custom game assets to this server, then preview and publish them here. The Panel creates
                    compressed .bz2 downloads automatically and hosts your published files at a unique URL.
                </p>
                <h3 className={'text-lg mt-4 mb-2'}>1. Upload files to your server</h3>
                <p>
                    Use Files or SFTP. Paths below start at /home/container, which appears as the root in Files. Keep
                    the original filenames and subfolders:
                </p>
                <ul className={'list-disc pl-6 mt-2'}>
                    <li>Maps: /garrysmod/maps/ (for example maps/rp_example.bsp)</li>
                    <li>Materials and textures: /garrysmod/materials/ (.vmt, .vtf)</li>
                    <li>Models and companion files: /garrysmod/models/ (.mdl, .vvd, .vtx, .phy, .ani)</li>
                    <li>Sounds: /garrysmod/sound/ (.wav, .mp3, .ogg)</li>
                    <li>Particles: /garrysmod/particles/ (.pcf)</li>
                    <li>Fonts: /garrysmod/resource/fonts/ (.ttf, .otf)</li>
                </ul>
                <Link className={'underline inline-block mt-3'} to={`/server/${id}/files#/garrysmod`}>
                    Open server files to upload assets
                </Link>
                <p className={'mt-2'}>
                    Upload extracted assets. Files inside addons/ or .gma, .vpk and ZIP archives are not published. You
                    do not need to upload .bz2 files. Lua, configs, secrets and links are excluded.
                </p>
                <h3 className={'text-lg mt-4 mb-2'}>2. Preview and publish</h3>
                <p>
                    Click Preview FastDL changes below. When preparation finishes, review the files and click Publish
                    this asset snapshot publicly. Repeat this after adding, changing or removing assets. Server file
                    edits do not update your published downloads automatically.
                </p>
                <p className={'mt-2'}>
                    FastDL serves resources requested by the game. Custom assets may also need resource.AddFile in your
                    private server Lua. Workshop client downloads use the separate tool above.
                </p>
                {status?.fastdl.message && <p className={'mt-3'}>{status.fastdl.message}</p>}
                {status?.fastdl.job && (
                    <div role={'status'} className={'mt-3'}>
                        {status.fastdl.job.status === 'running' ? (
                            <p>
                                {status.fastdl.job.phase === 'scan'
                                    ? `Scanning server folders: ${status.fastdl.job.inspected} entries checked, ${status.fastdl.job.total} eligible files found, ${status.fastdl.job.pendingDirectories} folders remaining.`
                                    : `${
                                          status.fastdl.job.phase === 'copy'
                                              ? 'Preparing private preview'
                                              : 'Compressing files for publication'
                                      }: ${status.fastdl.job.completed}/${status.fastdl.job.total} files.`}
                            </p>
                        ) : (
                            <p>
                                FastDL: {status.fastdl.job.status}. {status.fastdl.job.message}
                            </p>
                        )}
                        {status.fastdl.job.waiting && (
                            <p className={'mt-2'}>
                                Waiting for the Panel queue worker; progress has not advanced for over 90 seconds.
                                Interrupted steps are retried automatically. If this continues, ask your host to check
                                the Panel queue worker.
                            </p>
                        )}
                    </div>
                )}
                <button
                    className={button}
                    disabled={busy || status?.fastdl.job?.status === 'running'}
                    onClick={() =>
                        run(async () => {
                            setDownload(undefined);
                            await http.post(`${base}/fastdl/preview`);
                            setNotice('Preparing your private asset preview. Progress updates automatically.');
                            await refresh();
                        })
                    }
                >
                    Preview FastDL changes
                </button>
                {download && (
                    <div className={'mt-4'}>
                        <p>
                            {download.files} files, {(download.bytes / 1024 / 1024).toFixed(1)} MiB before compression.{' '}
                            {download.skipped} ineligible entries skipped.
                        </p>
                        {download.files === 0 && (
                            <p className={'mt-2'}>
                                No eligible assets were found in the upload folders above. Check that files are
                                extracted into those folders, then create a new preview.
                            </p>
                        )}
                        <pre className={code}>
                            {JSON.stringify(
                                { added: download.added, changed: download.changed, removed: download.removed },
                                null,
                                2
                            )}
                        </pre>
                        <Can action={['file.read', 'file.read-content', 'file.create', 'file.update']}>
                            <button
                                className={button}
                                disabled={busy}
                                onClick={() =>
                                    run(async () => {
                                        await http.post(`${base}/fastdl/publish`, { preview: download.preview });
                                        setDownload(undefined);
                                        setNotice(
                                            'FastDL publication started. Your download URL appears when compression completes.'
                                        );
                                        await refresh();
                                    })
                                }
                            >
                                Publish this asset snapshot publicly
                            </button>
                        </Can>
                    </div>
                )}
                <h3 className={'text-lg mt-4 mb-2'}>3. Set your FastDL URL</h3>
                {status?.fastdl.url ? (
                    <>
                        <label className={'block'}>
                            Your server&apos;s FastDL download URL (hosted on the Panel)
                            <input
                                className={field}
                                readOnly
                                value={status.fastdl.url}
                                onFocus={(event) => event.target.select()}
                            />
                        </label>
                        <button className={button} onClick={() => copyValue(status.fastdl.url!, 'FastDL URL')}>
                            Copy download URL
                        </button>
                        <p className={'mt-3'}>Add these settings to /garrysmod/cfg/server.cfg:</p>
                        <pre className={code}>{fastdlConfig}</pre>
                        <button className={button} onClick={() => copyValue(fastdlConfig, 'Server settings')}>
                            Copy server.cfg settings
                        </button>
                        <Link className={'underline inline-block mt-3'} to={`/server/${id}/files#/garrysmod/cfg`}>
                            Open server.cfg folder
                        </Link>
                        <p className={'mt-2'}>
                            Restart your game server after saving server.cfg, or run the settings in its console to
                            apply them now. Keep the trailing slash in the URL. Published files: {status.fastdl.files}.
                        </p>
                        <p className={'mt-2'}>
                            This URL is public to anyone who has it. Rotating or revoking it invalidates the old URL.
                        </p>
                    </>
                ) : (
                    <p>
                        No FastDL URL is active yet. After you publish a preview, your unique download URL and
                        ready-to-copy server.cfg settings will appear here. Downloads use the Panel domain and work
                        while the game server is stopped.
                    </p>
                )}
                <Can action={['file.read', 'file.read-content', 'file.create', 'file.update']}>
                    {status?.fastdl.url && (
                        <div className={'mt-4'}>
                            <button className={button} disabled={busy} onClick={() => downloadAction('rotate')}>
                                Rotate download URL
                            </button>
                            <button className={button} disabled={busy} onClick={() => downloadAction('revoke')}>
                                Revoke download URL
                            </button>
                        </div>
                    )}
                </Can>
            </section>
        </ServerContentBlock>
    );
};
