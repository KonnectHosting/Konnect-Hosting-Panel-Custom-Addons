import React, { useEffect, useRef, useState } from 'react';
import UploadButton from './UploadButton';
import UploadFolderButton from './UploadFolderButton';
import UploadFromUrl from './UploadFromUrl';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import { LuUpload } from 'react-icons/lu';
import { useTranslation } from 'react-i18next';

export default function UploadDropdown({ onRefresh }: { onRefresh?: () => void }) {
    const { t } = useTranslation('arix/server/files');
    const uploadRef = useRef<HTMLDivElement | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (uploadRef.current && !uploadRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mouseup', handleClickOutside);
        return () => document.removeEventListener('mouseup', handleClickOutside);
    }, []);

    return (
        <div className='relative'>
            <div ref={uploadRef}>
                <Tooltip content={`${t('upload')}`}>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className='p-2 rounded hover:bg-gray-500 cursor-pointer duration-300'
                    >
                        <LuUpload size={20} />
                    </button>
                </Tooltip>
            </div>
            <div
                className={`absolute left-1/2 -translate-x-1/2 mt-2 w-48 bg-neutral-600 rounded-lg border-neutral-500 shadow-lg text-neutral-200 z-50 overflow-hidden transition-opacity ${
                    isOpen ? 'opacity-100 border p-2 max-h-64' : 'opacity-0 max-h-0'
                } duration-300`}
            >
                <UploadButton onRefresh={onRefresh} className={'flex items-center gap-2'} />
                <UploadFolderButton onRefresh={onRefresh} className={'flex items-center gap-2'} />
                <UploadFromUrl onRefresh={onRefresh} className={'flex items-center gap-2'} />
            </div>
        </div>
    );
}
