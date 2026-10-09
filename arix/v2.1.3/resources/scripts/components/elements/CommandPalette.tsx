import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStoreState } from 'easy-peasy';
import Input from './Input';
import Code from './Code';
import Icon from '@/components/admin/elements/IconMap';
import getServers from '@/api/getServers';
import getServer, { Server } from '@/api/server/getServer';
import powerAction from '@/api/server/powerAction';
import { LinkCategory, LinkItem } from '@/api/admin/Link';
import { ApplicationStore } from '@/state';
import { LuCornerDownLeft } from 'react-icons/lu';
import createServerBackup from '@/api/server/backups/createServerBackup';
import useFlash from '@/plugins/useFlash';
import FlashMessageRender from '../FlashMessageRender';
import { httpErrorToHuman } from '@/api/http';
import Spinner from '@/components/elements/Spinner';
import { UAParser } from 'ua-parser-js';

interface PaletteItem {
    key: string;
    group: string;
    label: string;
    icon: string;
    onSelect: () => void;
}

const QUICK_LINKS = [
    { label: 'Account Settings', icon: 'HiOutlineUserCircle', path: '/account' },
    { label: 'Account Security', icon: 'HiOutlineShieldCheck', path: '/account/security' },
    { label: 'API Keys', icon: 'HiOutlineKey', path: '/account/api-keys' },
];

const SERVER_ACTIONS = [
    { label: 'Start Server', icon: 'HiOutlinePlay', permission: 'control.start', signal: 'power.start' },
    { label: 'Restart Server', icon: 'HiOutlineRefresh', permission: 'control.restart', signal: 'power.restart' },
    { label: 'Stop Server', icon: 'HiOutlineStop', permission: 'control.stop', signal: 'power.stop' },
    { label: 'Create Backup', icon: 'HiOutlineArchive', permission: 'backup.create', signal: 'backup.create' },
];

const isVisible = (
    entry: { nests?: number[]; eggs?: number[]; permission?: string[] },
    nestId?: number,
    eggId?: number,
    permissions: string[] = []
) => {
    const hasNestRestrictions = !!entry.nests?.length;
    const hasEggRestrictions = !!entry.eggs?.length;
    const nestMatches = hasNestRestrictions && entry.nests!.includes(nestId ?? -1);
    const eggMatches = hasEggRestrictions && entry.eggs!.includes(eggId ?? -1);

    if ((hasNestRestrictions || hasEggRestrictions) && !nestMatches && !eggMatches) return false;

    const required = (entry.permission ?? []).filter((p) => p && p.trim().length > 0);
    if (required.length === 0) return true;
    if (permissions[0] === '*') return true;

    return required.some(
        (permission) =>
            (permission.endsWith('.*') && permissions.some((p) => p.startsWith(permission.split('.')[0]))) ||
            permissions.includes(permission)
    );
};

const matches = (query: string, label: string) => !query || label.toLowerCase().includes(query.toLowerCase());

