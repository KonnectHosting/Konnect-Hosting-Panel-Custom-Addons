import http from '@/api/http';

export default (uuid: string, url: string, directory: string, filename: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/servers/${uuid}/files/pull`, { url, directory, filename })
            .then((data) => resolve(console.log(data)))
            .catch(reject);
    });
};
