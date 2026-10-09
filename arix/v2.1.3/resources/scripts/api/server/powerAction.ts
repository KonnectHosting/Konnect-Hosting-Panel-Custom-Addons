import http from '@/api/http';

export default (uuid: string, action: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/servers/${uuid}/power`, {
            signal: action,
        })
            .then(() => resolve())
            .catch(reject);
    });
};

export function sendCommand(uuid: string, command: string): Promise<void> {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/servers/${uuid}/command`, {
            command,
        })
            .then(() => resolve())
            .catch(reject);
    });
}
