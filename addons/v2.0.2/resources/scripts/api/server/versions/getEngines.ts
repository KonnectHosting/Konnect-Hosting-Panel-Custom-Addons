import http from '@/api/http';

export interface VersionEngines {
    data: string[];
    current: {
        service: string;
        version: string;
    };
}

const getEngines = (id: string | number): Promise<VersionEngines> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/${id}/versions`)
            .then((response) => {
                resolve(response.data);
            })
            .catch(reject);
    });
};

export default getEngines;