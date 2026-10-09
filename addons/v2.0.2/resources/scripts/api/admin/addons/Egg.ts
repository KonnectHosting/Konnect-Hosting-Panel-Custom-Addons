import http from "@/api/http";

export interface Eggs {
    name: string;
    raw_url: string;
    information: string;
    parent_groups?: string[];
}

export function getEggs(target: string): Promise<Eggs[]> {
    return http.get(`/admin/nests/eggs/repository/${target}`).then((r) => r.data);
}

export function importEgg(egg: Eggs, nestId: number): Promise<void> {
    return fetch(egg.raw_url)
        .then((response) => {
            if (!response.ok) {
                throw new Error('Failed to download the egg file from the repository.');
            }

            return response.blob();
        })
        .then((blob) => {
            const data = new FormData();
            data.append('import_file', new File([blob], `${egg.name}.json`, { type: 'application/json' }));
            data.append('import_to_nest', String(nestId));

            return http.post('/admin/nests/import', data, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
        })
        .then(() => undefined);
}