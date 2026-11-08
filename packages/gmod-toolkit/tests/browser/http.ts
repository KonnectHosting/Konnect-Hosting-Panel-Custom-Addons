async function request(url: string, method = 'GET', data?: unknown) {
    const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const value = await response.json();
    if (!response.ok)
        throw Object.assign(new Error(value.message), { response: { data: value, status: response.status } });
    return { data: value };
}
export default {
    get: (url: string) => request(url),
    post: (url: string, data?: unknown) => request(url, 'POST', data),
};
export const httpErrorToHuman = (error: Error) => error.message;
