import { Action, action, Thunk, thunk } from 'easy-peasy';
import updateAccountEmail from '@/api/account/updateAccountEmail';
import updateAccountProfile from '@/api/account/updateAccountProfile';

export interface UserData {
    uuid: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    language: string;
    languageSet: boolean;
    rootAdmin: boolean;
    useTotp: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserStore {
    data?: UserData;
    setUserData: Action<UserStore, UserData>;
    updateUserData: Action<UserStore, Partial<UserData>>;
    updateUserEmail: Thunk<UserStore, { email: string; password: string }, any, UserStore, Promise<void>>;
    updateUserProfile: Thunk<
        UserStore,
        { username: string; firstName: string; lastName: string },
        any,
        UserStore,
        Promise<void>
    >;
}

const user: UserStore = {
    data: undefined,
    setUserData: action((state, payload) => {
        state.data = payload;
    }),

    updateUserData: action((state, payload) => {
        // @ts-expect-error limitation of Typescript, can't do much about that currently unfortunately.
        state.data = { ...state.data, ...payload };
    }),

    updateUserProfile: thunk(async (actions, payload) => {
        await updateAccountProfile(payload.username, payload.firstName, payload.lastName);

        actions.updateUserData({
            username: payload.username,
            firstName: payload.firstName,
            lastName: payload.lastName,
        });
    }),

    updateUserEmail: thunk(async (actions, payload) => {
        await updateAccountEmail(payload.email, payload.password);

        actions.updateUserData({ email: payload.email });
    }),
};

export default user;
