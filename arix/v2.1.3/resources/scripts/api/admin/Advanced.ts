import http from '@/api/http';

export interface AdvancedSettings {
    defaultMode: string;
    modeToggler: boolean;
    langSwitch: boolean;
    defaultLang: string;
    languageOptions: { key: string; name: string }[];
    copyright: string;
    profileType: string;
    ipFlag: boolean;
    lowResourcesAlert: boolean;
    alertLink?: string;
    dashboardPage: boolean;
    registration: boolean;

    trashbin: boolean;
    gracePeriod: number;

    adminTheme: boolean;

    tierVisibility: string;

    profileCustomization: {
        username: boolean;
        name: boolean;
        email: boolean;
    };

    subscription: {
        target: string;
        endpoint?: string;
        identifier?: string;
        secret?: string;
        alert: boolean;
    };
}

export interface AdvancedResponse extends AdvancedSettings {
    availableLanguages: Record<string, string | null>;
}

export default function getAdvanced(): Promise<AdvancedResponse> {
    return new Promise((resolve, reject) => {
        http.get('/admin/arix/api/advanced')
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}

export function updateAdvanced(payload: AdvancedSettings): Promise<AdvancedResponse> {
    return new Promise((resolve, reject) => {
        http.post('/admin/arix/api/advanced', payload)
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}
