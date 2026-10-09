import http from '@/api/http';

export interface ColorPalette {
    primary: string;
    successText: string;
    successBorder: string;
    successBackground: string;
    dangerText: string;
    dangerBorder: string;
    dangerBackground: string;
    secondaryText: string;
    secondaryBorder: string;
    secondaryBackground: string;
    gray50: string;
    gray100: string;
    gray200: string;
    gray300: string;
    gray400: string;
    gray500: string;
    gray600: string;
    gray700: string;
    gray800: string;
    gray900: string;
}

export interface ColorSettings {
    dark: ColorPalette;
    light: ColorPalette;
}

export default function getColors(): Promise<ColorSettings> {
    return new Promise((resolve, reject) => {
        http.get('/admin/arix/api/colors')
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}

export function updateColors(payload: ColorSettings): Promise<ColorSettings> {
    return new Promise((resolve, reject) => {
        http.post('/admin/arix/api/colors', payload)
            .then((response) => resolve(response.data))
            .catch(reject);
    });
}
