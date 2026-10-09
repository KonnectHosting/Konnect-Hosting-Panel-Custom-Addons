import React, { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import loadDirectory, { FileObject } from '@/api/server/files/loadDirectory';
import Spinner from '@/components/elements/Spinner';
import { ChevronRightIcon } from '@heroicons/react/outline';
import { LuFileArchive, LuFileSymlink, LuFileText, LuFolder } from 'react-icons/lu';
import { usePermissions } from '@/plugins/usePermissions';
import FileDropdownMenu from './actions/FileDropdownMenu';
import { useTranslation } from 'react-i18next';

interface LoadFilesProps {
    onFileSelect?: (path: string, file: FileObject) => void;
    refreshKey?: number;
    expandedPaths: Set<string>;
    onToggleExpand: (path: string) => void;
    onRefresh?: () => void;
}

interface FileRowProps {
    file: FileObject;
    path: string;
    onFileSelect?: (path: string, file: FileObject) => void;
    refreshKey?: number;
    expandedPaths: Set<string>;
    onToggleExpand: (path: string) => void;
    onRefresh?: () => void;
}

const allowedImageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'];

function FileRow({ file, path, onFileSelect, refreshKey, expandedPaths, onToggleExpand, onRefresh }: FileRowProps) {
    const setDirectory = ServerContext.useStoreActions((actions) => actions.files.setDirectory);

    const [canRead] = usePermissions(['file.read']);
    const [canReadContents] = usePermissions(['file.read-content']);

    const fullPath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
    const isExpanded = expandedPaths.has(fullPath);

    const handleClick = () => {
        if (
            file.isFile &&
            (file.isEditable() || allowedImageExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))) &&
            canReadContents &&
            onFileSelect
        ) {
            onFileSelect(fullPath, file);
        } else if (!file.isFile && canRead) {
            onToggleExpand(fullPath);
            setDirectory(fullPath);
        }
    };

    const canShowFile = file.isFile
        ? (file.isEditable() || allowedImageExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))) &&
          canReadContents
        : canRead;

    if (!canShowFile) {
        return (
            <div
                onContextMenu={(e) => {
                    e.preventDefault();
                    window.dispatchEvent(
                        new CustomEvent(`pterodactyl:files:ctx:${file.key}`, {
                            detail: { clientX: e.clientX, clientY: e.clientY },
                        })
                    );
                }}
                className='flex items-center whitespace-nowrap gap-x-2 px-2 py-2 after:absolute after:opacity-0 after:duration-300 hover:after:opacity-100 after:-z-10 after:content-[""] after:h-10 after:bg-gray-600 after:w-full after:right-0 cursor-pointer'
            >
                {file.isFile ? (
                    <>
                        <div className='w-3 shrink-0' />
                        {file.isSymlink ? (
                            <LuFileSymlink className='shrink-0' />
                        ) : file.isArchiveType() ? (
                            <LuFileArchive className='shrink-0' />
                        ) : (
                            <LuFileText className='shrink-0' />
                        )}
                    </>
                ) : (
                    <>
                        <ChevronRightIcon className='w-3 text-gray-300 shrink-0' />
                        <LuFolder className='text-yellow-400 shrink-0' />
                    </>
                )}
                {file.name}

                <FileDropdownMenu file={file} path={path} onRefresh={onRefresh} />
            </div>
        );
    }

    return (
        <div>
            <div
                onContextMenu={(e) => {
                    e.preventDefault();
                    window.dispatchEvent(
                        new CustomEvent(`pterodactyl:files:ctx:${file.key}`, {
                            detail: { clientX: e.clientX, clientY: e.clientY },
                        })
                    );
                }}
                className='flex items-center whitespace-nowrap gap-x-2 px-2 py-2 after:absolute after:opacity-0 after:duration-300 hover:after:opacity-100 after:-z-10 after:content-[""] after:h-10 after:bg-gray-600 after:w-full after:right-0 cursor-pointer'
                onClick={handleClick}
            >
                {file.isFile ? (
                    <>
                        <div className='w-3 shrink-0' />
                        {file.isSymlink ? (
                            <LuFileSymlink className='shrink-0' />
                        ) : file.isArchiveType() ? (
                            <LuFileArchive className='shrink-0' />
                        ) : (
                            <LuFileText className='shrink-0' />
                        )}
                    </>
                ) : (
                    <>
                        <ChevronRightIcon
                            className={`w-3 text-gray-300 shrink-0 transition-transform duration-200 ${
                                isExpanded ? 'rotate-90' : ''
                            }`}
                        />
                        <LuFolder className='text-yellow-400 shrink-0' />
                    </>
                )}
                {file.name}

                <FileDropdownMenu file={file} path={path} onRefresh={onRefresh} />
            </div>
            <div className='pl-3'>
                {!file.isFile && isExpanded && (
                    <DirectoryContents
                        path={fullPath}
                        onFileSelect={onFileSelect}
                        refreshKey={refreshKey}
                        expandedPaths={expandedPaths}
                        onToggleExpand={onToggleExpand}
                        onRefresh={onRefresh}
                    />
                )}
            </div>
        </div>
    );
}

