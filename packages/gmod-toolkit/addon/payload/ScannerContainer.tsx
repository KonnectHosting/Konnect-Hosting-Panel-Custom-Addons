import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import http from '@/api/http';
import Can from '@/components/elements/Can';
import ToolkitPage, { useToolkit, button, secondary, box, field, formatBytes } from './ToolkitPage';

type Severity = 'critical' | 'high' | 'medium' | 'low';
interface Finding {
    fingerprint?: string;
    file: string;
    member: string;
    line: number;
    rule: string;
    severity: Severity;
    title: string;
    description: string;
    evidence: string;
    context: { line: number; text: string }[];
}
interface Scan {
    outdated?: boolean;
    cancelling?: boolean;
    reused?: number;
    scopeVersion?: string;
    includeArchives?: boolean;
    locations?: string[];
    id: string;
    status: string;
    phase: string;
    started: string;
    finished?: string | null;
    current: string;
    completed: number;
    total: number;
    pendingDirectories: number;
    visited: number;
    filesScanned: number;
    scripts: number;
    archives: number;
    bytes: number;
    uninspected: number;
    issues: { file: string; reason: string }[];
    findings: Finding[];
    findingCount: number;
    truncated: boolean;
    partial: boolean;
    message: string;
    waiting: boolean;
    rulesVersion: string;
}
interface Status {
    enabled: boolean;
    scan: Scan | null;
    rulesVersion: string;
    locations: string[];
    archiveLocations: string[];
}
const weight = { critical: 0, high: 1, medium: 2, low: 3 };
const colors = {
    critical: 'bg-red-800 text-red-100',
    high: 'bg-red-900 text-red-200',
    medium: 'bg-yellow-900 text-yellow-100',
    low: 'bg-neutral-700 text-neutral-200',
};
const visible = (text: string) =>
    text.replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, (char) => `\\u${char.charCodeAt(0).toString(16)}`);

