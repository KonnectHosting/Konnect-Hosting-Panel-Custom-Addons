import http from '@/api/http';

export interface SocialSettings {
    socials: {
        title: string;
        icon: string;
        description: string;
        url: string;
    }[];
    socialButtons: boolean;
    discordBox: boolean;
}

export default function getSocial(): Promise<SocialSettings> {
    return new Promise((resolve, reject) => {
        http.get('/admin/arix/api/social')
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}

export function updateSocial(payload: SocialSettings): Promise<SocialSettings> {
    return new Promise((resolve, reject) => {
        http.post('/admin/arix/api/social', payload)
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}
