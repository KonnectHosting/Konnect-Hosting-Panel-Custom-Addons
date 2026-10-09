import http from "@/api/http";

export function activate(id: string): Promise<{
    attributes: {
        enabled: boolean;
        port: number;
    }
}> {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/${id}/fivem/txadmin/activate`)
            .then((response) => {
                resolve(response.data);
            })
            .catch(reject);
    });
}

export function deactivate(id: string) {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/${id}/fivem/txadmin/deactivate`)
            .then((response) => {
                resolve(response.data);
            })
            .catch(reject);
    });
}