import React, { useEffect, useState } from 'react';
import { ApplicationStore } from '@/state';
import { useStoreState } from 'easy-peasy';
import { Route, Switch, useRouteMatch } from 'react-router-dom';
import LoginContainer from '@/components/auth/LoginContainer';
import ForgotPasswordContainer from '@/components/auth/ForgotPasswordContainer';
import ResetPasswordContainer from '@/components/auth/ResetPasswordContainer';
import LoginCheckpointContainer from '@/components/auth/LoginCheckpointContainer';
import RegisterContainer from '@/components/auth/RegisterContainer';
import { SupportIcon } from '@heroicons/react/outline';
import { FaDiscord } from 'react-icons/fa';
import { NotFound } from '@/components/elements/ScreenBlock';
import { useHistory, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';

const Switches = () => {
    const { path } = useRouteMatch();
    const history = useHistory();
    const location = useLocation();
    const registration = useStoreState((state: ApplicationStore) => state.settings.data!.arix.advanced.registration);

    return (
        <Switch location={location}>
            <Route path={`${path}/login`} component={LoginContainer} exact />
            {registration && <Route path={`${path}/register`} component={RegisterContainer} exact />}
            <Route path={`${path}/login/checkpoint`} component={LoginCheckpointContainer} />
            <Route path={`${path}/password`} component={ForgotPasswordContainer} exact />
            <Route path={`${path}/password/reset/:token`} component={ResetPasswordContainer} />
            <Route path={`${path}/checkpoint`} />
            <Route path={'*'}>
                <NotFound onBack={() => history.push('/auth/login')} />
            </Route>
        </Switch>
    );
};

const TopBar = () => {
    const { t } = useTranslation('arix/auth');
    const [guildData, setGuildData] = useState<{ instant_invite: string } | null>(null);

    const name = useStoreState((state: ApplicationStore) => state.settings.data!.name);
    const { logoPosition, socialPosition } = useStoreState(
        (state: ApplicationStore) => state.settings.data!.arix.layout
    );

    const { logo, logoLight, logoHeight, fullLogo, discord, support } = useStoreState(
        (state: ApplicationStore) => state.settings.data!.arix.general
    );

    const darkMode = localStorage.getItem('darkMode') === 'true';

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(`https://discord.com/api/guilds/${discord}/widget.json`);

                if (!response.ok) {
                    throw new Error('Failed to fetch guild data');
                }

                const data = await response.json();
                setGuildData(data);
            } catch (error) {
                console.error('Error fetching guild data:', error);
            }
        };

        fetchData();
    }, []);

    return (
        <div className={'flex items-center justify-between p-5'}>
            {logoPosition === 'top' && (
                <div className='flex gap-x-2 items-center font-semibold text-lg text-gray-50 pb-5'>
                    <img src={darkMode ? logoLight : logo} alt={name + 'logo'} style={{ height: `${logoHeight}px` }} />
                    {!fullLogo && name}
                </div>
            )}
            {socialPosition === 'top' && (
                <div className={'flex gap-x-6'}>
                    {discord && (
                        <>
                            {guildData !== null ? (
                                <a
                                    className={'flex gap-x-1 items-center duration-300 hover:text-gray-100'}
                                    href={guildData.instant_invite}
                                >
                                    <FaDiscord /> Discord
                                </a>
                            ) : (
                                <a href={''}>
                                    <FaDiscord />
                                    Discord
                                </a>
                            )}
                        </>
                    )}
                    {support && (
                        <a className={'flex gap-x-1 items-center duration-300 hover:text-gray-100'} href={support}>
                            <SupportIcon className={'w-5'} />
                            {t('support')}
                        </a>
                    )}
                </div>
            )}
        </div>
    );
};

const AuthContainer = () => {
    const loginBackground = useStoreState(
        (state: ApplicationStore) => state.settings.data!.arix.styling.loginBackground
    );
    const loginLayout = useStoreState((state: ApplicationStore) => state.settings.data!.arix.layout.loginLayout);

    return (
        <div
            className={'min-h-screen h-full bg-center bg-no-repeat bg-cover z-10 relative'}
            css={`
                background-image: url(${loginLayout === 'default' || loginLayout === 'flat' ? loginBackground : ''});
            `}
        >
            {loginLayout === 'default' || loginLayout === 'flat' ? (
                <>
                    <div className={'min-h-screen flex flex-col'}>
                        <TopBar />
                        <Switches />
                    </div>
                </>
            ) : loginLayout === 'side' ? (
                <div className={'grid lg:grid-cols-2'}>
                    <div className={'flex flex-col min-h-screen h-full'}>
                        <TopBar />
                        <Switches />
                    </div>
                    <div
                        className={'h-full bg-center bg-no-repeat bg-cover bg-arix z-10 relative'}
                        css={`
                            background-image: url(${loginBackground});
                        `}
                    ></div>
                </div>
            ) : loginLayout === 'floating' ? (
                <div className={'grid lg:grid-cols-2'}>
                    <div className={'flex flex-col min-h-screen h-full'}>
                        <TopBar />
                        <Switches />
                    </div>
                    <div className={'h-full lg:p-5'}>
                        <div
                            className={
                                'h-full bg-center bg-no-repeat bg-cover bg-arix rounded-box overflow-hidden relative z-10'
                            }
                            css={`
                                background-image: url(${loginBackground});
                            `}
                        ></div>
                    </div>
                </div>
            ) : (
                <div className={'h-screen flex items-center justify-center'}>
                    <div className={'grid lg:grid-cols-2 items-center max-w-5xl bg-gray-700 backdrop boxBorder rounded-box'}>
                        <div className={'flex flex-col h-full pb-12'}>
                            <TopBar />
                            <Switches />
                        </div>
                        <div className={'h-full'}>
                            <div
                                className={
                                    'h-full bg-center bg-no-repeat bg-cover bg-arix rounded-box overflow-hidden relative z-10'
                                }
                                css={`
                                    background-image: url(${loginBackground});
                                `}
                            ></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuthContainer;
