import http from '@/api/http';

export interface ConnectedDomain {
    domain: string;
    zone_id: string | null;
    status: 'active' | 'inactive' | 'error';
    serverCount: number;
    created_at: string;
    updated_at: string;
}

export interface CloudflareConfig {
    api_key: string;
    proxy_records: boolean;
    use_alias: boolean;
    use_domain_alias: boolean;
}

export interface BlocklistEntry {
    id: number;
    subdomain: string;
    reason: string | null;
    created_at: string;
}

export function getConnectedDomains(): Promise<ConnectedDomain[]> {
    return http.get('/admin/domain/connected').then((r) => r.data);
}

export function connectDomain(domain: string): Promise<void> {
    return http.post('/admin/domain/connect', { domain }).then(() => undefined);
}

export function disconnectDomain(domain: string): Promise<void> {
    return http.delete(`/admin/domain/disconnect/${encodeURIComponent(domain)}`).then(() => undefined);
}

export function getCloudflareConfig(): Promise<CloudflareConfig | null> {
    return http.get('/admin/domain/cloudflare/config').then((r) => r.data);
}

export function setCloudflareConfig(data: {
    apiKey: string;
    proxyRecords: boolean;
    useAlias: boolean;
    useDomainAlias: boolean;
}): Promise<void> {
    return http
        .post('/admin/domain/set/CF/key', {
            CloudFlareKey: data.apiKey,
            proxyRecords: data.proxyRecords,
            useAlias: data.useAlias,
            useDomainAlias: data.useDomainAlias,
        })
        .then(() => undefined);
}

export function getBlocklist(): Promise<BlocklistEntry[]> {
    return http.get('/admin/domain/blocklist').then((r) => r.data);
}

export function addBlocklistEntry(word: string, reason?: string): Promise<void> {
    return http.post('/admin/domain/blocklist', { word, reason }).then(() => undefined);
}

export function removeBlocklistEntry(id: number): Promise<void> {
    return http.delete(`/admin/domain/blocklist/${id}`).then(() => undefined);
}

export function exportBlocklist(): Promise<Blob> {
    return http.get('/admin/domain/blocklist/export', { responseType: 'blob' }).then((r) => r.data);
}

export function importBlocklist(file: File): Promise<void> {
    const data = new FormData();
    data.append('blocklist', file);

    return http
        .post('/admin/domain/blocklist/import', data, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then(() => undefined);
}