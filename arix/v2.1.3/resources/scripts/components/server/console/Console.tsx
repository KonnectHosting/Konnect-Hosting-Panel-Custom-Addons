import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ITerminalOptions, Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import { SearchBarAddon } from 'xterm-addon-search-bar';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { Unicode11Addon } from 'xterm-addon-unicode11';
import { ScrollDownHelperAddon } from '@/plugins/XtermScrollDownHelperAddon';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import { ServerContext } from '@/state/server';
import { usePermissions } from '@/plugins/usePermissions';
import { theme as th } from 'twin.macro';
import useEventListener from '@/plugins/useEventListener';
import { debounce } from 'debounce';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import PowerButtons from '@/components/server/console/PowerButtons';
import classNames from 'classnames';
import copy from 'copy-to-clipboard';
import {
    ArrowsExpandIcon,
    ClipboardIcon,
    ClipboardCheckIcon,
    TrashIcon,
    ClockIcon,
    XIcon,
} from '@heroicons/react/outline';
import { ChevronDoubleRightIcon } from '@heroicons/react/solid';
import { useTranslation } from 'react-i18next';

import 'xterm/css/xterm.css';
import styles from './style.module.css';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import getCommandHistory, {
    addCommandToHistory,
    clearCommandHistory,
    CommandHistory,
} from '@/api/server/commandHistory';
import * as locales from 'date-fns/locale';
import { differenceInHours, formatDistanceToNow, format } from 'date-fns';

type LogLevel = 'info' | 'warning' | 'error';

const getLocale = (localeKey: keyof typeof locales) => {
    if (locales[localeKey]) {
        return locales[localeKey];
    } else {
        const keyString = String(localeKey);
        console.warn(`Locale '${keyString}' not found. Falling back to '${locales.enUS}'`);
        return locales.enUS;
    }
};

interface LogEntry {
    level?: LogLevel;
    content: string;
}

const theme = {
    background: 'transparent',
    cursor: 'transparent',
    black: th`colors.black`.toString(),
    red: '#E54B4B',
    green: '#9ECE58',
    yellow: '#FAED70',
    blue: '#396FE2',
    magenta: '#BB80B3',
    cyan: '#2DDAFD',
    white: '#d0d0d0',
    brightBlack: 'rgba(255, 255, 255, 0.2)',
    brightRed: '#FF5370',
    brightGreen: '#C3E88D',
    brightYellow: '#FFCB6B',
    brightBlue: '#82AAFF',
    brightMagenta: '#C792EA',
    brightCyan: '#89DDFF',
    brightWhite: '#ffffff',
    selection: '#FAF089',
};

const terminalProps: ITerminalOptions = {
    disableStdin: true,
    cursorStyle: 'underline',
    allowTransparency: true,
    fontSize: 12,
    fontFamily: th('fontFamily.mono'),
    rows: 30,
    theme: theme,
};

interface Props {
    fullConsole?: boolean;
    onClose?: () => void;
}

