import React, { useEffect, useState } from 'react';
import http from '@/api/http';
import Can from '@/components/elements/Can';
import { Link } from 'react-router-dom';
import copy from 'copy-to-clipboard';
import ToolkitPage, { useToolkit, button, box, field, code } from './ToolkitPage';

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
interface DownloadPreview {
    preview: string;
    files: number;
    bytes: number;
    skipped: number;
    added: string[];
    changed: string[];
    removed: string[];
}

interface Status {
    fastdl: Fastdl;
}
export default () => {
    const { id, base, status, busy, error, notice, run, refresh, setNotice, setError } = useToolkit<Status>(
        'fastdl',
        true
    );
    const [download, setDownload] = useState<DownloadPreview>();
    useEffect(() => {
        setDownload(status?.fastdl.preview);
    }, [status]);
    const fastdlConfig = status?.fastdl.url
        ? `sv_downloadurl "${status.fastdl.url}"\nsv_allowdownload 1\nsv_allowupload 0`
        : '';
    const copyValue = (value: string, label: string) => {
        if (copy(value)) setNotice(`${label} copied.`);
        else setError('Copy failed. Select the text and copy it manually.');
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
        <ToolkitPage title={'FastDL'} error={error} notice={notice}>
            <section className={box}>
                <h2 className={'text-xl mb-2'}>FastDL</h2>
                <p>
                    Upload your download assets into this server&apos;s dedicated fastdl/ folder, then preview and
                    publish them here. The Panel creates compressed .bz2 downloads automatically and hosts your
                    published files at a unique URL.
                </p>
                <h3 className={'text-lg mt-4 mb-2'}>1. Upload files into fastdl/</h3>
                <p>
                    Use Files or SFTP. Create the upload folders below with Prepare upload folders, then keep your
                    game-relative filenames and subfolders inside /home/container/fastdl/:
                </p>
                <ul className={'list-disc pl-6 mt-2'}>
                    <li>Maps: /fastdl/maps/ (for example maps/rp_example.bsp)</li>
                    <li>Materials and textures: /fastdl/materials/ (.vmt, .vtf)</li>
                    <li>Models and companion files: /fastdl/models/ (.mdl, .vvd, .vtx, .phy, .ani)</li>
                    <li>Sounds: /fastdl/sound/ (.wav, .mp3, .ogg)</li>
                    <li>Particles: /fastdl/particles/ (.pcf)</li>
                    <li>Fonts: /fastdl/resource/fonts/ (.ttf, .otf)</li>
                </ul>
                <Can action={['file.read', 'file.read-content', 'file.create', 'file.update']}>
                    <button
                        className={button}
                        disabled={busy}
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
                <Link className={'underline inline-block mt-3'} to={`/server/${id}/files#/fastdl`}>
                    Open fastdl/ to upload assets
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
                    private server Lua. Workshop client downloads are managed on the Workshop page.
                </p>
                {status?.fastdl.message && <p className={'mt-3'}>{status.fastdl.message}</p>}
                {status?.fastdl.job && (
                    <div role={'status'} className={'mt-3'}>
                        {status.fastdl.job.status === 'running' ? (
                            <p>
                                {status.fastdl.job.phase === 'scan'
                                    ? `Scanning fastdl/ folders: ${status.fastdl.job.inspected} entries checked, ${status.fastdl.job.total} eligible files found, ${status.fastdl.job.pendingDirectories} folders remaining.`
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
        </ToolkitPage>
    );
};
