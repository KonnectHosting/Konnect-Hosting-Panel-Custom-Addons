import * as React from 'react';
import { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import SearchContainer from '@/components/dashboard/search/SearchContainer';
import ClientDropdown from '@/routers/layouts/ClientDropdown';
import tw from 'twin.macro';
import styled from 'styled-components/macro';
import ServerSelector from '@/components/elements/ServerSelector';
import { MenuIcon, XIcon } from '@heroicons/react/outline';

import { HiOutlineUserCircle, HiOutlineServer, HiOutlineSupport } from 'react-icons/hi';
import { FaDiscord } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import CommandPalette from '@/components/elements/CommandPalette';
import NavigationLinks from './NavigationLinks';

interface Props {
    children?: React.ReactNode;
}
const RightNavigation = styled.div`
    ${tw`lg:flex items-center gap-x-5 hidden`}

    & > a,
    & > button,
    & > .navigation-link {
        ${tw`flex items-center no-underline text-neutral-200 py-2 cursor-pointer transition-all duration-150 gap-x-1`};

        &:active,
        &:hover {
            ${tw`text-neutral-100`};
        }

        & > svg {
            ${tw`w-5`}
        }
    }
`;

export default ({ children }: Props) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [guildData, setGuildData] = useState<{ instant_invite: string } | null>(null);

    const { t } = useTranslation(['arix/navigation']);

    const name = useStoreState((state: ApplicationStore) => state.settings.data!.name);
    const { logo, logoLight, logoHeight, fullLogo, discord, support } = useStoreState(
        (state: ApplicationStore) => state.settings.data!.arix.general
    );
    const { layout, dock, searchComponent, hoverEffect } = useStoreState(
        (state: ApplicationStore) => state.settings.data!.arix.layout
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

    useEffect(() => {
        isOpen ? document.body.classList.add('overflow-hidden') : document.body.classList.remove('overflow-hidden');
    }, [isOpen]);

    return (
        <>
            <div
                className={`w-full px-4 overflow-x-auto !overflow-visible z-20 relative ${
                    layout === 'horizontal' || dock === 'header' || layout === 'pill'
                        ? 'bg-gray-700 backdrop border-b border-gray-600'
                        : ''
                }`}
            >
                <div className={`mx-auto w-full flex items-center justify-between max-w-[1200px] py-2`}>
                    <div className='flex gap-x-10 items-center flex-1'>
                        {(layout === 'horizontal' || layout === 'pill') && (
                            <div className={'lg:flex hidden gap-x-2 items-center'}>
                                <Link
                                    to={'/'}
                                    className='flex gap-x-2 items-center font-semibold text-lg text-gray-50 py-2'
                                >
                                    <img
                                        src={darkMode ? logoLight : logo}
                                        alt={name + 'logo'}
                                        css={`
                                            height: ${logoHeight}px;
                                        `}
                                    />
                                    {!fullLogo && name}
                                </Link>
                            </div>
                        )}
                        <div className={'lg:hidden flex gap-x-2 items-center'}>
                            <Link
                                to={'/'}
                                className='flex gap-x-2 items-center font-semibold text-lg text-gray-50 py-2'
                            >
                                <img
                                    src={darkMode ? logoLight : logo}
                                    alt={name + 'logo'}
                                    css={`
                                        height: ${logoHeight}px;
                                    `}
                                />
                                {!fullLogo && name}
                            </Link>
                        </div>
                        <div className={'sm:block hidden flex-1'}>
                            {searchComponent === 'Command Palette' ? (
                                <CommandPalette />
                            ) : searchComponent === 'Server Selector' ? (
                                <ServerSelector />
                            ) : (
                                <SearchContainer />
                            )}
                        </div>
                    </div>
                    <RightNavigation>
                        {discord && (
                            <a href={guildData?.instant_invite}>
                                <FaDiscord /> Discord
                            </a>
                        )}
                        {support && (
                            <a href={support} className='shrink-0 whitespace-nowrap'>
                                <HiOutlineSupport className={'text-lg'} />
                                {t`supportcenter`}
                            </a>
                        )}
                        {(layout === 'horizontal' || layout === 'pill') && <ClientDropdown />}
                    </RightNavigation>
                    <button
                        onClick={() => setIsOpen((isOpen) => !isOpen)}
                        className='lg:hidden p-2 bg-secondary-200 border border-secondary-100 rounded'
                    >
                        <MenuIcon className={'w-5'} />
                    </button>
                </div>
            </div>
            <div
                className={`fixed top-0 ${
                    isOpen ? 'left-0' : '-left-full'
                } duration-300 h-full w-full bg-gray-700 z-[99] backdrop-blur-xl py-2 flex flex-col overflow-y-auto text-xl`}
            >
                <div className={'flex justify-between items-center px-4'}>
                    <div className={'flex gap-x-2 items-center'} onClick={() => setIsOpen((isOpen) => !isOpen)}>
                        <Link to={'/'} className='flex gap-x-2 items-center font-semibold text-lg text-gray-50 py-2'>
                            <img
                                src={darkMode ? logoLight : logo}
                                alt={name + 'logo'}
                                css={`
                                    height: ${logoHeight}px;
                                `}
                            />
                            {!fullLogo && name}
                        </Link>
                    </div>
                    <button
                        onClick={() => setIsOpen((isOpen) => !isOpen)}
                        className='p-2 bg-secondary-200 border border-secondary-100 rounded'
                    >
                        <XIcon className={'w-5'} />
                    </button>
                </div>
                <NavigationLinks
                    className={`mb-4 ${hoverEffect.replace(' ', '_')}`}
                    onClick={() => setIsOpen((isOpen) => !isOpen)}
                >
                    <div>
                        <NavLink to={'/'} exact className='routers_link'>
                            <div className='routers_link_icon'>
                                <HiOutlineServer size='1.25rem' />
                            </div>
                            <span className='routers_link_title'>{t`servers`}</span>
                        </NavLink>
                        <NavLink to={'/account'} className='routers_link'>
                            <div className='routers_link_icon'>
                                <HiOutlineUserCircle size='1.25rem' />
                            </div>
                            <span className='routers_link_title'>{t`account`}</span>
                        </NavLink>
                    </div>
                    {children}
                </NavigationLinks>
                <div className={'mt-auto px-4'}>
                    <ClientDropdown sideBar={true} />
                </div>
            </div>
        </>
    );
};
