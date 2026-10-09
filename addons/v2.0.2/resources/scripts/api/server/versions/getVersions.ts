import http from '@/api/http';

export interface McVersions {
    data: {
        version: string;
        download_url: string;
    }[];
    current: {
        service: string;
        version: string;
    };
}

const getVersions = (id: string, engine: string): Promise<McVersions> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/${id}/versions/${engine}`)
            .then((response) => {
                resolve(response.data);
            })
            .catch(reject);
    });
};

export default getVersions;