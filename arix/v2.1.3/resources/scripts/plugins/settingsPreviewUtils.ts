export type Primitive = string | number | boolean | null | undefined;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const flattenObject = (value: Record<string, unknown>, basePath = ''): Record<string, Primitive> => {
    return Object.entries(value).reduce<Record<string, Primitive>>((result, [key, entry]) => {
        const path = basePath ? `${basePath}.${key}` : key;

        if (isPlainObject(entry)) {
            return { ...result, ...flattenObject(entry, path) };
        }

        return { ...result, [path]: entry as Primitive };
    }, {});
};

export const primitiveToString = (value: Primitive): string => {
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }

    if (typeof value === 'number') {
        return String(value);
    }

    return value ?? '';
};

export const primitiveEquals = (left: Primitive, right: Primitive): boolean => {
    return primitiveToString(left) === primitiveToString(right);
};
