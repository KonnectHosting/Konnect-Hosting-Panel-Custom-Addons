import http from '@/api/http';

export interface StartupCommand {
    id: number;
    name: string;
    command: string;
    isDefault: boolean;
}

export function getStartupCommands (uuid: string): Promise<StartupCommand[]> {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/servers/${uuid}/startup/commands`)
            .then((response) => resolve(response.data.data))
            .catch(reject);
    });
};

export function switchStartupCommand (uuid: string, commandId: number): Promise<StartupCommand[]> {
    return new Promise((resolve, reject) => {
        http.put(`/api/client/servers/${uuid}/startup/command`, {
            id: commandId
        })
            .then((response) => resolve(response.data))
            .catch(reject);
    });
};