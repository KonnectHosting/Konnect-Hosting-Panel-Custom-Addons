import http from '@/api/http';

interface RequestParameters {
    domain?: string;
    subdomain?: string;
    allocation?: number;
}

export default async (id: string, params: RequestParameters): Promise<any> => { 
    return new Promise((resolve, reject) => {
        http.post(
            `/api/client/${id}/domain`, {
                domain: params.domain,
                subdomain: params.subdomain,
                port_id: params.allocation
            }
        )
        .then((response) => {
            if (response.data.status === 'error') {
                reject(new Error(response.data.message || 'Unknown error occurred'));
            } else {
                resolve({ id: response.data.id });
            }
        })
        .catch((error) => {
            reject(new Error(error.response?.data?.message || error.message || 'Request failed'));
        });
    });
};