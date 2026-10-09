import { TerminalIcon } from '@heroicons/react/outline';
import React, { useState } from 'react';
import Console from './console/Console';

export default () => {
    const [open, setOpen] = useState(false);

    return (
        <div
            className={`fixed top-1/2 duration-300 pointer-events-none ${
                open ? 'right-0 lg:pr-4' : 'lg:-right-[28rem] -right-[100vw]'
            } transform -translate-y-1/2 z-50 flex h-screen lg:py-4 gap-2`}
        >
            <div
                className='my-auto bg-gray-600 pointer-events-auto px-3 h-20 cursor-pointer rounded-component flex items-center justify-center'
                onClick={() => setOpen(!open)}
            >
                <TerminalIcon className='h-5 w-5' />
            </div>
            <div className='lg:w-[28rem] max-w-[100vw] bg-gray-700 h-full pointer-events-auto'>
                <Console onClose={() => setOpen(false)} />
            </div>
        </div>
    );
};
