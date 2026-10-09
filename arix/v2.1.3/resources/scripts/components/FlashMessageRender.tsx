import React, { useEffect } from 'react';
import MessageBox from '@/components/MessageBox';
import Portal from '@/components/elements/Portal';
import { useStoreState, useStoreActions } from 'easy-peasy';

type Props = Readonly<{
    byKey?: string;
    className?: string;
}>;

const FlashMessageRender = ({ byKey, className }: Props) => {
    const flashes = useStoreState((state) =>
        state.flashes.items.filter((flash) => (byKey ? flash.key === byKey : true))
    );

    const clearFlashes = useStoreActions((actions) => actions.flashes.clearFlashes);

    useEffect(() => {
        if (flashes.length > 0) {
            const timeoutId = setTimeout(() => {
                clearFlashes(byKey);
            }, 6000);
            return () => clearTimeout(timeoutId);
        }
        return () => {};
    }, [flashes, clearFlashes, byKey]);

    return flashes.length ? (
        <Portal>
            <div className={`${className ? className : ''} fixed top-0 right-0 w-full flex flex-col items-end pointer-events-none z-50 gap-2 p-4`}>
                {flashes.map((flash, index) => (
                    <React.Fragment key={flash.id || flash.type + flash.message}>
                        <MessageBox type={flash.type} title={flash.title}>
                            {flash.message}
                        </MessageBox>
                    </React.Fragment>
                ))}
            </div>
        </Portal>
    ) : null;
};

export default FlashMessageRender;
