import http from '@/api/http';

export interface AnnouncementSettings {
    enabled: boolean;
    position: 'header' | 'top';
    color: string;
    icon: string;
    message: string;
    cta: boolean;
    ctaTitle: string;
    ctaLink: string;
    dismissable: boolean;
}

export default function getAnnouncement(): Promise<AnnouncementSettings> {
    return new Promise((resolve, reject) => {
        http.get('/admin/arix/api/announcement')
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}

export function updateAnnouncement(payload: AnnouncementSettings): Promise<AnnouncementSettings> {
    return new Promise((resolve, reject) => {
        http.post('/admin/arix/api/announcement', payload)
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}
