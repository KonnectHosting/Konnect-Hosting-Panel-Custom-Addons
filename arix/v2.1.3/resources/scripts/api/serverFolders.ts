import http from '@/api/http';

export interface ServerFolder {
    id: number;
    name: string;
    color: string | null;
    icon: string | null;
    parent_id: number | null;
    servers: string[] | null;
}

interface ServerFoldersResponse {
    object: string;
    data: Array<{
        object: string;
        attributes: ServerFolder;
    }>;
}

interface ServerFolderResponse {
    object: string;
    attributes: ServerFolder;
}

interface CreateServerFolderParams {
    name: string;
    color?: string;
    icon?: string;
    parent_id?: number;
    servers?: number[];
}

interface UpdateServerFolderParams {
    name?: string;
    color?: string;
    icon?: string;
    parent_id?: number;
    servers?: number[];
}

export const getServerFolders = (): Promise<ServerFolder[]> => {
    return new Promise((resolve, reject) => {
        http.get('/api/client/server-folders')
            .then(({ data }: { data: ServerFoldersResponse }) => {
                resolve(data.data.map((item) => item.attributes));
            })
            .catch(reject);
    });
};

export const createServerFolder = (params: CreateServerFolderParams): Promise<ServerFolder> => {
    return new Promise((resolve, reject) => {
        http.post('/api/client/server-folders', params)
            .then(({ data }: { data: ServerFolderResponse }) => {
                resolve(data.attributes);
            })
            .catch(reject);
    });
};

export const updateServerFolder = (id: number, params: UpdateServerFolderParams): Promise<ServerFolder> => {
    return new Promise((resolve, reject) => {
        http.put(`/api/client/server-folders/${id}`, params)
            .then(({ data }: { data: ServerFolderResponse }) => {
                resolve(data.attributes);
            })
            .catch(reject);
    });
};

export const deleteServerFolder = (id: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.delete(`/api/client/server-folders/${id}`)
            .then(() => resolve())
            .catch(reject);
    });
};

export const addServerToFolder = (folderId: number, serverUuid: string): Promise<ServerFolder> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/server-folders/${folderId}/servers/${serverUuid}`)
            .then(({ data }: { data: ServerFolderResponse }) => {
                resolve(data.attributes);
            })
            .catch(reject);
    });
};

export const removeServerFromFolder = (folderId: number, serverUuid: string): Promise<ServerFolder> => {
    return new Promise((resolve, reject) => {
        http.delete(`/api/client/server-folders/${folderId}/servers/${serverUuid}`)
            .then(({ data }: { data: ServerFolderResponse }) => {
                resolve(data.attributes);
            })
            .catch(reject);
    });
};
