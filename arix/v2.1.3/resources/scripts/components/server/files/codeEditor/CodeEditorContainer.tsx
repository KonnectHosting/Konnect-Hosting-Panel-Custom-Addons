import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import { ServerContext } from '@/state/server';
import { ChevronRightIcon, FolderOpenIcon } from '@heroicons/react/outline';
import React, { useState, useCallback } from 'react';
import { LuFile, LuFolderSearch, LuPlus, LuRefreshCcw, LuUpload, LuX } from 'react-icons/lu';
import { NavLink } from 'react-router-dom';
import LoadFiles from './LoadFiles';
import FileEdit, { OpenFile } from './FileEdit';
import { FileObject } from '@/api/server/files/loadDirectory';
import getFileContents from '@/api/server/files/getFileContents';
import modes from '@/modes';
import Spinner from '@/components/elements/Spinner';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import UploadDropdown from './actions/UploadDropdown';
import CreateDropdown from './actions/CreateDropdown';
import { useTranslation } from 'react-i18next';

export interface EditorObject {
    key: string;
    name: string;
    mode: string;
    modeBits: string;
    size: number;
    isFile: boolean;
    isSymlink: boolean;
    mimetype: string;
    createdAt: Date;
    modifiedAt: Date;
    isArchiveType: () => boolean;
    isEditable: () => boolean;

    subfiles?: EditorObject[];
}

const findModeByFilename = (filename: string) => {
    for (let i = 0; i < modes.length; i++) {
        const info = modes[i];
        if (info.file && info.file.test(filename)) {
            return info.mime;
        }
    }
    const dot = filename.lastIndexOf('.');
    const ext = dot > -1 && filename.substring(dot + 1, filename.length);
    if (ext) {
        for (let i = 0; i < modes.length; i++) {
            const info = modes[i];
            if (info.ext) {
                for (let j = 0; j < info.ext.length; j++) {
                    if (info.ext[j] === ext) {
                        return info.mime;
                    }
                }
            }
        }
    }
    return 'text/plain';
};

