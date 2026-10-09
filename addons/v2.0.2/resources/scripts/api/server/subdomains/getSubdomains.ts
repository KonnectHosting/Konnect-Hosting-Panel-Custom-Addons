import http from '@/api/http';

export interface ServerSubdomains {
    data: { [key: string]: {
        full_domain: string,
        ip: string,
        port: number
    }};
}

const getSubdomains = (id: string): Promise<ServerSubdomains> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/${id}/domain`)
            .then((response) => {
                const domains = response.data.data;
                resolve({ data: domains });
            })
            .catch(reject);
    });
};

export default getSubdomains;