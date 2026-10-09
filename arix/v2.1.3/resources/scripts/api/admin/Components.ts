import http from '@/api/http';

export interface ComponentsSettings {
    serverRow: string;
    statsCards: number;
    sideGraphs: number;
    graphs: number;
    titledBoxStyle: 'default' | 'line' | 'fill' | 'pill';
    statsStyle: 'default' | 'reversed' | 'minimal' | 'minimalReversed';
    tableStyle: 'default' | 'cards';
}

export default function getComponents(): Promise<ComponentsSettings> {
    return new Promise((resolve, reject) => {
        http.get('/admin/arix/api/components')
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}

export function updateComponents(payload: ComponentsSettings): Promise<ComponentsSettings> {
    return new Promise((resolve, reject) => {
        http.post('/admin/arix/api/components', payload)
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}
