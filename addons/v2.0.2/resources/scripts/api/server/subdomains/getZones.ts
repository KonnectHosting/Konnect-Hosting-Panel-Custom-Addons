import http from '@/api/http';

export interface DomainZones {
    data: string[];
}

const getZones = (): Promise<DomainZones> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/domain/zones`)
            .then((response) => {
                const data = response.data.data;
                const zones = (Array.isArray(data) ? data : Object.values(data ?? {})) as string[];
                resolve({ data: zones });
            })
            .catch(reject);
    });
};

export default getZones;