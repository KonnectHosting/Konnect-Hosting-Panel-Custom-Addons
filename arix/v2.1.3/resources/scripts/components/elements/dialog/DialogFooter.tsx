import React, { useContext } from 'react';
import { DialogContext } from './';
import { useDeepCompareEffect } from '@/plugins/useDeepCompareEffect';

export default ({ children }: { children: React.ReactNode }) => {
    const { setFooter } = useContext(DialogContext);

    useDeepCompareEffect(() => {
        setFooter(
            <div
                className={
                    'px-6 py-3 compact:px-3 compact:py-2 bg-gray-600 flex items-center justify-end space-x-3 rounded-box !rounded-t-none'
                }
            >
                {children}
            </div>
        );
    }, [children]);

    return null;
};
