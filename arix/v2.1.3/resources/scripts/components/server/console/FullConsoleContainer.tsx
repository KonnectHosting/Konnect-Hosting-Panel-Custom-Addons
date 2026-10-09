import React from 'react';
import Spinner from '@/components/elements/Spinner';
import Console from '@/components/server/console/Console';

const FullConsoleContainer = () => {
    return (
        <div>
            <Spinner.Suspense>
                <Console fullConsole />
            </Spinner.Suspense>
            <div className={'fixed top-0 left-0 h-full w-full z-[50] bg-gray-800'} />
        </div>
    );
};

export default FullConsoleContainer;
