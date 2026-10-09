import http from '@/api/http';

export interface MailSettings {
    editor: 'simple' | 'editor' | 'developer';

    logo: string;
    logoFull: boolean;

    editorCode?: string;
    editorJson?: string;

    developerCode?: string;

    template: 'default';

    color: string;

    status?: string;
    billing?: string;
    support?: string;
}

export default function getMail(): Promise<MailSettings> {
    return new Promise((resolve, reject) => {
        http.get('/admin/arix/api/mail')
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}

export function updateMail(payload: MailSettings): Promise<MailSettings> {
    return new Promise((resolve, reject) => {
        http.post('/admin/arix/api/mail', payload)
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}

export function testMail(): Promise<void> {
    return new Promise((resolve, reject) => {
        http.post('/admin/settings/mail/test')
            .then(() => resolve())
            .catch(reject);
    });
}
