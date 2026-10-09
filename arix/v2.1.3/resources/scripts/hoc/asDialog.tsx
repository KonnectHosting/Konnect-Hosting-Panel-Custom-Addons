import React, { useState } from 'react';
import { Dialog, DialogProps, DialogWrapperContext, WrapperProps } from '@/components/elements/dialog';

function asDialog(
    initialProps?: WrapperProps | (() => WrapperProps)
    // eslint-disable-next-line @typescript-eslint/ban-types
): <P extends {}>(C: React.ComponentType<P>) => React.FunctionComponent<P & DialogProps> {
    return function (Component) {
        return function ({ open, onClose, ...rest }) {
            const resolvedProps = typeof initialProps === 'function' ? initialProps() : (initialProps || {});
            const [extraProps, setProps] = useState<WrapperProps>({});
            const props = { ...resolvedProps, ...extraProps };

            return (
                <DialogWrapperContext.Provider value={{ props, setProps, close: onClose }}>
                    <Dialog {...props} open={open} onClose={onClose}>
                        <Component {...(rest as React.ComponentProps<typeof Component>)} />
                    </Dialog>
                </DialogWrapperContext.Provider>
            );
        };
    };
}

export default asDialog;