export default ({ fullConsole, onClose }: Props) => {
    const { t, i18n } = useTranslation('arix/server/console');
    const [consoleLog, setConsoleLog] = useState<LogEntry[]>([]);
    const logBufferRef = useRef<LogEntry[]>([]);
    const [logFilter, setLogFilter] = useState<LogLevel | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [commandHistory, setCommandHistory] = useState<CommandHistory[]>([]);
    const historyPopupRef = useRef<HTMLDivElement>(null);
    const logFilterRef = useRef<LogLevel | null>(null);
    const [isCopied, setCopied] = useState<Boolean>(false);
    const daemonText = ServerContext.useStoreState((state) => state.server.data?.daemonText);
    const containerText = ServerContext.useStoreState((state) => state.server.data?.containerText);
    const uuid = ServerContext.useStoreState((state) => state.server.data?.uuid);
    const currentLang = i18n.language;
    const localeKey = currentLang as keyof typeof locales;

    const TERMINAL_PRELUDE = `\u001b[1m\u001b[33m${containerText} \u001b[0m`;
    const TERMINAL_DAEMON = `\u001b[1m\u001b[33m${daemonText}\u001b[0m`;
    const ref = useRef<HTMLDivElement>(null);
    const terminal = useMemo(() => new Terminal({ ...terminalProps }), []);
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const searchBar = new SearchBarAddon({ searchAddon });
    const webLinksAddon = new WebLinksAddon();
    const unicode11Addon = new Unicode11Addon();
    const scrollDownHelperAddon = new ScrollDownHelperAddon();
    const { connected, instance } = ServerContext.useStoreState((state) => state.socket);
    const [canSendCommands] = usePermissions(['control.console']);
    const serverId = ServerContext.useStoreState((state) => state.server.data!.id);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const commandInputRef = useRef<HTMLInputElement>(null);

    const zIndex = `
    .xterm-search-bar__addon {
        z-index: 10;
    }`;

    const detectLogLevel = (line: string): LogLevel | undefined => {
        const lower = line.toLowerCase();
        if (lower.includes('error')) return 'error';
        if (lower.includes('warn')) return 'warning';
        if (lower.includes('info')) return 'info';
        return undefined;
    };

    const addLog = (data: string) => {
        const cleanData = data.startsWith('>') ? data.substring(1) : data;
        const level = detectLogLevel(cleanData);
        const logLine: LogEntry = { level, content: cleanData };

        logBufferRef.current.push(logLine);

        if (!logFilterRef.current || logFilterRef.current === level) {
            terminal.writeln(cleanData);
        }
    };

    useEffect(() => {
        const interval = setInterval(() => {
            if (logBufferRef.current.length > 0) {
                setConsoleLog((prev) => {
                    const newLogs = [...prev, ...logBufferRef.current];
                    logBufferRef.current = [];
                    return newLogs.slice(-2000); // Optional: keep max 2000 logs
                });
            }
        }, 250);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        logFilterRef.current = logFilter;
    }, [logFilter]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (historyPopupRef.current && !historyPopupRef.current.contains(event.target as Node)) {
                setShowHistory(false);
            }
        };

        if (showHistory) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showHistory]);

    const handleConsoleOutput = (line: string, prelude = false) => {
        addLog(
            (prelude ? TERMINAL_PRELUDE : '') +
                line
                    .replace('container@pterodactyl~ ', TERMINAL_PRELUDE)
                    .replace('[Pterodactyl Daemon]:', TERMINAL_DAEMON)
                    .replace(/(?:\r\n|\r|\n)$/im, '') +
                '\u001b[0m'
        );
    };

    const handleTransferStatus = (status: string) => {
        switch (status) {
            // Sent by either the source or target node if a failure occurs.
            case 'failure':
                addLog(TERMINAL_PRELUDE + 'Transfer has failed.\u001b[0m');
                return;
        }
    };

    const handleDaemonErrorOutput = (line: string) =>
        addLog(TERMINAL_PRELUDE + '\u001b[1m\u001b[41m' + line.replace(/(?:\r\n|\r|\n)$/im, '') + '\u001b[0m');

    const handlePowerChangeEvent = (state: string) =>
        addLog(TERMINAL_PRELUDE + 'Server marked as ' + state + '...\u001b[0m');

    const handleCommandKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const commandList = commandHistory.map((e) => e.command);

        if (e.key === 'ArrowUp') {
            const newIndex = Math.min(historyIndex + 1, commandList.length - 1);

            setHistoryIndex(newIndex);
            e.currentTarget.value = commandList[newIndex] || '';

            e.preventDefault();
        }

        if (e.key === 'ArrowDown') {
            const newIndex = Math.max(historyIndex - 1, -1);

            setHistoryIndex(newIndex);
            e.currentTarget.value = commandList[newIndex] || '';
        }

        const command = e.currentTarget.value;
        if (e.key === 'Enter' && command.length > 0) {
            instance && instance.send('send command', command);

            addCommandToHistory(uuid!, command)
                .then(() => getCommandHistory(uuid!).then(setCommandHistory))
                .catch(console.error);

            setHistoryIndex(-1);
            e.currentTarget.value = '';
        }
    };

    useEffect(() => {
        if (connected && ref.current && !terminal.element) {
            terminal.loadAddon(fitAddon);
            terminal.loadAddon(searchAddon);
            terminal.loadAddon(searchBar);
            terminal.loadAddon(webLinksAddon);
            terminal.loadAddon(unicode11Addon);
            terminal.loadAddon(scrollDownHelperAddon);

            terminal.open(ref.current);

            // Activate Unicode 11 for proper emoji and special character width handling
            terminal.unicode.activeVersion = '11';

            fitAddon.fit();
            searchBar.addNewStyle(zIndex);

            terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                    document.execCommand('copy');
                    return false;
                } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                    e.preventDefault();
                    searchBar.show();
                    return false;
                } else if (e.key === 'Escape') {
                    searchBar.hidden();
                }
                return true;
            });

            getCommandHistory(uuid!)
                .then((history) => setCommandHistory(history))
                .catch((error) => {
                    console.error('Failed to fetch command history:', error);
                    setCommandHistory([]);
                });
        }
    }, [terminal, connected]);

    useEventListener(
        'resize',
        debounce(() => {
            if (terminal.element) {
                fitAddon.fit();
            }
        }, 100)
    );

    useEffect(() => {
        const listeners: Record<string, (s: string) => void> = {
            [SocketEvent.STATUS]: handlePowerChangeEvent,
            [SocketEvent.CONSOLE_OUTPUT]: handleConsoleOutput,
            [SocketEvent.INSTALL_OUTPUT]: handleConsoleOutput,
            [SocketEvent.TRANSFER_LOGS]: handleConsoleOutput,
            [SocketEvent.TRANSFER_STATUS]: handleTransferStatus,
            [SocketEvent.DAEMON_MESSAGE]: (line) => handleConsoleOutput(line, true),
            [SocketEvent.DAEMON_ERROR]: handleDaemonErrorOutput,
        };

        if (connected && instance) {
            if (!isTransferring) {
                terminal.clear();
            }

            Object.keys(listeners).forEach((key: string) => {
                instance.addListener(key, listeners[key]);
            });
            instance.send(SocketRequest.SEND_LOGS);
        }

        return () => {
            if (instance) {
                Object.keys(listeners).forEach((key: string) => {
                    instance.removeListener(key, listeners[key]);
                });
            }
        };
    }, [connected, instance]);

    const openWindow = () => {
        window.open(
            `/server/${serverId}/console/popup?floating=true`,
            'popUpWindow',
            'height=500,width=800,left=100,top=100'
        );
    };

    const logData = async () => {
        setCopied(false);

        try {
            const data =
                consoleLog
                    .slice(-500)
                    .map((it) => it.content.replace('\r', ''))
                    .join('\n')
                    .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '') || '';

            const response = await fetch('https://api.mclo.gs/1/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `content=${data}`,
            });

            const responseData = await response.json();
            await copy(responseData['url']);
            if (localStorage.getItem('panelSounds') === 'true') {
                const copySound = new Audio('/arix/copy.mp3');
                copySound.volume = 0.2;
                copySound.play();
            }
            setCopied(true);
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const ClearTerminal = () => {
        terminal.clear();
        setConsoleLog([]);
    };

    const toggleHistory = () => {
        setShowHistory(!showHistory);

        getCommandHistory(uuid!)
            .then((history) => setCommandHistory(history))
            .catch((error) => {
                console.error('Failed to fetch command history:', error);
                setCommandHistory([]);
            });
    };

    return (
        <div
            className={classNames(
                styles.terminal,
                fullConsole ? 'fixed top-0 left-0 h-full w-full z-[90]' : 'relative rounded-box',
                'backdrop boxBorder'
            )}
        >
            <SpinnerOverlay visible={!connected} size={'large'} />
            <div className='flex justify-between items-center'>
                <div className='flex gap-x-2 pb-2'>
                    <button
                        onClick={() => {
                            const newFilter = null;
                            setLogFilter(newFilter);
                            terminal.clear();
                            consoleLog
                                .filter((log) => !newFilter || log.level === newFilter)
                                .forEach((log) => terminal.writeln(log.content));
                        }}
                        className={classNames(
                            'px-2 py-2 rounded text-xs font-medium',
                            logFilter === null ? 'bg-gray-500 text-gray-50' : 'text-gray-400'
                        )}
                    >
                        {t('view-all')} ({consoleLog.length > 99 ? '99+' : consoleLog.length})
                    </button>

                    {(['info', 'warning', 'error'] as LogLevel[]).map(
                        (lvl) =>
                            consoleLog.filter((log) => log.level === lvl).length > 0 && (
                                <button
                                    key={lvl}
                                    onClick={() => {
                                        const newFilter = logFilter === lvl ? null : lvl;
                                        setLogFilter(newFilter);
                                        terminal.clear();
                                        consoleLog
                                            .filter((log) => !newFilter || log.level === newFilter)
                                            .forEach((log) => terminal.writeln(log.content));
                                    }}
                                    className={classNames(
                                        'px-2 py-2 rounded text-xs font-medium capitalize',
                                        logFilter === lvl ? 'bg-gray-400 text-gray-50' : 'text-gray-300'
                                    )}
                                >
                                    {lvl} (
                                    {consoleLog.filter((log) => log.level === lvl).length > 99
                                        ? '99+'
                                        : consoleLog.filter((log) => log.level === lvl).length}
                                    )
                                </button>
                            )
                    )}
                </div>
                <div className={'flex items-center gap-x-2'}>
                    <Tooltip content={`${t('clear-console')}`} placement='bottom'>
                        <button
                            onClick={ClearTerminal}
                            className={'block text-gray-200 hover:text-gray-100 duration-300'}
                        >
                            <TrashIcon className={'w-5'} />
                        </button>
                    </Tooltip>
                    <Tooltip content={`${t('share-logs')}`} placement='bottom'>
                        <button onClick={logData} className={'block text-gray-200 hover:text-gray-100 duration-300'}>
                            {isCopied ? (
                                <ClipboardCheckIcon className={'w-5 text-success-100'} />
                            ) : (
                                <ClipboardIcon className={'w-5'} />
                            )}
                        </button>
                    </Tooltip>
                    <Tooltip content={`${t('floating-console')}`} placement='bottom'>
                        <button onClick={openWindow} className={'block text-gray-200 hover:text-gray-100 duration-300'}>
                            <ArrowsExpandIcon className={'w-5'} />
                        </button>
                    </Tooltip>
                    {onClose && (
                        <Tooltip content={`${t('close-console')}`} placement='bottom'>
                            <button
                                onClick={onClose}
                                className={'block text-gray-200 hover:text-gray-100 duration-300'}
                            >
                                <XIcon className={'w-5'} />
                            </button>
                        </Tooltip>
                    )}
                </div>
            </div>
            <div
                className={classNames(styles.container, styles.overflows_container, { 'rounded-b': !canSendCommands })}
            >
                <div className={'h-full'}>
                    <div id={styles.terminal} ref={ref} />
                </div>
            </div>
            <div className={classNames('relative min-h-8', styles.overflows_container)}>
                {canSendCommands && (
                    <>
                        <input
                            ref={commandInputRef}
                            className={classNames('peer', styles.command_input)}
                            type={'text'}
                            placeholder={t('type-a-command')}
                            aria-label={'Console command input.'}
                            disabled={!instance || !connected}
                            onKeyDown={handleCommandKeyDown}
                            autoCorrect={'off'}
                            autoCapitalize={'none'}
                        />
                        <div
                            className={classNames(
                                'text-gray-100 peer-focus:text-gray-50 peer-focus:animate-pulse',
                                styles.command_icon
                            )}
                        >
                            <ChevronDoubleRightIcon className={'w-4 h-4'} />
                        </div>
                        <div className='absolute right-4 top-3'>
                            <button
                                onClick={toggleHistory}
                                className={'text-gray-200 hover:text-gray-100 duration-300'}
                            >
                                <ClockIcon className={'w-5'} />
                            </button>
                            {showHistory && (
                                <div
                                    ref={historyPopupRef}
                                    className={`absolute w-80 bottom-full right-0 max-h-96 overflow-y-auto flex 
                                    flex-col-reverse z-40 bg-neutral-600 p-2 rounded-lg border border-neutral-500 
                                    shadow-lg text-neutral-200`}
                                >
                                    {!commandHistory || commandHistory.length === 0 ? (
                                        <p className={'text-gray-400 text-sm'}>No command history</p>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => {
                                                    clearCommandHistory(uuid!);
                                                    setShowHistory(false);
                                                    setCommandHistory([]);
                                                }}
                                                className={
                                                    'text-xs flex items-center justify-center gap-x-1 underline hover:text-danger-50 mt-1 duration-300'
                                                }
                                            >
                                                <TrashIcon className={'w-3'} />
                                                Clear History
                                            </button>
                                            {commandHistory.map((entry, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => {
                                                        if (commandInputRef.current) {
                                                            commandInputRef.current.value = entry.command;
                                                            commandInputRef.current.focus();
                                                        }
                                                        setShowHistory(false);
                                                    }}
                                                    className={
                                                        'text-sm px-3 py-2 flex items-center justify-between rounded-component hover:bg-gray-500 cursor-pointer duration-300'
                                                    }
                                                >
                                                    <div className='flex justify-between w-full gap-x-2'>
                                                        <span className='truncate whitespace-nowrap'>
                                                            {entry.command}
                                                        </span>
                                                        <span className='text-xs text-gray-300 whitespace-nowrap font-medium'>
                                                            {Math.abs(
                                                                differenceInHours(
                                                                    new Date(entry.executed_at),
                                                                    new Date()
                                                                )
                                                            ) > 48
                                                                ? format(
                                                                      new Date(entry.executed_at),
                                                                      'MMM do, yyyy h:mma',
                                                                      { locale: getLocale(localeKey) }
                                                                  )
                                                                : formatDistanceToNow(new Date(entry.executed_at), {
                                                                      addSuffix: true,
                                                                      locale: getLocale(localeKey),
                                                                  })}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
                {fullConsole && (
                    <PowerButtons
                        icons
                        className={'absolute flex items-center gap-x-2 right-0 top-0 py-[4px] px-[5px]'}
                    />
                )}
            </div>
        </div>
    );
};
