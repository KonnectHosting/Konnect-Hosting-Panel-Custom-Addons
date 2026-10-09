import React, { useState, useEffect } from 'react';
import { Button } from '@/components/elements/button/index';
import Select from '@/components/elements/Select';
import modes from '@/modes';
import CodemirrorEditor from '@/components/server/files/codeEditor/CodemirrorEditor';
import saveFileContents from '@/api/server/files/saveFileContents';
import { ServerContext } from '@/state/server';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import { LuFolderOpen } from 'react-icons/lu';
import getFileDownloadUrl from '@/api/server/files/getFileDownloadUrl';
import { useTranslation } from 'react-i18next';

interface OpenFile {
    path: string;
    name: string;
    originalContent: string;
    currentContent: string;
    isDirty: boolean;
    mode: string;
}

interface FileEditProps {
    openFiles: OpenFile[];
    activeFileIndex: number;
    onContentChange: (index: number, content: string) => void;
    onSave: (index: number) => void;
    onModeChange: (index: number, mode: string) => void;
}

const allowedImageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'];

export default function FileEdit({ openFiles, activeFileIndex, onContentChange, onSave, onModeChange }: FileEditProps) {
    const { t } = useTranslation('arix/server/files');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { addError } = useFlash();
    const [loading, setLoading] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

    let fetchFileContent: null | (() => Promise<string>) = null;

    const activeFile = openFiles[activeFileIndex];

    useEffect(() => {
        if (!activeFile || !allowedImageExtensions.some((ext) => activeFile.name.toLowerCase().endsWith(ext))) {
            setDownloadUrl(null);
            return;
        }

        let isMounted = true;

        const loadImageUrl = async () => {
            try {
                const url = await getFileDownloadUrl(uuid, activeFile.path);
                if (isMounted) {
                    setDownloadUrl(url);
                }
            } catch (error) {
                console.error('Failed to get image download URL:', error);
                if (isMounted) {
                    addError({ message: httpErrorToHuman(error), key: 'file-editor-image' });
                }
            }
        };

        loadImageUrl();

        return () => {
            isMounted = false;
        };
    }, [uuid, activeFile?.path, activeFile?.name, addError]);

    if (!activeFile) {
        return (
            <div className='flex flex-col gap-2 items-center justify-center h-full text-gray-300'>
                <LuFolderOpen className='w-16 h-16' />
                <span>{t('code-editor.no-file-selected')}</span>
            </div>
        );
    }

    const handleSave = async () => {
        if (!fetchFileContent) return;

        setLoading(true);
        try {
            const content = await fetchFileContent();
            await saveFileContents(uuid, activeFile.path, content);
            onSave(activeFileIndex);
        } catch (error) {
            console.error('Failed to save file:', error);
            addError({ message: httpErrorToHuman(error), key: 'file-editor' });
        } finally {
            setLoading(false);
        }
    };

    if (allowedImageExtensions.some((ext) => activeFile.name.toLowerCase().endsWith(ext))) {
        return (
            <div className='flex flex-col gap-2 items-center justify-center h-full text-gray-300'>
                {downloadUrl ? (
                    <img src={downloadUrl} alt={activeFile.name} className='max-h-full max-w-full object-contain' />
                ) : (
                    <span>Loading image...</span>
                )}
            </div>
        );
    }

    return (
        <>
            <CodemirrorEditor
                mode={activeFile.mode}
                filename={activeFile.path}
                initialContent={activeFile.currentContent}
                onModeChanged={(mode) => onModeChange(activeFileIndex, mode)}
                fetchContent={(callback) => {
                    fetchFileContent = callback;
                }}
                onContentSaved={handleSave}
                onContentChange={(content) => onContentChange(activeFileIndex, content)}
            />
            <div className='border-t border-gray-500 px-3 py-3 flex justify-between'>
                <Select
                    className='!w-auto !py-2'
                    value={activeFile.mode}
                    onChange={(e) => onModeChange(activeFileIndex, e.currentTarget.value)}
                >
                    {modes.map((mode) => (
                        <option key={`${mode.name}_${mode.mime}`} value={mode.mime}>
                            {mode.name}
                        </option>
                    ))}
                </Select>
                <Button onClick={handleSave} disabled={loading}>
                    {loading
                        ? t('code-editor.saving')
                        : activeFile.isDirty
                        ? t('code-editor.save-dirty')
                        : t('code-editor.save')}
                </Button>
            </div>
        </>
    );
}

export type { OpenFile };
