import http from '@/api/http';

export type Tier = 'budget' | 'standard' | 'premium';

export interface LinkItem {
    icon: string;
    name: string;
    url: string;
    permission?: string[];
    nests?: number[];
    eggs?: number[];
    active: boolean;
    tier?: Tier[];
}

export interface LinkCategory {
    name: string;
    permission?: string[];
    nests?: number[];
    eggs?: number[];
    active: boolean;
    links: LinkItem[];
}

export interface NestProps {
    object: string;
    attributes: {
        id: number;
        name: string;
    };
}

export interface EggProps {
    object: string;
    attributes: {
        id: number;
        name: string;
    };
}

export type LinkSettings = Record<string, LinkCategory>;

export default function getLink(): Promise<LinkSettings> {
    return new Promise((resolve, reject) => {
        http.get('/admin/arix/api/link')
            .then((response) => resolve(response.data.links ?? response.data))
            .catch(reject);
    });
}

export function updateLink(payload: LinkSettings): Promise<LinkSettings> {
    return new Promise((resolve, reject) => {
        http.post('/admin/arix/api/link', {
            'arix:links': payload,
        })
            .then((response) => resolve(response.data.links ?? response.data))
            .catch(reject);
    });
}

export function getNests(): Promise<NestProps[]> {
    return new Promise((resolve, reject) => {
        http.get('/api/application/nests')
            .then((response) => resolve(response.data.data))
            .catch(reject);
    });
}

export function getEggs(nestId: number): Promise<EggProps[]> {
    return new Promise((resolve, reject) => {
        http.get(`/api/application/nests/${nestId}/eggs`)
            .then((response) => resolve(response.data.data))
            .catch(reject);
    });
}
