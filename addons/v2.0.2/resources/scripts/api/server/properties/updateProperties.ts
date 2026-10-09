import http from '@/api/http';

export default async (uuid: string, file: string, content: Record<string, string | boolean | number>): Promise<void> => {
    const properties = Object.entries(content)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

    await http.post(`/api/client/servers/${uuid}/files/write`, properties, {
        params: { file },
        headers: {
            'Content-Type': 'text/plain',
        },
    }); 
};
