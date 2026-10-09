import http from '@/api/http';

export interface StylingSettings {
    pageTitle: boolean;

    background: boolean;
    backgroundImage?: string;
    backgroundImageLight?: string;
    backgroundFaded: 'default' | 'translucent' | 'faded';
    loginBackground?: string;

    backdrop: boolean;
    backdropPercentage: number;

    radiusInput: number;
    radiusBox: number;

    borderInput: boolean;
    borderBox: boolean;

    clickEffect: 'drop' | 'shrink' | 'outline';
    pageTransition: 'fadeUp' | 'fadeIn' | 'fadeScale';

    flashMessage: number;

    font: string;
}

export default function getStyling(): Promise<StylingSettings> {
    return new Promise((resolve, reject) => {
        http.get('/admin/arix/api/styling')
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}

export function updateStyling(payload: StylingSettings): Promise<StylingSettings> {
    return new Promise((resolve, reject) => {
        http.post('/admin/arix/api/styling', payload)
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}