export default () => {
    const history = useHistory();
    const location = useLocation();
    const { t } = useTranslation('arix/navigation');
    const links = useStoreState((state: ApplicationStore) => state.settings.data!.arix.links);
    const { clearFlashes, addFlash } = useFlash();
    const [isLoading, setIsLoading] = useState(true);

    const [visible, setVisible] = useState(false);
    const [input, setInput] = useState('');
    const [server, setServer] = useState<Server | null>(null);
    const [permissions, setPermissions] = useState<string[]>([]);
    const [servers, setServers] = useState<Server[]>([]);
    const [selector, setSelector] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const { os } = UAParser(navigator.userAgent);
    const isMac = os.name === 'macOS';

    useEffect(() => {
        const match = location.pathname.match(/^\/server\/([^/]+)/);
        if (!match || server?.id === match[1]) return;

        getServer(match[1])
            .then(([data, perms]) => {
                setServer(data);
                setPermissions(perms);
            })
            .catch((error) => console.error(error));
    }, [location.pathname]);

    useEffect(() => {
        const handleShortcut = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setVisible(true);
                inputRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleShortcut);
        return () => window.removeEventListener('keydown', handleShortcut);
    }, []);

    const close = () => {
        setVisible(false);
        setInput('');
        setSelector(0);
        inputRef.current?.blur();
    };

    useEffect(() => {
        if (!visible || server) return;

        setIsLoading(true);

        const timeout = window.setTimeout(() => {
            getServers({ query: input })
                .then((response) => {
                    setServers(response.items.slice(0, 8));
                    setSelector(0);
                })
                .catch((error) => console.error(error))
                .finally(() => setIsLoading(false));
        }, 200);

        return () => window.clearTimeout(timeout);
    }, [visible, server, input]);

    const items = useMemo<PaletteItem[]>(() => {
        if (!server) {
            const quick = QUICK_LINKS.filter((link) => matches(input, link.label)).map((link) => ({
                key: `quick-${link.path}`,
                group: 'Quick Links',
                label: link.label,
                icon: link.icon,
                onSelect: () => {
                    history.push(link.path);
                    close();
                },
            }));

            const found = servers.map((candidate) => ({
                key: candidate.uuid,
                group: 'Servers',
                label: candidate.name,
                icon: 'HiOutlineServer',
                onSelect: () => {
                    setServer(candidate);
                    setInput('');
                    setSelector(0);
                    getServer(candidate.uuid)
                        .then(([, perms]) => setPermissions(perms))
                        .catch((error) => console.error(error));
                },
            }));

            return [...(isLoading ? [] : found), ...quick];
        }

        const result: PaletteItem[] = [];

        SERVER_ACTIONS.forEach((action) => {
            if (!isVisible({ permission: [action.permission] }, server.nestId, server.eggId, permissions)) return;
            if (!matches(input, action.label)) return;

            result.push({
                key: `action-${action.signal}`,
                group: 'Actions',
                label: action.label,
                icon: action.icon,
                onSelect: () => {
                    clearFlashes();

                    if (action.signal.includes('power.')) {
                        powerAction(server.uuid, action.signal.replace('power.', ''))
                            .then(() => {
                                addFlash({
                                    type: 'success',
                                    key: 'command-palette',
                                    message: 'Server ' + action.label + ' initiated successfully.',
                                });
                            })
                            .catch((error) => {
                                addFlash({
                                    type: 'error',
                                    key: 'command-palette',
                                    title: 'Failed to ' + action.label,
                                    message: httpErrorToHuman(error),
                                });
                            });
                    }
                    if (action.signal === 'backup.create') {
                        createServerBackup(server.uuid, {
                            isLocked: false,
                        })
                            .then(() => {
                                addFlash({
                                    type: 'success',
                                    key: 'command-palette',
                                    message: 'Server backup created successfully.',
                                });
                            })
                            .catch((error) => {
                                addFlash({
                                    type: 'error',
                                    key: 'command-palette',
                                    title: 'Failed to create server backup',
                                    message: httpErrorToHuman(error),
                                });
                            });
                    }
                    close();
                },
            });
        });

        Object.values(links ?? {}).forEach((category: LinkCategory) => {
            if (!isVisible(category, server.nestId, server.eggId, permissions)) return;

            category.links.forEach((link: LinkItem) => {
                if (!isVisible(link, server.nestId, server.eggId, permissions)) return;
                if (!matches(input, t(link.name))) return;

                result.push({
                    key: link.url,
                    group: 'Quick Links',
                    label: t(link.name),
                    icon: link.icon,
                    onSelect: () => {
                        if (link.url.includes('http')) {
                            window.open(link.url, '_blank');
                        } else {
                            history.push(`/server/${server.id}${link.url === '/' ? '' : link.url}`);
                        }
                        close();
                    },
                });
            });
        });

        return result;
    }, [server, servers, links, permissions, input, isLoading]);

    useEffect(() => setSelector(0), [items.length]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!visible) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (items.length === 0) return;
                setSelector((prev) => (prev + 1) % items.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (items.length === 0) return;
                setSelector((prev) => (prev - 1 + items.length) % items.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                items[selector]?.onSelect();
            } else if (e.key === 'Backspace' && input === '' && server) {
                setServer(null);
                setPermissions([]);
            } else if (e.key === 'Escape') {
                setVisible(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [visible, selector, items, input, server]);

    return (
        <div className='relative w-full max-w-sm' style={{ flex: '1 0 auto' }}>
            <FlashMessageRender byKey='command-palette' />
            <Input as={'label'} className='flex w-full !p-2 items-center gap-2'>
                {server && <Code className='whitespace-nowrap'>{server.name}</Code>}
                <input
                    ref={inputRef}
                    className='w-full py-1 px-2 bg-transparent outline-none border-none'
                    onFocus={() => setVisible(true)}
                    onBlur={() => setVisible(false)}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={server ? 'Search actions or links...' : 'Search servers or pages...'}
                />
                {!visible && (
                    <p className='font-mono text-xs px-2 py-1 inline-block rounded whitespace-nowrap bg-gray-700'>
                        {isMac ? '⌘' : 'Ctrl'} + K
                    </p>
                )}
            </Input>
            {visible && (
                <div className='absolute top-full mt-1 w-full max-w-md bg-gray-600 rounded-component shadow-lg z-10 overflow-y-auto max-h-80'>
                    {!server && isLoading && (
                        <div>
                            <div className='px-4 pt-2 pb-1 text-xs uppercase tracking-wide text-gray-400'>Servers</div>
                            <div className='flex justify-center items-center py-3'>
                                <Spinner size='small' />
                            </div>
                        </div>
                    )}
                    {items.length === 0
                        ? !isLoading && <div className='px-4 py-2 text-sm text-gray-400'>No results found.</div>
                        : items.map((item, index) => (
                              <React.Fragment key={item.key}>
                                  {(index === 0 || items[index - 1].group !== item.group) && (
                                      <div className='px-4 pt-2 pb-1 text-xs uppercase tracking-wide text-gray-400'>
                                          {item.group}
                                      </div>
                                  )}
                                  <button
                                      type='button'
                                      className={`flex justify-between items-center gap-2 w-full text-left px-4 py-2 text-sm text-gray-300 cursor-pointer ${
                                          selector === index ? 'bg-gray-500' : 'hover:bg-gray-500/60'
                                      }`}
                                      onMouseDown={(e) => e.preventDefault()}
                                      onMouseEnter={() => setSelector(index)}
                                      onClick={() => item.onSelect()}
                                  >
                                      <span className='flex items-center gap-2'>
                                          <Icon name={item.icon} className='w-4 h-4 text-gray-100' />
                                          {item.label}
                                      </span>
                                      {selector === index && (
                                          <div className='text-xs flex items-center gap-x-1'>
                                              <LuCornerDownLeft /> Enter
                                          </div>
                                      )}
                                  </button>
                              </React.Fragment>
                          ))}
                </div>
            )}
        </div>
    );
};
