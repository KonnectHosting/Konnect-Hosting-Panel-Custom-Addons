import React, { useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import { UAParser } from 'ua-parser-js';
import Badge from './Badge';

type HotkeyScope = 'global' | 'server';

interface HotkeyContext {
    history: ReturnType<typeof useHistory>;
    serverId: string | null;
}

interface HotkeyBinding {
    id: string;
    label: string;
    description?: string;
    scope: HotkeyScope;
    keys: string[];
    action?: (context: HotkeyContext) => void;
}

const SERVER_ROUTE_HOTKEYS: Array<
    Pick<HotkeyBinding, 'id' | 'label' | 'description'> & { key: string; route: string }
> = [
    { id: 'server-dashboard', label: 'Server dashboard', key: '1', route: '/' },
    { id: 'server-console', label: 'Server console', key: '2', route: '/console' },
    { id: 'server-files', label: 'Server files', key: 'F', route: '/files' },
    { id: 'server-databases', label: 'Server databases', key: '3', route: '/databases' },
    { id: 'server-backups', label: 'Server backups', key: '4', route: '/backups' },
    { id: 'server-network', label: 'Server network', key: '5', route: '/network' },
    { id: 'server-schedules', label: 'Server schedules', key: '6', route: '/schedules' },
    { id: 'server-users', label: 'Server users', key: 'U', route: '/users' },
    { id: 'server-startup', label: 'Server startup', key: '7', route: '/startup' },
    { id: 'server-settings', label: 'Server settings', key: '8', route: '/settings' },
];

const getServerId = (pathname: string): string | null => pathname.match(/^\/server\/([^/]+)/)?.[1] ?? null;

const isEditableTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;

    return (
        target.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
    );
};

const normalizeRoute = (serverId: string, route: string): string => `/server/${serverId}${route === '/' ? '' : route}`;

const isHotkeyPressed = (event: KeyboardEvent, keys: string[], modifierKey: string): boolean => {
    const primaryKey = keys[keys.length - 1].toLowerCase();
    const needsModifier = keys.includes(modifierKey);

    if (needsModifier && (modifierKey === 'Cmd' ? !event.metaKey : !event.ctrlKey)) return false;
    if (!needsModifier && (event.metaKey || event.ctrlKey)) return false;
    if (event.altKey !== keys.includes('Alt')) return false;
    if (event.shiftKey !== keys.includes('Shift')) return false;

    return event.key.toLowerCase() === primaryKey;
};

const ShortcutKeys = ({ keys }: { keys: string[] }) => (
    <p className='font-mono px-2 py-1 rounded whitespace-nowrap bg-gray-800 flex items-center gap-1'>
        {keys.map((key, index) => (
            <React.Fragment key={`${key}-${index}`}>
                {index > 0 && <span className={'text-gray-400'}>+</span>}
                <span>{key === 'Shift' ? '\u21e7' : key === 'Cmd' ? '\u2318' : key}</span>
            </React.Fragment>
        ))}
    </p>
);

const HotkeyManager = () => {
    const history = useHistory();
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const serverId = getServerId(location.pathname);

    const { os } = UAParser(navigator.userAgent);
    const modifierKey = os.name === 'macOS' ? 'Cmd' : 'Ctrl';

    const hotkeys = useMemo<HotkeyBinding[]>(
        () => [
            {
                id: 'show-hotkeys',
                label: 'Show hotkeys',
                scope: 'global',
                keys: [modifierKey, 'Shift', 'K'],
                action: () => setOpen(true),
            },
            {
                id: 'dashboard',
                label: 'Dashboard',
                scope: 'global',
                keys: [modifierKey, 'Shift', 'H'],
                action: ({ history }) => history.push('/'),
            },
            {
                id: 'account',
                label: 'Account settings',
                scope: 'global',
                keys: [modifierKey, 'Shift', 'M'],
                action: ({ history }) => history.push('/account'),
            },
            ...SERVER_ROUTE_HOTKEYS.map<HotkeyBinding>((hotkey) => ({
                id: hotkey.id,
                label: hotkey.label,
                description: hotkey.description,
                scope: 'server',
                keys: [modifierKey, 'Shift', hotkey.key],
                action: ({ history, serverId }) => {
                    if (!serverId) return;
                    history.push(normalizeRoute(serverId, hotkey.route));
                },
            })),
        ],
        [modifierKey]
    );

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const match = hotkeys.find(
                (hotkey) =>
                    hotkey.action &&
                    isHotkeyPressed(event, hotkey.keys, modifierKey) &&
                    (hotkey.scope === 'global' || serverId)
            );

            if (!match) return;
            if (match.id !== 'show-hotkeys' && isEditableTarget(event.target)) return;

            if (match.id === 'show-hotkeys') {
                event.preventDefault();
                event.stopImmediatePropagation();
            } else {
                event.preventDefault();
            }

            match.action?.({ history, serverId });
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [history, hotkeys, modifierKey, serverId]);

    const globalHotkeys = hotkeys.filter((hotkey) => hotkey.scope === 'global');
    const serverHotkeys = hotkeys.filter((hotkey) => hotkey.scope === 'server');

    const renderHotkey = (hotkey: HotkeyBinding) => (
        <div
            key={hotkey.id}
            className={'flex items-center justify-between gap-4 border-b border-gray-500 py-3 last:border-0'}
        >
            <div className={'min-w-0'}>
                <p className={'text-gray-100'}>{hotkey.label}</p>
                {hotkey.description && <p className={'mt-1 text-sm text-gray-300'}>{hotkey.description}</p>}
            </div>
            <ShortcutKeys keys={hotkey.keys} />
        </div>
    );

    return (
        <Dialog
            open={open}
            onClose={() => setOpen(false)}
            title={'Hotkeys'}
            description={'Server hotkeys only work while a server is open.'}
        >
            <div className={'mt-6 space-y-6'}>
                <section>
                    <p className={'mb-2 font-medium'}>Global</p>
                    <div>{globalHotkeys.map(renderHotkey)}</div>
                </section>

                <section>
                    <p className={'mb-2 font-medium flex items-center gap-2' + (!serverId ? ' opacity-60' : '')}>
                        Server
                        {!serverId && <Badge color={'warning'}>Inactive</Badge>}
                    </p>
                    <div className={!serverId ? 'opacity-60' : undefined}>{serverHotkeys.map(renderHotkey)}</div>
                </section>
            </div>

            <Dialog.Footer>
                <Button.Text onClick={() => setOpen(false)}>Close</Button.Text>
            </Dialog.Footer>
        </Dialog>
    );
};

export default HotkeyManager;
