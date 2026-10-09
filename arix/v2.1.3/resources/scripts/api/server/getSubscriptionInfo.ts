import http from '@/api/http';

export interface SubscriptionInfo {
    status: string;
    price?: {
        amount: string;
        currency?: string;
    };
    expires_at?: string;
    product?: string;
    serviceLink: string;
    invoice: {
        pending: boolean;
        id?: string;
        due_at?: string;
        amount?: string;
        link?: string;
    };
}

export default (uuid: string): Promise<SubscriptionInfo> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/servers/${uuid}/subscription`)
            .then(({ data }) => resolve(data.data))
            .catch(reject);
    });
};
