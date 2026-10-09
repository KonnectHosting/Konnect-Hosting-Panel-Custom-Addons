import React, { useEffect, useRef, useState } from 'react';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import { LuPlus } from 'react-icons/lu';
import NewDirectoryButton from './NewDirectoryButton';
import CreateFile from './CreateFile';
import { useTranslation } from 'react-i18next';

export default function CreateDropdown({ onRefresh }: { onRefresh?: () => void }) {
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
                <Tooltip content={`${t('code-editor.new')}`}>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className='p-2 rounded hover:bg-gray-500 cursor-pointer duration-300'
                    >
                        <LuPlus size={20} />
                    </button>
                </Tooltip>
            </div>
            <div
                className={`absolute right-0 mt-2 w-48 bg-neutral-600 rounded-lg border-neutral-500 shadow-lg text-neutral-200 z-50 overflow-hidden transition-opacity ${
                    isOpen ? 'opacity-100 border p-2 max-h-64' : 'opacity-0 max-h-0'
                } duration-300`}
            >
                <NewDirectoryButton onRefresh={onRefresh} />
                <CreateFile onRefresh={onRefresh} />
            </div>
        </div>
    );
}
