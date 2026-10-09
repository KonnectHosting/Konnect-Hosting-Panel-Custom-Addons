import http from '@/api/http';

export interface CommandHistory {
    id: number;
    command: string;
    executed_at: number;
}

export default function getCommandHistory(uuid: string): Promise<CommandHistory[]> {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/servers/${uuid}/command-history`)
            .then(({ data }) => resolve((data.data || []).map((item: any) => item.attributes)))
            .catch(reject);
    });
}

export function addCommandToHistory(uuid: string, command: string): Promise<void> {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/servers/${uuid}/command-history`, { command })
            .then(() => resolve())
            .catch(reject);
    });
}

export function clearCommandHistory(uuid: string): Promise<void> {
    return new Promise((resolve, reject) => {
        http.delete(`/api/client/servers/${uuid}/command-history`)
            .then(() => resolve())
            .catch(reject);
    });
}