export default () => {
    const { id, base, status, busy, error, notice, run, refresh, setNotice } = useToolkit<Status>('scanner', true);
    const [query, setQuery] = useState('');
    const [low, setLow] = useState(false);
    const [page, setPage] = useState(0);
    const [archives, setArchives] = useState(false);
    const [verify, setVerify] = useState(false);
    const [locations, setLocations] = useState<string[]>(['/garrysmod/addons']);
    const [specific, setSpecific] = useState('');
    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(`gmod-scanner-selection:${base}`) || 'null');
            setLocations(saved?.locations || ['/garrysmod/addons']);
            setSpecific(saved?.specific || '');
            setArchives(saved?.archives || false);
        } catch {
            setLocations(['/garrysmod/addons']);
            setSpecific('');
            setArchives(false);
        }
        setVerify(false);
        setQuery('');
        setPage(0);
    }, [base]);
    const scan = status?.scan;
    const running = scan?.status === 'running' || scan?.status === 'cancelling';
    const selected = [
        ...locations.filter((path) => archives || !status?.archiveLocations?.includes(path)),
        ...specific
            .split('\n')
            .map((path) => path.trim())
            .filter(Boolean),
    ];
    const groups = useMemo(() => {
        const filtered = (scan?.findings || []).filter(
            (finding) =>
                (low || ['critical', 'high'].includes(finding.severity)) &&
                `${finding.file} ${finding.member} ${finding.title}`.toLowerCase().includes(query.toLowerCase())
        );
        const files = new Map<string, Finding[]>();
        filtered.forEach((finding) => {
            const key = `${finding.file}${finding.member ? ' :: ' + finding.member : ''}`;
            files.set(key, [...(files.get(key) || []), finding]);
        });
        return [...files]
            .map(([file, findings]) => ({
                file,
                findings: findings.sort((a, b) => weight[a.severity] - weight[b.severity] || a.line - b.line),
            }))
            .sort(
                (a, b) =>
                    weight[a.findings[0].severity] - weight[b.findings[0].severity] || a.file.localeCompare(b.file)
            );
    }, [scan?.findings, query, low]);
    const lastPage = Math.max(0, Math.ceil(groups.length / 20) - 1);
    const currentPage = Math.min(page, lastPage);
    return (
        <ToolkitPage title={'Backdoor Scanner'} error={error} notice={notice}>
            <p className={'text-sm text-neutral-300 mb-5'}>
                Find suspicious Lua, hidden privilege grants and remote code loaders in your server files and packed
                addons.
            </p>
            <section className={box}>
                <p
                    className={
                        'rounded border border-yellow-600 bg-yellow-900 bg-opacity-30 p-3 text-sm text-yellow-100'
                    }
                >
                    Findings are leads for review, not proof of a backdoor. Legitimate admin tools and DRM can match.
                    Files are never executed, changed, deleted or automatically approved. A scan with no findings does
                    not prove a server is safe.
                </p>
                <p role={'status'} className={'mt-4 text-sm text-blue-200'}>
                    Manual scans only. Choose what to check, then click Start scan. Starting or restarting your server
                    never runs a scan or waits for one.
                </p>
                <Can action={['file.read', 'file.read-content', 'file.create', 'file.update']}>
                    <button
                        className={secondary}
                        disabled={busy || !status}
                        onClick={() =>
                            run(async () => {
                                const { data } = await http.post<{ message: string }>(`${base}/scanner/settings`, {
                                    enabled: !status?.enabled,
                                });
                                setNotice(data.message);
                                await refresh();
                            })
                        }
                    >
                        {status?.enabled === false ? 'Enable scanner' : 'Disable scanner'}
                    </button>
                </Can>
                {status?.enabled === false && (
                    <p className={'mt-3 text-sm'}>The scanner is disabled for this server.</p>
                )}
                <fieldset disabled={busy || running || status?.enabled === false} className={'mt-4'}>
                    <legend className={'font-semibold text-sm'}>Choose files or folders</legend>
                    <p className={'mt-2 text-xs text-neutral-300'}>
                        Only selected locations are searched. To check one addon, clear Addons and enter its folder
                        below.
                    </p>
                    <div className={'grid gap-2 mt-3 sm:grid-cols-2'}>
                        {(status?.locations || ['/garrysmod/addons']).map((path) => (
                            <label key={path} className={'flex items-start gap-2 text-sm break-all'}>
                                <input
                                    type={'checkbox'}
                                    checked={locations.includes(path)}
                                    onChange={(event) =>
                                        setLocations(
                                            event.target.checked
                                                ? [...locations, path]
                                                : locations.filter((item) => item !== path)
                                        )
                                    }
                                />
                                {path}
                            </label>
                        ))}
                    </div>
                    {archives && (
                        <div className={'grid gap-2 mt-3 sm:grid-cols-2'}>
                            {status?.archiveLocations?.map((path) => (
                                <label key={path} className={'flex items-start gap-2 text-sm break-all'}>
                                    <input
                                        type={'checkbox'}
                                        checked={locations.includes(path)}
                                        onChange={(event) =>
                                            setLocations(
                                                event.target.checked
                                                    ? [...locations, path]
                                                    : locations.filter((item) => item !== path)
                                            )
                                        }
                                    />
                                    {path}
                                </label>
                            ))}
                        </div>
                    )}
                    <label htmlFor={'scan-specific'} className={'block text-sm mt-4'}>
                        Specific files or folders (one per line)
                    </label>
                    <textarea
                        id={'scan-specific'}
                        className={field}
                        rows={3}
                        value={specific}
                        onChange={(event) => setSpecific(event.target.value)}
                        placeholder={'/garrysmod/addons/my_addon/lua\n/garrysmod/lua/autorun/server/example.lua'}
                    />
                </fieldset>
                <label className={'flex items-start gap-2 mt-4 text-sm'}>
                    <input
                        id={'scan-archives'}
                        type={'checkbox'}
                        className={'mt-1'}
                        checked={archives}
                        disabled={busy || running || status?.enabled === false}
                        onChange={(event) => setArchives(event.target.checked)}
                    />
                    <span>
                        Inspect packed addons in selected folders
                        <span className={'block text-xs text-neutral-300 mt-1'}>
                            Optional: Wings must transfer entire archives, including their assets. Loose code is
                            inspected first. Select cache folders above only if you want them checked.
                        </span>
                    </span>
                </label>
                <label className={'flex items-start gap-2 mt-3 text-sm'}>
                    <input
                        id={'scan-verify'}
                        type={'checkbox'}
                        className={'mt-1'}
                        checked={verify}
                        disabled={busy || running || status?.enabled === false}
                        onChange={(event) => setVerify(event.target.checked)}
                    />
                    <span>
                        Recheck file contents even when size and modification time are unchanged
                        <span className={'block text-xs text-neutral-300 mt-1'}>
                            Normal scans reuse previous results for unchanged metadata. This option downloads and hashes
                            selected files again.
                        </span>
                    </span>
                </label>
                <div className={'flex flex-wrap items-center mt-3'}>
                    <button
                        className={button}
                        disabled={busy || running || !status || !status.enabled || selected.length === 0}
                        onClick={() =>
                            run(async () => {
                                await http.post(`${base}/scanner/start`, { archives, verify, locations: selected });
                                localStorage.setItem(
                                    `gmod-scanner-selection:${base}`,
                                    JSON.stringify({ locations, specific, archives })
                                );
                                setPage(0);
                                await refresh();
                            })
                        }
                    >
                        {scan?.cancelling
                            ? 'Cancelling…'
                            : running
                            ? 'Scanning…'
                            : scan
                            ? 'Run a new scan'
                            : 'Start scan'}
                    </button>
                    {running && !scan?.cancelling && (
                        <button
                            className={secondary}
                            disabled={busy}
                            onClick={() =>
                                run(async () => {
                                    await http.post(`${base}/scanner/cancel`);
                                    await refresh();
                                })
                            }
                        >
                            Cancel scan
                        </button>
                    )}
                    <button
                        className={secondary}
                        disabled={busy}
                        onClick={() =>
                            run(async () => {
                                await refresh();
                            })
                        }
                    >
                        Refresh results
                    </button>
                    {scan && (
                        <button
                            className={secondary}
                            onClick={() => {
                                const url = URL.createObjectURL(
                                    new Blob([JSON.stringify(scan, null, 2)], { type: 'application/json' })
                                );
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `backdoor-scan-${scan.id.slice(0, 12)}.json`;
                                link.click();
                                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                            }}
                        >
                            Download report
                        </button>
                    )}
                </div>
                <details className={'mt-4 text-sm text-neutral-300'}>
                    <summary className={'cursor-pointer'}>What is scanned and how detections work</summary>
                    <p className={'mt-3'}>
                        Scans run only when requested here. Unchanged results are reused on later manual scans; recheck
                        contents if you want selected files downloaded and hashed again. Cancellation stops scanner work
                        without changing the game server.
                    </p>
                    <p className={'mt-3'}>
                        Your selected folders are checked for loose .lua, .txt, .cfg, .vmt, .json, .dat and .js code in
                        these locations:
                    </p>
                    <ul className={'mt-2 space-y-1 text-xs font-mono break-all'}>
                        {status?.locations?.map((path) => (
                            <li key={path}>{path}</li>
                        ))}
                    </ul>
                    <p className={'mt-3'}>
                        Packed-addon mode checks GMA archives only in selected folders. Optional Workshop cache
                        locations:
                    </p>
                    <ul className={'mt-2 space-y-1 text-xs font-mono break-all'}>
                        {status?.archiveLocations?.map((path) => (
                            <li key={path}>{path}</li>
                        ))}
                    </ul>
                    <p className={'mt-3'}>
                        The container root is never searched. FastDL, backups, game engines, maps, models, sounds and
                        other unrelated folders are excluded. Material .vmt files remain included because they can
                        conceal Lua payloads.
                    </p>
                    <p className={'mt-2'}>
                        Looks for network-to-Lua execution, HTTP loaders, hardcoded identities near admin grants,
                        changed authorization functions, sensitive commands, encoded loaders and historical backdoor
                        channel names. Common global/debug access and ordinary HTTP requests are low-priority
                        indicators, hidden by default. No addon is trusted just because of its name.
                    </p>
                    <p className={'mt-2'}>
                        Native binaries, bytecode, unsupported archives, symbolic links and oversized or unreadable
                        files are listed as uninspected. Server disk usage is not a scan-size limit. Read budgets apply
                        only to selected code and optional archives: 512 MiB of loose code, separately 4 GiB of packed
                        archives, 2 MiB per text file and 1 GiB per archive. Work is incremental, limited to 50,000
                        candidates and 2 hours; hitting a budget retains the results already collected. Dynamic
                        obfuscation, cross-file execution and code downloaded after the scan can evade static detection.
                        The scan is not a live runtime monitor.
                    </p>
                </details>
                <p className={'text-xs text-neutral-400 mt-4'}>
                    Detection rules: {scan?.rulesVersion || status?.rulesVersion || 'Loading…'}
                </p>
            </section>
            {scan && (
                <section className={box}>
                    <h2 className={'text-lg font-semibold capitalize'}>
                        {scan.status === 'complete' ? 'Scan finished' : scan.status}
                    </h2>
                    {!scan.outdated ? (
                        <p className={'text-sm text-neutral-300 mt-2'}>
                            {scan.includeArchives
                                ? 'Manual scan of selected locations with packed addons enabled.'
                                : 'Manual scan of selected locations. Packed archives were not included.'}
                        </p>
                    ) : (
                        <p role={'alert'} className={'text-sm text-yellow-200 mt-2'}>
                            This report used older detection rules or scan locations. Its findings are hidden. Choose
                            locations and request a new manual scan.
                        </p>
                    )}
                    <p className={'text-sm text-neutral-300 mt-2'}>
                        {scan.filesScanned} files checked · {scan.reused || 0} unchanged results reused · {scan.scripts}{' '}
                        text entries · {scan.archives} archives · {formatBytes(scan.bytes)} read
                    </p>
                    {running && (
                        <div role={'status'} className={'mt-4 text-sm'}>
                            <p>
                                {scan.phase === 'discover'
                                    ? `Finding files: ${scan.visited} entries checked, ${scan.pendingDirectories} folders remaining.`
                                    : `Inspecting files: ${scan.completed}/${scan.total}.`}
                            </p>
                            {scan.phase !== 'discover' && (
                                <progress
                                    className={'w-full mt-2'}
                                    value={scan.completed}
                                    max={Math.max(1, scan.total)}
                                    aria-label={'Scan progress'}
                                />
                            )}
                            <p className={'mt-2 break-all text-neutral-300'}>{visible(scan.current)}</p>
                            {scan.waiting && (
                                <p className={'mt-2 text-yellow-200'}>
                                    Waiting for the Panel queue. Recovery is being retried; ask your host to check the
                                    queue if progress stays stopped.
                                </p>
                            )}
                        </div>
                    )}
                    {scan.message && <p className={'mt-3 text-sm'}>{scan.message}</p>}
                    {scan.finished && (
                        <p className={'text-xs text-neutral-400 mt-2'}>
                            Finished {new Date(scan.finished).toLocaleString()}
                        </p>
                    )}
                    {(scan.uninspected > 0 ||
                        scan.truncated ||
                        scan.status === 'failed' ||
                        scan.status === 'cancelled') && (
                        <p role={'alert'} className={'text-yellow-200 mt-4 text-sm'}>
                            Coverage is incomplete. {scan.uninspected} files or folders could not be inspected.
                            {scan.truncated && ' The finding limit was reached; additional results may be omitted.'}
                        </p>
                    )}
                    {scan.issues.length > 0 && (
                        <details className={'mt-4 text-sm'}>
                            <summary className={'cursor-pointer'}>
                                Uninspected files and coverage details ({scan.uninspected})
                            </summary>
                            <ul className={'mt-3 space-y-3 max-h-80 overflow-auto'}>
                                {scan.issues.map((issue, index) => (
                                    <li key={index}>
                                        <p className={'break-all font-mono text-xs'}>{visible(issue.file)}</p>
                                        <p className={'text-neutral-300'}>{issue.reason}</p>
                                    </li>
                                ))}
                            </ul>
                            {scan.uninspected > scan.issues.length && (
                                <p className={'mt-2 text-neutral-300'}>
                                    Only the first {scan.issues.length} coverage details are retained.
                                </p>
                            )}
                        </details>
                    )}
                    <div className={'mt-6 border-t border-neutral-600 pt-4'}>
                        <h2 className={'text-lg font-semibold'}>
                            Findings for review ({scan.findingCount}
                            {scan.truncated ? '+' : ''})
                        </h2>
                        <label className={'block text-sm mt-3'} htmlFor={'scan-filter'}>
                            Filter by file or detection
                        </label>
                        <input
                            id={'scan-filter'}
                            className={field}
                            value={query}
                            onChange={(event) => {
                                setQuery(event.target.value);
                                setPage(0);
                            }}
                            placeholder={'Search findings…'}
                        />
                        <label className={'text-sm flex items-center gap-2 mt-3'}>
                            <input
                                id={'scan-low-priority'}
                                type={'checkbox'}
                                checked={low}
                                onChange={(event) => {
                                    setLow(event.target.checked);
                                    setPage(0);
                                }}
                            />
                            Show additional review indicators (medium and low)
                        </label>
                        <p className={'text-sm text-neutral-300 mt-3'}>
                            {groups.length} matching files. Expand a file to inspect its code and explanations.
                        </p>
                        {groups.slice(currentPage * 20, currentPage * 20 + 20).map(({ file, findings }, index) => (
                            <details
                                key={file}
                                className={'mt-4 border border-neutral-600 rounded overflow-hidden'}
                                open={index === 0 || undefined}
                            >
                                <summary className={'cursor-pointer p-3 bg-neutral-800'}>
                                    <span className={'break-all font-mono text-xs'}>{visible(file)}</span>
                                    <span
                                        className={
                                            'inline-block ml-2 mt-1 px-2 py-1 rounded text-xs ' +
                                            colors[findings[0].severity]
                                        }
                                    >
                                        {findings[0].severity.toUpperCase()} · {findings.length} results
                                    </span>
                                </summary>
                                <div className={'p-3'}>
                                    <Link
                                        className={'text-blue-300 text-sm'}
                                        to={`/server/${id}/files#${(
                                            findings[0].file.substring(0, findings[0].file.lastIndexOf('/')) || '/'
                                        )
                                            .split('/')
                                            .map(encodeURIComponent)
                                            .join('/')}`}
                                    >
                                        Open containing folder ↗
                                    </Link>
                                </div>
                                {findings.map((finding, n) => (
                                    <div key={n} className={'p-3 border-t border-neutral-600'}>
                                        <h3 className={'font-semibold text-sm'}>
                                            <span
                                                className={
                                                    'inline-block px-2 py-1 rounded mr-2 text-xs ' +
                                                    colors[finding.severity]
                                                }
                                            >
                                                {finding.severity.toUpperCase()}
                                            </span>
                                            {finding.title} · line {finding.line}
                                        </h3>
                                        <p className={'text-sm text-neutral-300 mt-2'}>{finding.description}</p>
                                        {finding.evidence && (
                                            <p className={'font-mono text-xs break-all mt-2'}>
                                                {visible(finding.evidence)}
                                            </p>
                                        )}
                                        <pre
                                            className={'mt-3 rounded bg-neutral-900 overflow-auto p-3 text-xs max-h-64'}
                                        >
                                            {finding.context.map((line) => (
                                                <span
                                                    key={line.line}
                                                    className={
                                                        'block ' +
                                                        (line.line === finding.line
                                                            ? 'bg-yellow-900 text-yellow-100'
                                                            : 'text-neutral-300')
                                                    }
                                                >
                                                    <span className={'inline-block w-10 select-none'}>{line.line}</span>
                                                    {visible(line.text)}
                                                    {'\n'}
                                                </span>
                                            ))}
                                        </pre>
                                        <p className={'text-xs text-neutral-400 mt-2'}>Rule: {finding.rule}</p>
                                    </div>
                                ))}
                            </details>
                        ))}
                        {groups.length === 0 && (
                            <p className={'py-6 text-neutral-300 text-sm'}>
                                {scan.findingCount === 0
                                    ? 'No findings in the files inspected so far. Review coverage before drawing conclusions.'
                                    : 'No findings match these filters. Additional review indicators are hidden by default.'}
                            </p>
                        )}
                        {lastPage > 0 && (
                            <div className={'flex flex-wrap items-center mt-4 text-sm'}>
                                <button
                                    className={secondary}
                                    disabled={currentPage === 0}
                                    onClick={() => setPage(currentPage - 1)}
                                >
                                    Previous
                                </button>
                                <span className={'mt-2 mr-2'}>
                                    Page {currentPage + 1} of {lastPage + 1}
                                </span>
                                <button
                                    className={secondary}
                                    disabled={currentPage === lastPage}
                                    onClick={() => setPage(currentPage + 1)}
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </section>
            )}
        </ToolkitPage>
    );
};
