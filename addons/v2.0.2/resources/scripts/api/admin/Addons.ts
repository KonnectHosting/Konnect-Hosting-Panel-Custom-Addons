import http from '@/api/http';

export interface AddonSettings {
    key: string;
    enabled: boolean;
    eggs: number[];
    nests: number[];
    [key: string]: unknown;
}

export function getAddons(): Promise<Record<string, AddonSettings>> {
    return http.get('/admin/arix/api/addons').then((r) => r.data);
}

export function updateAddon(addonKey: string, payload: Omit<AddonSettings, 'key'>): Promise<AddonSettings> {
    return http.post(`/admin/arix/api/addons/${addonKey}`, payload).then((r) => r.data);
}
