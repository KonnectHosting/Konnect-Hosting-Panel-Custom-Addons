import { ChevronDownIcon } from '@heroicons/react/outline';
import React, { useState } from 'react';

interface BorderedBoxProps {
    title: string;
    description?: string;
    children: React.ReactNode;
}

export default ({ title, description, children }: BorderedBoxProps) => {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className='border-b border-gray-500'>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className='flex items-start justify-between px-6 pb-4 cursor-pointer'
            >
                <div>
                    <p className='font-medium text-gray-100'>{title}</p>
                    {description && <p className='text-sm text-gray-300'>{description}</p>}
                </div>
                <ChevronDownIcon className={`my-1 w-4 ${isOpen ? 'rotate-180' : ''} duration-300`} />
            </div>
            <div className={`overflow-hidden duration-300 ${isOpen ? 'max-h-[200vh]' : 'max-h-0'}`}>
                <div className='space-y-6 px-6 pb-5'>{children}</div>
            </div>
        </div>
    );
};