export default function CodeEditorContainer() {
    const { t } = useTranslation('arix/server/files');
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { addError } = useFlash();

    const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
    const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
    const [loadingFiles, setLoadingFiles] = useState<Set<string>>(new Set());
    const [refreshKey, setRefreshKey] = useState(0);
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

    const refreshFiles = useCallback(() => setRefreshKey((k) => k + 1), []);

    const toggleExpand = useCallback((path: string) => {
        setExpandedPaths((prev) => {
            const next = new Set(prev);
            next.has(path) ? next.delete(path) : next.add(path);
            return next;
        });
    }, []);

    const handleFileSelect = useCallback(
        async (path: string, file: FileObject) => {
            const existingIndex = openFiles.findIndex((f) => f.path === path);
            if (existingIndex !== -1) {
                setActiveFileIndex(existingIndex);
                return;
            }

            setLoadingFiles((prev) => new Set([...prev, path]));
            try {
                const content = await getFileContents(uuid, path);
                const mode = findModeByFilename(file.name);

                const newFile: OpenFile = {
                    path,
                    name: file.name,
                    originalContent: content,
                    currentContent: content,
                    isDirty: false,
                    mode,
                };

                setOpenFiles((prev) => [...prev, newFile]);
                setActiveFileIndex(openFiles.length);
            } catch (error) {
                console.error('Failed to load file:', error);
                addError({ message: httpErrorToHuman(error), key: 'file-editor' });
            } finally {
                setLoadingFiles((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(path);
                    return newSet;
                });
            }
        },
        [openFiles, uuid, addError]
    );

    const handleCloseFile = useCallback(
        (index: number) => {
            setOpenFiles((prev) => prev.filter((_, i) => i !== index));
            if (activeFileIndex >= index && activeFileIndex > 0) {
                setActiveFileIndex(activeFileIndex - 1);
            } else if (openFiles.length === 1) {
                setActiveFileIndex(0);
            }
        },
        [activeFileIndex, openFiles.length]
    );

    const handleContentChange = useCallback((index: number, content: string) => {
        setOpenFiles((prev) =>
            prev.map((file, i) =>
                i === index ? { ...file, currentContent: content, isDirty: content !== file.originalContent } : file
            )
        );
    }, []);

    const handleSave = useCallback((index: number) => {
        setOpenFiles((prev) =>
            prev.map((file, i) =>
                i === index ? { ...file, originalContent: file.currentContent, isDirty: false } : file
            )
        );
    }, []);

    const handleModeChange = useCallback((index: number, mode: string) => {
        setOpenFiles((prev) => prev.map((file, i) => (i === index ? { ...file, mode } : file)));
    }, []);

    const renderBreadcrumbs = () => {
        if (!openFiles[activeFileIndex]) return null;

        const parts = openFiles[activeFileIndex].path.split('/').filter(Boolean);
        return (
            <div className='flex gap-x-1 items-center px-3 py-2 text-sm text-gray-300'>
                <span>home</span>
                <ChevronRightIcon className='w-3' />
                <span>container</span>
                {parts.map((part, index) => (
                    <React.Fragment key={index}>
                        <ChevronRightIcon className='w-3' />
                        <span className={index === parts.length - 1 ? 'text-gray-100' : ''}>{part}</span>
                    </React.Fragment>
                ))}
            </div>
        );
    };

    return (
        <ServerContentBlock title={'Code Editor'} showFlashKey={'files'} icon={FolderOpenIcon}>
            <div className='flex gap-x-2 items-stretch h-[90vh]'>
                <div className='flex flex-col h-full shrink-0 max-w-72 w-full backdrop boxBorder bg-gray-700 py-2 rounded-box'>
                    <div className='flex items-center justify-between border-b border-gray-500 pl-4 pr-2 pb-2'>
                        <span>{t('code-editor.explorer')}</span>
                        <div className='flex items-center gap-x-1'>
                            <Tooltip content={`${t('code-editor.reload')}`}>
                                <button
                                    onClick={refreshFiles}
                                    className='p-2 rounded hover:bg-gray-500 cursor-pointer duration-300'
                                >
                                    <LuRefreshCcw size={20} />
                                </button>
                            </Tooltip>
                            <UploadDropdown onRefresh={refreshFiles} />
                            <CreateDropdown onRefresh={refreshFiles} />
                            <Tooltip content={`${t('code-editor.browse-files')}`}>
                                <NavLink
                                    to={`/server/${id}/files`}
                                    className='p-2 rounded hover:bg-gray-500 cursor-pointer duration-300'
                                >
                                    <LuFolderSearch size={20} />
                                </NavLink>
                            </Tooltip>
                        </div>
                    </div>
                    <div className='relative h-full overflow-y-auto overflow-x-hidden z-10'>
                        <LoadFiles
                            onFileSelect={handleFileSelect}
                            refreshKey={refreshKey}
                            expandedPaths={expandedPaths}
                            onToggleExpand={toggleExpand}
                            onRefresh={refreshFiles}
                        />
                    </div>
                </div>
                <div className='bg-gray-700 backdrop boxBorder rounded-box flex flex-col w-full min-h-0 overflow-hidden'>
                    {openFiles.length > 0 && (
                        <div className='overflow-x-auto w-full shrink-0 bg-gray-600'>
                            <div className='flex w-full text-sm'>
                                {openFiles.map((file, index) => {
                                    const isActive = index === activeFileIndex;
                                    const isLoading = loadingFiles.has(file.path);

                                    return (
                                        <div
                                            key={file.path}
                                            className={`flex items-center gap-x-1 px-5 py-4 border-r border-gray-500 cursor-pointer ${
                                                isActive ? 'bg-gray-700 !text-gray-50' : 'border-b hover:bg-gray-650'
                                            }`}
                                            onClick={() => setActiveFileIndex(index)}
                                        >
                                            {isLoading ? (
                                                <Spinner size={'small'} />
                                            ) : (
                                                <LuFile size={16} className='cursor-pointer' />
                                            )}
                                            <span className='max-w-28 overflow-hidden text-ellipsis whitespace-nowrap'>
                                                {file.name}
                                            </span>
                                            {file.isDirty && <span className='text-amber-500'>●</span>}
                                            <LuX
                                                size={16}
                                                className='text-gray-300 ml-1 cursor-pointer hover:text-gray-100'
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCloseFile(index);
                                                }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {renderBreadcrumbs()}
                    <FileEdit
                        openFiles={openFiles}
                        activeFileIndex={activeFileIndex}
                        onContentChange={handleContentChange}
                        onSave={handleSave}
                        onModeChange={handleModeChange}
                    />
                </div>
            </div>
        </ServerContentBlock>
    );
}
