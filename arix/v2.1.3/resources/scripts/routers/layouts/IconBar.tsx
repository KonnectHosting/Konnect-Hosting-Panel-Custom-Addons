import React, { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import { UserCircleIcon, CogIcon, EyeIcon, LogoutIcon, ServerIcon } from '@heroicons/react/outline';
import http from '@/api/http';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components/macro';
import tw from 'twin.macro';

const NavigationLinks = styled.div`
    ${tw`flex flex-col gap-2 h-full py-2`};

    & > div,
    .routers_links {
        ${tw`flex flex-col gap-2`};

        & .routers_category {
            ${tw`hidden`}
        }
    }

    & .logo {
        ${tw`px-0`};
    }

    & a,
    & button {
        ${tw`relative z-10 flex items-center justify-center px-2 duration-300 rounded-component mx-2`};
        aspect-ratio: 1 / 1;

        & .routers_link_title,
        & span {
            ${tw`hidden`}
        }

        & .routers_link_icon {
            ${tw`w-5`}
        }

        &.active,
        &:focus,
        &:hover {
            ${tw`bg-gray-500`}
        }
    }
`;

interface Props {
    children?: React.ReactNode;
}

const SideBarIcon = ({ children }: Props) => {
    const { t } = useTranslation('arix/navigation');
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const { logo, logoLight, logoHeight } = useStoreState(
        (state: ApplicationStore) => state.settings.data!.arix.general
    );

    const rootAdmin = useStoreState((state: ApplicationStore) => state.user.data!.rootAdmin);

    const darkMode = localStorage.getItem('darkMode') === 'true';

    const onTriggerLogout = () => {
        setIsLoggingOut(true);
        http.post('/auth/logout').finally(() => {
            // @ts-expect-error this is valid
            window.location = '/';
        });
    };

    return (
        <div
            className={
                'shrink-0 bg-gray-700 h-screen overflow-y-auto lg:flex hidden flex-col sticky top-0 backdrop boxBorder border-t-0 border-b-0 border-l-0'
            }
        >
            <SpinnerOverlay visible={isLoggingOut} />
            <NavigationLinks>
                <div className={'pb-2 border-b border-gray-500'}>
                    <a href={'/'} className='logo'>
                        <img
                            src={darkMode ? logoLight : logo}
                            alt={name + 'logo'}
                            css={`
                                height: ${logoHeight}px;
                            `}
                        />
                        <span>{t('servers')}</span>
                    </a>
                    <NavLink to={'/'} exact className={`routers_link`}>
                        <div className='routers_link_icon'>
                            <ServerIcon />
                        </div>
                        <span className='routers_link_title'>{t('servers')}</span>
                    </NavLink>
                    <NavLink to={'/account'} className={`routers_link`}>
                        <div className='routers_link_icon'>
                            <UserCircleIcon />
                        </div>
                        <span className='routers_link_title'>{t('account')}</span>
                    </NavLink>
                    {rootAdmin && (
                        <a href={'/admin'} className={`routers_link`}>
                            <div className='routers_link_icon'>
                                <CogIcon />
                            </div>
                            <span className='routers_link_title'>{t('admin-view')}</span>
                        </a>
                    )}
                </div>
                {children ? children : ''}
                <div className={'mt-auto pt-2 border-t border-gray-500'}>
                    <button onClick={onTriggerLogout}>
                        <LogoutIcon />
                        <span>{t('logout')}</span>
                    </button>
                </div>
            </NavigationLinks>
        </div>
    );
};

export default SideBarIcon;
