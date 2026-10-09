import http from '@/api/http';
import { rawDataToTrashbinItem } from '@/api/transformers';

export interface TrashbinItem {
    trashRoot: string;
    trashName: string;
    displayName: string;
    originalRoot: string | null;
    originalName: string | null;
    isDirectory: boolean;
    isFile: boolean;
    size: number;
    mimetype: string;
    createdAt: Date;
    modifiedAt: Date;
    hasMetadata: boolean;
}

const stripTrashbinPrefix = (name: string): string => {
    const match = name.match(/^[A-Za-z0-9]{5}-(.+)$/);

    return match ? match[1] : name;
};

export const getTrashbin = async (uuid: string): Promise<TrashbinItem[]> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/files/trashbin`);

    return (data.data || []).map((item: any) => {
        const transformed = rawDataToTrashbinItem(item);

        return {
            ...transformed,
            displayName: stripTrashbinPrefix(transformed.trashName),
        };
    });
};

export const moveToTrashbin = (uuid: string, directory: string, files: string[]): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/servers/${uuid}/files/trashbin/move`, { root: directory, files })
            .then(() => resolve())
            .catch(reject);
    });
};

export const restoreTrashbin = (uuid: string, files: string[]): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/servers/${uuid}/files/trashbin/restore`, { files })
            .then(() => resolve())
            .catch(reject);
    });
};

export const deleteTrashbin = (uuid: string, files: string[]): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.delete(`/api/client/servers/${uuid}/files/trashbin/delete`, { data: { files } })
            .then(() => resolve())
            .catch(reject);
    });
};
