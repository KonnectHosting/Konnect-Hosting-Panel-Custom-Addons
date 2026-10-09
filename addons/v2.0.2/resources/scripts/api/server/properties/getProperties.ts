import http from '@/api/http';

export default (uuid: string, file: string): Promise<Record<string, string | boolean | number>> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/servers/${uuid}/files/contents`, {
            params: { file },
            transformResponse: (res) => res,
            responseType: 'text',
        })
            .then(({ data }) => {
                const raw = data
                    .split("\n")
                    .filter((line: string) => line && !line.startsWith("#"))
                    .reduce((acc: Record<string, string | boolean>, line: string) => {
                        const [key, value] = line.split("=");
                        if (key && value !== undefined) {
                            acc[key] = value === "true" ? true : value === "false" ? false : value;
                        }
                        return acc;
                    }, {});

                resolve(raw);
            })
            .catch(reject);
    });
};
