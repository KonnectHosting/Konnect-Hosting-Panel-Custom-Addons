import http from '@/api/http';

interface UpdateServerOrderParams {
    server_ordered: string[];
}

export const getServerOrder = (): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/server-orders`)
            .then(({ data }) => {
                if (data.data && data.data.length > 0) {
                    resolve(data.data[0].attributes.server_ordered);
                } else {
                    resolve([]);
                }
            })
            .catch(reject);
    });
};

export const updateServerOrder = (params: UpdateServerOrderParams): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.put(`/api/client/server-orders`, {
            server_ordered: params.server_ordered,
        })
            .then(() => resolve())
            .catch(reject);
    });
};
