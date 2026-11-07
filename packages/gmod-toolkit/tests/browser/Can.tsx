import React from 'react';
export default ({ action, children }: React.PropsWithChildren<{ action: string | string[] }>) => {
    const actions = Array.isArray(action) ? action : [action];
    const readonly = new URLSearchParams(location.search).has('readonly');
    return <>{readonly && actions.some((item) => ['file.create', 'file.update'].includes(item)) ? null : children}</>;
};
