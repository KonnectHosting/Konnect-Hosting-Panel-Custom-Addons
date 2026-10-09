import { useEffect, useRef } from 'react';
import { useFormikContext } from 'formik';
import buildSettingsHash from '@/plugins/buildSettingsHash';

interface FormPreviewHashSyncProps<T extends object> {
    prefix: string;
    initialValues: T;
    onHashChange: (value: string) => void;
}

export default function FormPreviewHashSync<T extends object>({
    prefix,
    initialValues,
    onHashChange,
}: FormPreviewHashSyncProps<T>): null {
    const { values, touched } = useFormikContext<T>();
    const includedKeysRef = useRef<Set<string>>(new Set());
    const lastHashRef = useRef<string>('');

    useEffect(() => {
        const { hash, changedKeys } = buildSettingsHash(prefix, initialValues, values, {
            touched,
            includeKeys: includedKeysRef.current,
        });

        changedKeys.forEach((key) => includedKeysRef.current.add(key));

        if (hash !== lastHashRef.current) {
            lastHashRef.current = hash;
            onHashChange(hash);
        }
    }, [prefix, initialValues, values, touched, onHashChange]);

    return null;
}