interface DirectoryContentsProps {
    path: string;
    onFileSelect?: (path: string, file: FileObject) => void;
    refreshKey?: number;
    expandedPaths: Set<string>;
    onToggleExpand: (path: string) => void;
    onRefresh?: () => void;
}

function DirectoryContents({
    path,
    onFileSelect,
    refreshKey,
    expandedPaths,
    onToggleExpand,
    onRefresh,
}: DirectoryContentsProps) {
    const { t } = useTranslation('arix/server/files');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const [files, setFiles] = useState<FileObject[]>([]);
    const [loading, setLoading] = useState(true);
    const [initialLoad, setInitialLoad] = useState(true);

    useEffect(() => {
        setLoading(true);
        loadDirectory(uuid, path)
            .then((data) => {
                const sorted = data.sort((a, b) => {
                    if (a.isFile === b.isFile) {
                        return a.name.localeCompare(b.name);
                    }
                    return a.isFile ? 1 : -1;
                });
                setFiles(sorted);
            })
            .catch((err) => {
                console.error('Failed to load directory:', err);
                setFiles([]);
            })
            .finally(() => {
                setLoading(false);
                setInitialLoad(false);
            });
    }, [uuid, path, refreshKey]);

    if (loading && initialLoad) {
        return (
            <div className='flex items-center px-2 py-2 gap-x-2'>
                <Spinner size={'small'} />
                <span className='text-sm text-gray-300'>{t('code-editor.loading')}</span>
            </div>
        );
    }

    return (
        <>
            {files.length > 0 ? (
                files.map((file) => (
                    <FileRow
                        key={file.key}
                        file={file}
                        path={path}
                        onFileSelect={onFileSelect}
                        refreshKey={refreshKey}
                        expandedPaths={expandedPaths}
                        onToggleExpand={onToggleExpand}
                        onRefresh={onRefresh}
                    />
                ))
            ) : (
                <div className='text-sm text-gray-300 px-2 pb-2'>{t('code-editor.no-files-found')}</div>
            )}
        </>
    );
}

export default function LoadFiles({
    onFileSelect,
    refreshKey,
    expandedPaths,
    onToggleExpand,
    onRefresh,
}: LoadFilesProps) {
    const { t } = useTranslation('arix/server/files');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const [files, setFiles] = useState<FileObject[]>([]);
    const [loading, setLoading] = useState(true);
    const [initialLoad, setInitialLoad] = useState(true);

    useEffect(() => {
        setLoading(true);
        loadDirectory(uuid, '/')
            .then((data) => {
                const sorted = data.sort((a, b) => {
                    if (a.isFile === b.isFile) {
                        return a.name.localeCompare(b.name);
                    }
                    return a.isFile ? 1 : -1;
                });
                setFiles(sorted);
            })
            .catch((err) => {
                console.error('Failed to load root directory:', err);
                setFiles([]);
            })
            .finally(() => {
                setLoading(false);
                setInitialLoad(false);
            });
    }, [uuid, refreshKey]);

    return (
        <div className='relative h-full overflow-y-auto z-10'>
            {loading && initialLoad ? (
                <Spinner size={'large'} centered />
            ) : (
                <>
                    {files.length > 0 ? (
                        files.map((file) => (
                            <FileRow
                                key={file.key}
                                file={file}
                                path='/'
                                onFileSelect={onFileSelect}
                                refreshKey={refreshKey}
                                expandedPaths={expandedPaths}
                                onToggleExpand={onToggleExpand}
                                onRefresh={onRefresh}
                            />
                        ))
                    ) : (
                        <div className='text-sm text-gray-300 px-2 pb-2'>{t('code-editor.no-files-found')}</div>
                    )}
                </>
            )}
        </div>
    );
}
