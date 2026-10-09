import { flattenObject, primitiveEquals, primitiveToString } from '@/plugins/settingsPreviewUtils';

interface BuildSettingsHashOptions {
    touched?: unknown;
    includeKeys?: Iterable<string>;
}

const flattenTouched = (value: unknown, basePath = ''): Set<string> => {
    if (value === true && basePath) {
        return new Set([basePath]);
    }

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return new Set();
    }

    return Object.entries(value).reduce<Set<string>>((result, [key, entry]) => {
        const path = basePath ? `${basePath}.${key}` : key;
        const nested = flattenTouched(entry, path);
        nested.forEach((item) => result.add(item));
        return result;
    }, new Set());
};

interface BuildSettingsHashResult {
    hash: string;
    changedKeys: Set<string>;
}

export default function buildSettingsHash<T extends object>(
    prefix: string,
    initialValues: T,
    currentValues: T,
    options: BuildSettingsHashOptions = {}
): BuildSettingsHashResult {
    const initialFlat = flattenObject(initialValues as unknown as Record<string, unknown>);
    const currentFlat = flattenObject(currentValues as unknown as Record<string, unknown>);
    const touchedKeys = options.touched ? flattenTouched(options.touched) : new Set<string>();
    const includeKeys = new Set(options.includeKeys ?? []);
    const changedKeys = new Set<string>();

    const changedEntries = Object.entries(currentFlat)
        .filter(([key, value]) => {
            const hasChanged = !primitiveEquals(initialFlat[key], value);
            if (hasChanged) {
                changedKeys.add(key);
            }

            return includeKeys.has(key) || touchedKeys.has(key) || hasChanged;
        })
        .map(([key, value]) => {
            const hashKey = `${prefix}-${key.replace(/\./g, '-')}`;
            const hashValue = primitiveToString(value);
            return `${encodeURIComponent(hashKey)}=${encodeURIComponent(hashValue)}`;
        });

    return {
        hash: changedEntries.join('&'),
        changedKeys,
    };
}
