import http from '@/api/http';

export interface PresetRequest {
    preset: any;
}
export interface PresetResponse {
    success: boolean;
    message: string;
    imported?: number;
}

export function updatePreset(payload: PresetRequest): Promise<PresetResponse> {
    return new Promise((resolve, reject) => {
        http.post('/admin/arix/api/preset', payload)
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}

export interface Presets {
    resource_id: number;
    title: string;
    tag_line: string;
    cover_image_url: string;
    download_count: number;
    creator: {
        name: string;
        url: string;
    };
}

export function getPresets(): Promise<Presets[]> {
    return new Promise((resolve, reject) => {
        http.get('/admin/arix/api/preset')
            .then((response) => resolve(response.data.data))
            .catch(reject);
    });
}
