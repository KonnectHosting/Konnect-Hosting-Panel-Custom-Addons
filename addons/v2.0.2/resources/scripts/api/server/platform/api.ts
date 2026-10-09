import http, { getPaginationSet, PaginatedResult } from '@/api/http';
import { InstalledResourceItem, ResourceItem, ResourceVersions } from '@/api/server/platform/types';

export const getResourceServices = ({ id, resource }: { id: string; resource: string }): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/${id}/${resource}/`)
            .then(({ data }) => resolve(data.services ?? []))
            .catch(reject);
    });
};

export const getResourceFilters = ({ id, resource }: { id: string; resource: string }): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/${id}/${resource}/filters`)
            .then(({ data }) => resolve(data.versions ?? []))
            .catch(reject);
    });
};

export const getInstalledResourceItems = ({
    id,
    resource,
}: {
    id: string;
    resource: string;
}): Promise<InstalledResourceItem[]> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/${id}/${resource}/installed`)
            .then(({ data }) => resolve(data))
            .catch(reject);
    });
};

export const getResourceItems = ({
    id,
    resource,
    service,
    ...params
}: {
    id: string;
    resource: string;
    service: string;
    [key: string]: unknown;
}): Promise<PaginatedResult<ResourceItem>> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/${id}/${resource}/${service}`, { params })
            .then(({ data }) =>
                resolve({
                    items: data.data,
                    pagination: getPaginationSet(data.meta.pagination),
                })
            )
            .catch(reject);
    });
};

export const getResourceItemVersions = ({
    id,
    resource,
    service,
    itemId,
}: {
    id: string;
    resource: string;
    service: string;
    itemId: string;
}): Promise<ResourceVersions> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/${id}/${resource}/${service}/${itemId}`)
            .then(({ data }) => resolve({ versions: data.versions }))
            .catch(reject);
    });
};

export const installResourceItem = ({
    id,
    resource,
    service,
    itemId,
    itemName,
    itemIcon,
    version,
}: {
    id: string;
    resource: string;
    service: string;
    itemId: string;
    itemName: string;
    itemIcon: string;
    version: string;
}): Promise<InstalledResourceItem> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/${id}/${resource}/install`, {
            plugin_icon: itemIcon,
            plugin_name: itemName,
            plugin_service: service,
            plugin_version: version,
            plugin_service_id: itemId,
        })
            .then(({ data }) => resolve(data))
            .catch(reject);
    });
};

export const deleteResourceItem = ({
    id,
    resource,
    itemId,
}: {
    id: string;
    resource: string;
    itemId: number;
}): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.delete(`/api/client/${id}/${resource}/${itemId}`)
            .then(() => resolve())
            .catch(reject);
    });
};
