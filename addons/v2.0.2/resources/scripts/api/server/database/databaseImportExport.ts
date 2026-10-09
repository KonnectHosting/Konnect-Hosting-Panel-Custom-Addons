import http from '@/api/http';

export function exportServerDatabase(uuid: string, databaseId: string): Promise<Blob> {
    return http
        .get(`/api/client/servers/${uuid}/databases/${databaseId}/export`, { responseType: 'blob' })
        .then((r) => r.data);
}

export function importServerDatabase(
    uuid: string,
    databaseId: string,
    file: File,
    wipe: boolean
): Promise<void> {
    const data = new FormData();
    data.append('sql', file);
    data.append('wipe', wipe ? '1' : '0');

    return http
        .post(`/api/client/servers/${uuid}/databases/${databaseId}/import`, data, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then(() => undefined);
}