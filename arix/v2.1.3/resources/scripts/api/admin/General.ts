import http from '@/api/http';

export interface GeneralSettings {
    logo: string;
    logoLight: string;
    fullLogo: boolean;
    logoHeight: number;
    discord?: string;
    support?: string;
}

export default function getGeneral(): Promise<GeneralSettings> {
    return new Promise((resolve, reject) => {
        http.get('/admin/arix/api')
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}

export function updateGeneral(payload: GeneralSettings): Promise<GeneralSettings> {
    return new Promise((resolve, reject) => {
        http.post('/admin/arix/api', payload)
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}
