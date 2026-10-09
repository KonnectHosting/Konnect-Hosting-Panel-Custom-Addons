import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getInstalledResourceItems } from '@/api/server/platform/api';
import { InstalledResourceItem } from '@/api/server/platform/types';
import useFlash from '@/plugins/useFlash';

interface InstalledItemsContextValue {
    items: InstalledResourceItem[];
    loading: boolean;
    appendItem: (item: InstalledResourceItem) => void;
    removeItem: (idOrFileName: number | string) => void;
}

const InstalledItemsContext = createContext<InstalledItemsContextValue | null>(null);

export function InstalledItemsProvider({
    id,
    resource,
    children,
}: {
    id: string;
    resource: string;
    children: React.ReactNode;
}) {
    const [items, setItems] = useState<InstalledResourceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { addError, clearFlashes } = useFlash();

    useEffect(() => {
        setLoading(true);
        clearFlashes('resource-browser');

        getInstalledResourceItems({ id, resource })
            .then(setItems)
            .catch((error) => addError({ key: 'resource-browser', message: error.message }))
            .finally(() => setLoading(false));
    }, [id, resource]);

    const appendItem = useCallback((item: InstalledResourceItem) => {
        setItems((prev) => (prev.some((existing) => existing.id === item.id) ? prev : [...prev, item]));
    }, []);

    const removeItem = useCallback((idOrFileName: number | string) => {
        setItems((prev) => prev.filter((item) => item.id !== idOrFileName && item.file_name !== idOrFileName));
    }, []);

    return (
        <InstalledItemsContext.Provider value={{ items, loading, appendItem, removeItem }}>
            {children}
        </InstalledItemsContext.Provider>
    );
}

export function useInstalledItems(): InstalledItemsContextValue {
    const ctx = useContext(InstalledItemsContext);
    if (!ctx) {
        throw new Error('useInstalledItems() must be used within an <InstalledItemsProvider>');
    }

    return ctx;
}
