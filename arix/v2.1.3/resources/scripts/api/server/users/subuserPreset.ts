import http from '@/api/http';

export interface SubuserPreset {
    id: number;
    name: string;
    permissions: string[];
}

const toPreset = (item: any): SubuserPreset => ({
    id: item.attributes.id,
    name: item.attributes.name,
    permissions: item.attributes.permissions ?? [],
});

export function getPresets(uuid: string): Promise<SubuserPreset[]> {
    return http.get(`/api/client/servers/${uuid}/users/presets`).then((r) => (r.data.data || []).map(toPreset));
}

export function createPreset(uuid: string, name: string, permissions: string[]): Promise<SubuserPreset> {
    return http.post(`/api/client/servers/${uuid}/users/presets`, { name, permissions }).then((r) => toPreset(r.data));
}

export function deletePreset(uuid: string, presetId: number): Promise<void> {
    return http
        .delete(`/api/client/servers/${uuid}/users/presets`, { data: { preset_id: presetId } })
        .then(() => undefined);
}

export function updatePreset(
    uuid: string,
    presetId: number,
    name: string,
    permissions: string[]
): Promise<SubuserPreset> {
    return http
        .put(`/api/client/servers/${uuid}/users/presets`, { preset_id: presetId, name, permissions })
        .then((r) => toPreset(r.data));
}
