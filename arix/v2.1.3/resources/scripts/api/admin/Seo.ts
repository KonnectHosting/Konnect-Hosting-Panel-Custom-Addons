import http from '@/api/http';

export interface SeoSettings {
    index: boolean;
    color: string;
    favicon: string;
    title: string;
    description: string;
    image: string;
}

export default function getSeo(): Promise<SeoSettings> {
    return new Promise((resolve, reject) => {
        http.get('/admin/arix/api/meta')
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}

export function updateSeo(payload: SeoSettings): Promise<SeoSettings> {
    return new Promise((resolve, reject) => {
        http.post('/admin/arix/api/meta', payload)
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}
