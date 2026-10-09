import http from '@/api/http';

export default (username: string, firstName: string, lastName: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.put('/api/client/account/profile', {
            username,
            name_first: firstName,
            name_last: lastName,
        })
            .then(() => resolve())
            .catch(reject);
    });
};
