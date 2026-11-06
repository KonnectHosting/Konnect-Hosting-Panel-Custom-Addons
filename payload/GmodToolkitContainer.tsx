import React from 'react';
import { Redirect } from 'react-router-dom';
import { ServerContext } from '@/state/server';

// Keep existing bookmarks working while Arix links are assigned to the new pages.
export default () => {
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    return <Redirect to={`/server/${id}/workshop`} />;
};
