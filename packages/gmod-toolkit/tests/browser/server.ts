export const ServerContext = {
    useStoreState: (selector: (state: unknown) => unknown) =>
        selector({
            server: { data: { id: 'demo', uuid: '12345678-1234-1234-1234-123456789abc', name: 'Demo server' } },
        }),
};
