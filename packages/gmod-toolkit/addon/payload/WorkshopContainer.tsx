import React, { useState } from 'react';
import http from '@/api/http';
import Can from '@/components/elements/Can';
import ToolkitPage, { useToolkit, button, box, field, code } from './ToolkitPage';

interface Status {
    backups: { id: string; created: string }[];
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

export default () => {
    const { base, status, busy, error, notice, run, refresh, setNotice } = useToolkit<Status>('workshop');
    const [collection, setCollection] = useState('');
    const [lua, setLua] = useState<LuaPreview>();
    return (
        <ToolkitPage title={'Workshop'} error={error} notice={notice}>
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
        </ToolkitPage>
    );
};
