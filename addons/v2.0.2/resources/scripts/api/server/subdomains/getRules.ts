import http from '@/api/http';

export interface Rules {
    data: Record<string, string>;
}

export default function({ nest }: { nest: number }): Promise<Rules> {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/domain/rules/${nest}`)
            .then((response) => {
                resolve({ data: response.data });
            })
            .catch(reject);
    });
};
