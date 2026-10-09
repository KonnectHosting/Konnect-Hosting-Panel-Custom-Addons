import { useEffect } from 'react';
import { store } from '@/state';
import { parseHashString } from '@/plugins/previewHash';

const getValueAtPath = (source: unknown, path: string): unknown => {
    return path.split('.').reduce((current: any, segment) => {
        if (current === null) {
            return undefined;
        }

        return current[segment];
    }, source);
};

const parseValue = (input: string, currentValue: unknown): unknown => {
    if (typeof currentValue === 'boolean') {
        return input === 'true';
    }

    if (typeof currentValue === 'number') {
        const parsed = Number(input);
        return Number.isNaN(parsed) ? currentValue : parsed;
    }

    return input;
};

const normalizeSettingKey = (hashKey: string): string => {
    if (hashKey.includes('.')) {
        return hashKey;
    }

    return hashKey.replace(/-/g, '.');
};

const applySettingsFromHash = (): void => {
    const settings = store.getState().settings.data;
    if (!settings) {
        return;
    }

    const entries = parseHashString(window.location.hash);
    if (!entries.length) {
        return;
    }

    entries.forEach(([rawKey, rawValue]) => {
        const settingKey = normalizeSettingKey(rawKey);
        if (!settingKey.includes('.')) {
            return;
        }

        const currentValue = getValueAtPath(settings, settingKey);
        if (typeof currentValue === 'undefined') {
            return;
        }

        const parsedValue = parseValue(rawValue, currentValue);
        store.getActions().settings.updateSetting({ key: settingKey, value: parsedValue });
    });
};

export default function useSettingsDetector(adminPreview: boolean | undefined, rootAdmin: boolean | undefined): void {
    useEffect(() => {
        if (!adminPreview || !rootAdmin) {
            return;
        }

        applySettingsFromHash();

        const handleHashChange = () => applySettingsFromHash();
        window.addEventListener('hashchange', handleHashChange);

        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [adminPreview, rootAdmin]);
}
