import React from 'react';
export default ({ children }: React.PropsWithChildren<Record<string, unknown>>) => (
    <main className={'p-4 md:p-6'}>{children}</main>
);
