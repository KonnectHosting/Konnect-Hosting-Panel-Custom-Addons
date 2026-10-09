export type HashEntry = [string, string];

const decodePart = (value: string): string => {
    return decodeURIComponent(value.replace(/\+/g, '%20'));
};

export const parseHashString = (hash: string): HashEntry[] => {
    return hash
        .replace(/^#/, '')
        .split('&')
        .filter((entry) => entry.trim().length > 0)
        .map((entry): HashEntry => {
            const [rawKey = '', rawValue = ''] = entry.split('=');
            return [decodePart(rawKey), decodePart(rawValue)];
        })
        .filter(([key]) => key.length > 0);
};

export const stringifyHashEntries = (entries: HashEntry[]): string => {
    return entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
};

export const mergeHashByPrefix = (existingHash: string, nextHash: string): string => {
    const currentEntries = parseHashString(existingHash);
    const nextEntries = parseHashString(nextHash);

    if (nextEntries.length === 0) {
        return stringifyHashEntries(currentEntries);
    }

    const targetPrefixes = new Set(nextEntries.map(([key]) => key.split('-')[0]).filter((prefix) => prefix.length > 0));

    const keptEntries = currentEntries.filter(([key]) => {
        const prefix = key.split('-')[0];
        return !targetPrefixes.has(prefix);
    });

    return stringifyHashEntries([...keptEntries, ...nextEntries]);
};
