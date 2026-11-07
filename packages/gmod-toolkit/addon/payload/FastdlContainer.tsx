import React, { useEffect, useState } from 'react';
import http from '@/api/http';
import Can from '@/components/elements/Can';
import { Link } from 'react-router-dom';
import copy from 'copy-to-clipboard';
import ToolkitPage, { useToolkit, button, secondary, box, field, code, formatBytes } from './ToolkitPage';
import AddonBuilder from './AddonBuilder';

interface DownloadPreview {
    preview: string;
    files: number;
    bytes: number;
    skipped: number;
    added: string[];
    changed: string[];
    removed: string[];
    resources?: string[];
}
interface Status {
    fastdl: {
        url?: string | null;
        files?: number;
        preview?: DownloadPreview | null;
        addon?: { id: string; name: string; filename: string; bytes: number; expires: number } | null;
        job?: {
            status: string;
            phase: string;
            message: string;
            completed: number;
            total: number;
            inspected: number;
            pendingDirectories: number;
            waiting: boolean;
        } | null;
    };
}
const step =
    'flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-semibold';
const heading = 'flex items-center gap-3 mb-3';

export default () => {
    const { id, base, status, busy, error, notice, run, refresh, setNotice, setError } = useToolkit<Status>(
        'fastdl',
        true
    );
    const [delivery, setDelivery] = useState<'fastdl' | 'workshop'>('fastdl');
    useEffect(() => {
        setDelivery('fastdl');
    }, [base]);
    const preview = status?.fastdl.preview;
    const job = status?.fastdl.job;
    const working = busy || job?.status === 'running';
    const url = status?.fastdl.url;
    const addon = status?.fastdl.addon;
    useEffect(() => {
        if (job?.status === 'addon-ready' && addon?.id) setNotice('Your Workshop addon package is ready to download.');
        else if (job?.status === 'complete' && url)
            setNotice('FastDL downloads are published. Copy the settings into server.cfg to use them.');
        else if (job?.status === 'preview-ready' && preview?.preview)
            setNotice('Your asset preview is ready. Review the files and choose a download method.');
        else if (job?.status === 'failed') setNotice('');
    }, [job?.status, addon?.id, preview?.preview, url, setNotice]);
    const config = url ? `sv_downloadurl "${url}"\nsv_allowdownload 1\nsv_allowupload 0` : '';
    const copyValue = (value: string, label: string) => {
        if (copy(value)) setNotice(`${label} copied.`);
        else setError('Copy failed. Select the text and copy it manually.');
    };
    const phase = job?.phase || '';
    const progress =
        phase === 'scan'
            ? `Finding uploaded assets: ${job?.inspected || 0} entries checked, ${job?.total || 0} files found.`
            : `${
                  phase === 'copy'
                      ? 'Preparing asset preview'
                      : phase === 'compress'
                      ? 'Compressing FastDL files'
                      : phase === 'addon-index'
                      ? 'Verifying Workshop assets'
                      : phase === 'addon-write'
                      ? 'Writing Workshop addon'
                      : 'Finishing Workshop package'
              }: ${job?.completed || 0}/${job?.total || 0} files.`;
    return (
        <ToolkitPage title={'FastDL & Content Packs'} error={error} notice={notice}>
            <p className={'text-sm text-neutral-300 mb-5'}>
                Upload public asset copies once, then choose Panel-hosted FastDL or a Workshop addon for Valve&apos;s
                CDN.
            </p>
            <section className={box}>
                <div className={heading}>
                    <span className={step}>1</span>
                    <h2 className={'text-lg font-semibold'}>Upload your download assets</h2>
                </div>
                <p className={'text-sm text-neutral-300'}>
                    Use this server&apos;s dedicated <code className={'text-neutral-100'}>/home/container/fastdl/</code>{' '}
                    folder. Keep the same paths the game uses: <code>fastdl/maps/rp_example.bsp</code> becomes{' '}
                    <code>maps/rp_example.bsp</code> for players.
                </p>
                <div className={'flex flex-wrap items-center gap-2 mt-3'}>
                    <Can action={['file.read', 'file.read-content', 'file.create', 'file.update']}>
                        <button
                            className={secondary}
                            disabled={working}
                            onClick={() =>
                                run(async () => {
                                    const { data } = await http.post<{ message: string }>(`${base}/fastdl/prepare`);
                                    setNotice(data.message);
                                })
                            }
                        >
                            Prepare upload folders
                        </button>
                    </Can>
                    <Link className={button + ' inline-block'} to={`/server/${id}/files#/fastdl`}>
                        Open upload folder ↗
                    </Link>
                </div>
                <details className={'mt-4 text-sm text-neutral-300'}>
                    <summary className={'cursor-pointer'}>Folder layout, supported files and limits</summary>
                    <pre
                        className={code}
                    >{`fastdl/\n  maps/             .bsp .nav .ain\n  materials/        .vmt .vtf\n  models/           .mdl .vvd .vtx .phy .ani\n  sound/            .wav .mp3 .ogg\n  particles/        .pcf\n  resource/fonts/   .ttf .otf (FastDL only)`}</pre>
                    <p className={'mt-3'}>
                        Upload extracted files using Files or SFTP. Compression is automatic. Lua, configs, secrets,
                        archives and symbolic links are excluded. Limits: 5000 files, 2 GiB total, 128 MiB per file.
                    </p>
                    <p className={'mt-2'}>
                        The game still needs its installed assets at their normal paths. This upload folder contains the
                        public download copies.
                    </p>
                </details>
            </section>
            <section className={box}>
                <div className={heading}>
                    <span className={step}>2</span>
                    <h2 className={'text-lg font-semibold'}>Review the files players will receive</h2>
                </div>
                <p className={'text-sm text-neutral-300'}>
                    Create a private snapshot of fastdl/. Nothing is made public at this step.
                </p>
                <button
                    className={button}
                    disabled={working}
                    onClick={() =>
                        run(async () => {
                            await http.post(`${base}/fastdl/preview`);
                            setNotice('Preparing your asset preview. Progress updates automatically.');
                            await refresh();
                        })
                    }
                >
                    {working ? 'Preparing…' : preview ? 'Refresh asset preview' : 'Preview uploaded assets'}
                </button>
                {job?.status === 'running' && (
                    <div
                        role={'status'}
                        className={'rounded bg-neutral-800 border border-neutral-600 p-3 mt-4 text-sm'}
                    >
                        <p>{progress}</p>
                        {phase !== 'scan' && (
                            <progress
                                className={'w-full mt-3'}
                                value={job.completed}
                                max={Math.max(job.total, 1)}
                                aria-label={'Asset preparation progress'}
                            />
                        )}
                        {job.waiting && (
                            <p className={'text-neutral-300 mt-2'}>
                                Waiting for the Panel queue worker. Interrupted steps retry automatically; contact your
                                host if this continues.
                            </p>
                        )}
                    </div>
                )}
                {job?.status === 'failed' && (
                    <p role={'alert'} className={'text-red-300 mt-4 text-sm'}>
                        {job.message || 'Preparation failed. Create a fresh preview to retry.'}
                    </p>
                )}
                {preview && (
                    <div className={'mt-4'}>
                        <p className={'text-lg font-semibold'}>
                            {preview.files.toLocaleString()} files · {formatBytes(preview.bytes)}
                        </p>
                        <div className={'flex flex-wrap gap-2 text-xs mt-3'}>
                            <span className={'px-2 py-1 rounded bg-green-900 text-green-200'}>
                                {preview.added.length} added
                            </span>
                            <span className={'px-2 py-1 rounded bg-blue-900 text-blue-200'}>
                                {preview.changed.length} changed
                            </span>
                            <span className={'px-2 py-1 rounded bg-red-900 text-red-200'}>
                                {preview.removed.length} removed
                            </span>
                            <span className={'px-2 py-1 rounded bg-neutral-700'}>
                                {preview.skipped} excluded entries
                            </span>
                        </div>
                        {preview.files === 0 && (
                            <p className={'text-sm text-neutral-300 mt-3'}>
                                No supported assets were found. Open fastdl/, upload your files into the folders above,
                                then refresh this preview.
                            </p>
                        )}
                        <details className={'mt-4 text-sm'}>
                            <summary className={'cursor-pointer'}>Review file changes</summary>
                            {(['added', 'changed', 'removed'] as const).map((kind) => (
                                <div key={kind} className={'mt-3'}>
                                    <p className={'capitalize text-neutral-300'}>
                                        {kind} ({preview[kind].length})
                                    </p>
                                    <pre className={code}>
                                        {preview[kind].slice(0, 100).join('\n') || 'None'}
                                        {preview[kind].length > 100 ? '\n… first 100 shown' : ''}
                                    </pre>
                                </div>
                            ))}
                        </details>
                    </div>
                )}
            </section>
            <section className={box}>
                <div className={heading}>
                    <span className={step}>3</span>
                    <h2 className={'text-lg font-semibold'}>Choose how players download</h2>
                </div>
                <div
                    role={'radiogroup'}
                    aria-label={'Content delivery method'}
                    className={'grid grid-cols-1 md:grid-cols-2 gap-3'}
                >
                    {(['fastdl', 'workshop'] as const).map((value) => (
                        <label
                            key={value}
                            className={`rounded border p-4 cursor-pointer ${
                                delivery === value
                                    ? 'border-blue-500 bg-blue-900 bg-opacity-20'
                                    : 'border-neutral-600 bg-neutral-800'
                            }`}
                        >
                            <span className={'flex gap-2 items-center font-semibold'}>
                                <input
                                    type={'radio'}
                                    name={'delivery'}
                                    value={value}
                                    checked={delivery === value}
                                    onChange={() => setDelivery(value)}
                                />
                                {value === 'fastdl' ? 'FastDL website' : 'Steam Workshop addon'}
                            </span>
                            <span className={'block text-sm text-neutral-300 mt-2'}>
                                {value === 'fastdl'
                                    ? 'Host compressed downloads on the Panel. Copy the URL into your server.cfg.'
                                    : 'Build a .gma content pack with a cover and description. Publish it on Steam, then add it to your collection.'}
                            </span>
                        </label>
                    ))}
                </div>
                {delivery === 'fastdl' ? (
                    <div className={'mt-4'}>
                        <p className={'text-sm text-neutral-300'}>
                            Publish the exact files you reviewed. New .bz2 downloads and raw fallbacks replace the
                            previous publication only after all files are ready.
                        </p>
                        <Can action={['file.read', 'file.read-content', 'file.create', 'file.update']}>
                            <button
                                className={button}
                                disabled={working || !preview}
                                onClick={() =>
                                    run(async () => {
                                        await http.post(`${base}/fastdl/publish`, { preview: preview!.preview });
                                        setNotice(
                                            'Publishing FastDL files. Your download URL appears when compression finishes.'
                                        );
                                        await refresh();
                                    })
                                }
                            >
                                Publish FastDL downloads
                            </button>
                        </Can>
                        {!preview && (
                            <p className={'text-xs text-neutral-400 mt-2'}>Prepare an asset preview in step 2 first.</p>
                        )}
                    </div>
                ) : (
                    <Can action={['file.read', 'file.read-content', 'file.create', 'file.update']}>
                        {addon ? (
                            <p className={'text-sm text-neutral-300 mt-4'}>
                                Download your finished package below. To change its contents or details, create a new
                                asset preview in step 2.
                            </p>
                        ) : (
                            <AddonBuilder
                                key={base}
                                base={base}
                                preview={preview?.preview}
                                busy={working}
                                run={run}
                                refresh={refresh}
                                setNotice={setNotice}
                            />
                        )}
                    </Can>
                )}
                <Can action={['file.read', 'file.read-content', 'file.create', 'file.update']}>
                    {status?.fastdl.addon && (
                        <div className={'rounded border border-green-700 bg-green-900 bg-opacity-20 p-4 mt-5'}>
                            <p className={'font-semibold'}>Your Workshop addon package is ready</p>
                            <p className={'text-sm text-neutral-300 mt-1'}>
                                {status.fastdl.addon.name} · {formatBytes(status.fastdl.addon.bytes)}
                            </p>
                            <a
                                className={button + ' inline-block'}
                                href={`${base}/fastdl/addon/${status.fastdl.addon.id}`}
                            >
                                Download Workshop package (.zip)
                            </a>
                            <p className={'text-xs text-neutral-300 mt-2'}>
                                Contains addon.gma, preview.jpg, addon.json, your description and publishing
                                instructions. Download before{' '}
                                {new Date(status.fastdl.addon.expires * 1000).toLocaleTimeString()}; starting a new
                                preview replaces this package.
                            </p>
                            <ol className={'list-decimal pl-5 mt-4 text-sm text-neutral-200 space-y-2'}>
                                <li>
                                    Extract the ZIP and use Garry&apos;s Mod&apos;s gmpublish tool while signed into
                                    your Steam account. Follow PUBLISHING.txt inside.
                                </li>
                                <li>
                                    Open the new Workshop item on Steam, review its visibility and add it to your
                                    collection.
                                </li>
                                <li>
                                    <Link className={'underline text-blue-300'} to={`/server/${id}/workshop`}>
                                        Load your updated collection in Workshop
                                    </Link>
                                    , review and apply its download Lua, then restart the game server.
                                </li>
                            </ol>
                        </div>
                    )}
                </Can>
            </section>
            {(delivery === 'fastdl' || !!url) && (
                <section className={box}>
                    <div className={heading}>
                        <span className={step}>4</span>
                        <h2 className={'text-lg font-semibold'}>Configure FastDL in your game server</h2>
                    </div>
                    <div
                        className={'rounded border border-blue-500 bg-blue-900 bg-opacity-20 p-3 text-sm text-blue-200'}
                    >
                        Uploading or publishing files does not enable FastDL. You must set sv_downloadurl in server.cfg.
                    </div>
                    {url ? (
                        <>
                            <label className={'block text-sm mt-4'}>
                                Your server&apos;s download URL
                                <input
                                    aria-label={'FastDL download URL'}
                                    className={field}
                                    readOnly
                                    value={url}
                                    onFocus={(event) => event.target.select()}
                                />
                            </label>
                            <p className={'text-sm text-neutral-300'}>
                                Add these settings to /garrysmod/cfg/server.cfg, keeping the trailing slash:
                            </p>
                            <pre className={code}>{config}</pre>
                            <button className={button} onClick={() => copyValue(config, 'Server settings')}>
                                Copy server.cfg settings
                            </button>
                            <button className={secondary} onClick={() => copyValue(url, 'FastDL URL')}>
                                Copy URL
                            </button>
                            <Link
                                className={'underline inline-block mt-3 text-sm text-blue-300'}
                                to={`/server/${id}/files#/garrysmod/cfg`}
                            >
                                Open configuration folder ↗
                            </Link>
                            <p className={'text-sm text-neutral-300 mt-3'}>
                                Save server.cfg and restart the game server, or apply the settings in its console now.
                                Hosted files: {status?.fastdl.files}. This public URL works while the game server is
                                stopped.
                            </p>
                            <Can action={['file.read', 'file.read-content', 'file.create', 'file.update']}>
                                <details className={'mt-4 text-sm'}>
                                    <summary className={'cursor-pointer'}>Manage public download URL</summary>
                                    <p className={'text-neutral-300 mt-2'}>
                                        Rotating or revoking invalidates the old URL. Update server.cfg after rotating
                                        it.
                                    </p>
                                    {(['rotate', 'revoke'] as const).map((action) => (
                                        <button
                                            key={action}
                                            className={secondary}
                                            disabled={working}
                                            onClick={() =>
                                                run(async () => {
                                                    await http.post(`${base}/fastdl/${action}`);
                                                    setNotice(
                                                        action === 'rotate'
                                                            ? 'URL rotated. Update server.cfg with the new URL.'
                                                            : 'Public download URL revoked.'
                                                    );
                                                    await refresh();
                                                })
                                            }
                                        >
                                            {action === 'rotate' ? 'Rotate URL' : 'Revoke URL'}
                                        </button>
                                    ))}
                                </details>
                            </Can>
                        </>
                    ) : (
                        <p className={'text-sm text-neutral-300 mt-4'}>
                            Your unique URL and ready-to-copy settings appear here after publishing FastDL downloads in
                            step 3.
                        </p>
                    )}
                    <details className={'mt-5 text-sm border-t border-neutral-600 pt-4'}>
                        <summary className={'cursor-pointer'}>Make the game request custom files</summary>
                        <p className={'text-neutral-300 mt-3'}>
                            Files must be installed and registered by your game or addons. For custom assets that are
                            not already registered, add resource.AddFile calls in private server Lua. Use game-relative
                            paths without the fastdl/ prefix or .bz2 suffix.
                        </p>
                        <pre className={code}>
                            {'-- Private server Lua, for example:\nresource.AddFile("models/example/model.mdl")'}
                        </pre>
                        {preview?.resources && (
                            <button
                                className={secondary}
                                onClick={() =>
                                    copyValue(
                                        preview.resources!.map((path) => `resource.AddFile("${path}")`).join('\n'),
                                        'Asset registration Lua'
                                    )
                                }
                            >
                                Copy resource.AddFile calls for this preview
                            </button>
                        )}
                    </details>
                </section>
            )}
        </ToolkitPage>
    );
};
