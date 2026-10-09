import React, { lazy, useEffect } from 'react';
import { hot } from 'react-hot-loader/root';
import { Route, Router, Switch } from 'react-router-dom';
import { StoreProvider } from 'easy-peasy';
import { store } from '@/state';
import { SiteSettings } from '@/state/settings';
import ProgressBar from '@/components/elements/ProgressBar';
import { NotFound } from '@/components/elements/ScreenBlock';
import tw from 'twin.macro';
import GlobalStylesheet from '@/assets/css/GlobalStylesheet';
import { history } from '@/components/history';
import { setupInterceptors } from '@/api/interceptors';
import AuthenticatedRoute from '@/components/elements/AuthenticatedRoute';
import { ServerContext } from '@/state/server';
import { FloatingProvider } from '@/context/FloatingContext';
import '@/assets/tailwind.css';
import Spinner from '@/components/elements/Spinner';
import i18n from '@/i18n';
import useSettingsDetector from '@/plugins/useSettingsDetector';
import HotkeyManager from '@/components/elements/HotkeyManager';

const DashboardRouter = lazy(() => import(/* webpackChunkName: "dashboard" */ '@/routers/DashboardRouter'));
const ServerRouter = lazy(() => import(/* webpackChunkName: "server" */ '@/routers/ServerRouter'));
const AuthenticationRouter = lazy(() => import(/* webpackChunkName: "auth" */ '@/routers/AuthenticationRouter'));
const AdminRouter = lazy(() => import(/* webpackChunkName: "admin" */ '@/routers/AdminRouter'));

interface ExtendedWindow extends Window {
    SiteConfiguration?: SiteSettings;
    PterodactylUser?: {
        uuid: string;
        username: string;
        name_first: string;
        name_last: string;
        email: string;
        /* eslint-disable camelcase */
        root_admin: boolean;
        use_totp: boolean;
        language: string;
        language_set: boolean;
        updated_at: string;
        created_at: string;
        /* eslint-enable camelcase */
    };
    AdminPreview?: boolean;
}

setupInterceptors(history);

const App = () => {
    const { PterodactylUser, SiteConfiguration, AdminPreview } = window as ExtendedWindow;
    if (PterodactylUser && !store.getState().user.data) {
        store.getActions().user.setUserData({
            uuid: PterodactylUser.uuid,
            username: PterodactylUser.username,
            firstName: PterodactylUser.name_first,
            lastName: PterodactylUser.name_last,
            email: PterodactylUser.email,
            language: PterodactylUser.language,
            languageSet: PterodactylUser.language_set,
            rootAdmin: PterodactylUser.root_admin,
            useTotp: PterodactylUser.use_totp,
            createdAt: new Date(PterodactylUser.created_at),
            updatedAt: new Date(PterodactylUser.updated_at),
        });
    }

    if (!store.getState().settings.data) {
        store.getActions().settings.setSettings(SiteConfiguration!);
    }

    useSettingsDetector(AdminPreview, PterodactylUser?.root_admin);

    useEffect(() => {
        if (PterodactylUser?.language && PterodactylUser?.language_set) {
            i18n.changeLanguage(PterodactylUser.language);
        } else {
            i18n.changeLanguage(SiteConfiguration?.arix.advanced.defaultLang || 'en');
        }
    }, []);

    useEffect(() => {
        const applyPreferences = () => {
            const preferences = [
                { key: 'theme', classMap: { light: 'lightmode', oled: 'oled', auto: 'auto' } },
                { key: 'compactMode', className: 'compact' },
                { key: 'privacyMode', className: 'privacy' },
                { key: 'animations', className: 'animationsDisabled' },
            ];

            preferences.forEach(({ key, className, classMap }) => {
                const value = localStorage.getItem(key);

                if (classMap) {
                    Object.values(classMap).forEach((cls) => document.body.classList.remove(cls));
                    if (value && classMap[value as keyof typeof classMap]) {
                        document.body.classList.add(classMap[value as keyof typeof classMap]);

                        if (value === 'auto') {
                            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                            document.body.classList.toggle('lightmode', !prefersDark);
                        }
                    }
                } else if (className) {
                    document.body.classList.toggle(className, value === 'true');
                }
            });
        };

        applyPreferences();

        window.addEventListener('storage', applyPreferences);
        return () => window.removeEventListener('storage', applyPreferences);
    }, []);

    return (
        <>
            <GlobalStylesheet />
            <StoreProvider store={store}>
                <FloatingProvider>
                    <ProgressBar />
                    <div css={tw`mx-auto w-auto`}>
                        <Router history={history}>
                            <HotkeyManager />
                            <Switch>
                                <Route path={'/auth'}>
                                    <Spinner.Suspense>
                                        <AuthenticationRouter />
                                    </Spinner.Suspense>
                                </Route>
                                <AuthenticatedRoute path={'/server/:id'}>
                                    <Spinner.Suspense>
                                        <ServerContext.Provider>
                                            <ServerRouter />
                                        </ServerContext.Provider>
                                    </Spinner.Suspense>
                                </AuthenticatedRoute>
                                <AuthenticatedRoute path={'/admin/arix'} isAdmin>
                                    <Spinner.Suspense>
                                        <AdminRouter />
                                    </Spinner.Suspense>
                                </AuthenticatedRoute>
                                <AuthenticatedRoute path={'/'}>
                                    <Spinner.Suspense>
                                        <DashboardRouter />
                                    </Spinner.Suspense>
                                </AuthenticatedRoute>
                                <Route path={'*'}>
                                    <NotFound />
                                </Route>
                            </Switch>
                        </Router>
                    </div>
                </FloatingProvider>
            </StoreProvider>
        </>
    );
};

export default hot(App);
