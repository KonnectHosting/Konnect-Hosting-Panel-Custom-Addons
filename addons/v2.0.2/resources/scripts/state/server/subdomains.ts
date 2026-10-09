import { action, Action } from 'easy-peasy';

export interface ServerSubdomain { 
    full_domain: string;
    ip: string;
    port: number;
}

export interface ServerSubdomains { 
    [key: string]: ServerSubdomain;
}

export interface ServerSubdomainsStore {
    data: ServerSubdomains;
    setSubdomains: Action<ServerSubdomainsStore, ServerSubdomains>;
    appendSubdomain: Action<ServerSubdomainsStore, { key: string; domain: ServerSubdomain }>;
    removeSubdomain: Action<ServerSubdomainsStore, string>;
}

const subdomains: ServerSubdomainsStore = {
    data: {},

    setSubdomains: action((state, payload) => {
        state.data = { ...payload };
    }),

    appendSubdomain: action((state, payload) => {
        if (!state.data[payload.key]) {
            state.data[payload.key] = payload.domain;
        }
    }),

    removeSubdomain: action((state, payload) => {
        delete state.data[payload];
    }),
};

export default subdomains;