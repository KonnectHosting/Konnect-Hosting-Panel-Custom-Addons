import http from '@/api/http';

export interface Eggs {
    can_choose_startup_update: number;
    can_reinstall: string;
    eggs: {
        id: number;
        nest_id: number;
        name: string;
    }[];
}

export default function getChangeEggs(uuid: string): Promise<Eggs> {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/servers/${uuid}/egg-changer`)
            .then(({ data }) => resolve(data.attributes))
            .catch(reject);
    });
}

export function changeEgg({
    uuid, eggId, updateStartup, reinstall
}: {
    uuid: string;
    eggId: number;
    updateStartup: boolean;
    reinstall: boolean;
}): Promise<void> {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/servers/${uuid}/egg-changer`, {
            egg_id: eggId,
            update_startup: updateStartup,
            reinstall: reinstall
        })
            .then(() => resolve())
            .catch(reject);
    });
}