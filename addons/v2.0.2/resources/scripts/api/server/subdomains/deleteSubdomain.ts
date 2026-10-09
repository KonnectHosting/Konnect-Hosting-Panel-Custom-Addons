import http from '@/api/http';

export interface DeleteSubdomain {
    data: string;
}

const getZones = (id: string, domain: string): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        http.delete(`/api/client/${id}/domain/${domain}`)
            .then((response) => {
                if (response.data.status === 'error') {
                    reject(new Error(response.data.message || 'Unknown error occurred'));
                } else {
                    resolve(response.data.message);
                }
            })
            .catch(reject);
    });
};

export default getZones;
