import React from 'react';
import { NavLink, Route, Switch } from 'react-router-dom';
import DashboardContainer from '@/components/dashboard/dashboard/DashboardContainer';
import { NotFound } from '@/components/elements/ScreenBlock';
import TransitionRouter from '@/TransitionRouter';
import { useLocation } from 'react-router';
import Spinner from '@/components/elements/Spinner';
import routes from '@/routers/routes';

import ContentContainer from '@/components/elements/ContentContainer';
import { CodeIcon, CogIcon, EyeIcon, KeyIcon, LockClosedIcon, UserIcon } from '@heroicons/react/outline';
import LayoutWrapper from './layouts/LayoutWrapper';
import Announcement from '@/components/elements/Announcement';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { useTranslation } from 'react-i18next';

export default () => {
    const { t } = useTranslation('arix/account');
    const position = useStoreState((state: ApplicationStore) => state.settings.data!.arix.announcement.position);
    const location = useLocation();

    return (
        <LayoutWrapper>
            {position === 'top' && <Announcement />}
            {location.pathname.startsWith('/account') && (
                <div className='border-b border-gray-600 pt-6 px-4'>
                    <ContentContainer>
                        <div className={'flex items-center gap-x-3 mb-4'}>
                            <div
                                className={
                                    'w-10 h-10 bg-arix/30 rounded-component !border-none flex items-center justify-center text-arix'
                                }
                            >
                                <UserIcon className={'w-6'} />
                            </div>
                            <p className={'text-lg font-medium text-gray-300'}>{t('account-settings')}</p>
                        </div>
                        <div className='flex items-center overflow-y-auto gap-x-8'>
                            <NavLink
                                to={'/account'}
                                className={
                                    'border-b whitespace-nowrap border-transparent py-2 flex items-center gap-1 hover:text-gray-100 duration-300'
                                }
                                activeClassName={'!border-arix text-gray-100'}
                                exact
                            >
                                <CogIcon className={'w-5'} />
                                {t('general')}
                            </NavLink>
                            <NavLink
                                to={'/account/security'}
                                className={
                                    'border-b whitespace-nowrap border-transparent py-2 flex items-center gap-1 hover:text-gray-100 duration-300'
                                }
                                activeClassName={'!border-arix text-gray-100'}
                            >
                                <LockClosedIcon className={'w-5'} />
                                {t('security')}
                            </NavLink>
                            <NavLink
                                to={'/account/ssh-keys'}
                                className={
                                    'border-b whitespace-nowrap border-transparent py-2 flex items-center gap-1 hover:text-gray-100 duration-300'
                                }
                                activeClassName={'!border-arix text-gray-100'}
                            >
                                <KeyIcon className={'w-5'} />
                                {t('ssh-keys')}
                            </NavLink>
                            <NavLink
                                to={'/account/api-keys'}
                                className={
                                    'border-b whitespace-nowrap border-transparent py-2 flex items-center gap-1 hover:text-gray-100 duration-300'
                                }
                                activeClassName={'!border-arix text-gray-100'}
                            >
                                <CodeIcon className={'w-5'} />
                                {t('api-keys')}
                            </NavLink>
                            <NavLink
                                to={'/account/activity'}
                                className={
                                    'border-b whitespace-nowrap border-transparent py-2 flex items-center gap-1 hover:text-gray-100 duration-300'
                                }
                                activeClassName={'!border-arix text-gray-100'}
                            >
                                <EyeIcon className={'w-5'} />
                                {t('activity')}
                            </NavLink>
                        </div>
                    </ContentContainer>
                </div>
            )}
            <TransitionRouter>
                <React.Suspense fallback={<Spinner centered />}>
                    <Switch location={location}>
                        <Route path={'/'} exact>
                            <DashboardContainer />
                        </Route>
                        {routes.account.map(({ path, component: Component }) => (
                            <Route key={path} path={`/account/${path}`.replace('//', '/')} exact>
                                <Component />
                            </Route>
                        ))}
                        <Route path={'*'}>
                            <NotFound />
                        </Route>
                    </Switch>
                </React.Suspense>
            </TransitionRouter>
        </LayoutWrapper>
    );
};
