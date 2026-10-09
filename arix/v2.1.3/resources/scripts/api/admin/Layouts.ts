import http from '@/api/http';

export interface LayoutsSettings {
    layout: 'default' | 'slim' | 'pill' | 'floating' | 'horizontal';
    dock: 'sidebar' | 'header' | 'top';
    hoverEffect: 'default' | 'filled' | 'filled secondary' | 'icon pill' | 'pill' | 'pill secondary';
    searchComponent: string;

    logoPosition: string;
    socialPosition: string;
    loginLayout: string;
}

export default function getLayouts(): Promise<LayoutsSettings> {
    return new Promise((resolve, reject) => {
        http.get('/admin/arix/api/layout')
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}

export function updateLayouts(payload: LayoutsSettings): Promise<LayoutsSettings> {
    return new Promise((resolve, reject) => {
        http.post('/admin/arix/api/layout', payload)
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}
