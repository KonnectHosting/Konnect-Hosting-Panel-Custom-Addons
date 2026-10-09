import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { HiOutlineUserCircle, HiOutlineServer, HiUserCircle, HiServer } from 'react-icons/hi';
import { LuCircleUser, LuServer } from 'react-icons/lu';
import { RiAccountCircle2Line, RiServerLine, RiAccountCircle2Fill, RiServerFill } from 'react-icons/ri';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { useTranslation } from 'react-i18next';
import ClientDropdown from '@/routers/layouts/ClientDropdown';
import NavigationLinks from './NavigationLinks';

interface Props {
    children?: React.ReactNode;
    type?: boolean;
}

const SideBar = ({ children, type }: Props) => {
    const { t } = useTranslation('arix/navigation');
    const name = useStoreState((state: ApplicationStore) => state.settings.data!.name);
    const layout = useStoreState((state: ApplicationStore) => state.settings.data!.arix.layout.layout);
    const { logo, logoLight, logoHeight, fullLogo } = useStoreState(
        (state: ApplicationStore) => state.settings.data!.arix.general
    );
    const hoverEffect = useStoreState((state: ApplicationStore) => state.settings.data!.arix.layout.hoverEffect);

    const theme = localStorage.getItem('theme') || 'dark';

    return (
        <div
            className={`
                ${
                    layout === 'floating'
                        ? 'top-3 ml-3 h-[calc(100vh-1.5rem)] rounded-box w-[260px] '
                        : 'h-screen !border-t-0 !border-b-0 !border-l-0 w-[250px]'
                }
                shrink-0 bg-gray-700 overflow-y-auto lg:flex hidden flex-col sticky top-0 backdrop boxBorder
            `}
        >
            <div className={'pt-3'}>
                <Link to={'/'} className='flex gap-x-2 items-center font-semibold text-lg text-gray-50 px-5 pt-2 pb-5'>
                    <img
                        src={theme === 'light' ? logoLight : logo}
                        alt={name + ' logo'}
                        style={{ height: `${logoHeight}px` }}
                    />
                    {!fullLogo && name}
                </Link>
                {!type && (
                    <NavigationLinks className={`mb-4 ${hoverEffect.replace(' ', '_')}`}>
                        <div className='routers_links'>
                            <NavLink to={'/'} className='routers_link' exact>
                                <div className='routers_link_icon'>
                                    <HiOutlineServer className={'text-lg'} />
                                </div>
                                <span className='routers_link_title'>{t('servers')}</span>
                            </NavLink>
                            <NavLink to={'/account'} className='routers_link'>
                                <div className='routers_link_icon'>
                                    <HiOutlineUserCircle className={'text-lg'} />
                                </div>
                                <span className='routers_link_title'>{t('account')}</span>
                            </NavLink>
                        </div>
                    </NavigationLinks>
                )}
                <div className={'border-b border-gray-500'} />
            </div>
            {children && (
                <NavigationLinks className={`pb-2 ${hoverEffect.replace(' ', '_')}`}>{children}</NavigationLinks>
            )}
            <div className='sticky bottom-0 bg-gray-700 pb-4 z-20 mt-auto backdrop-blur-xl'>
                <hr className={'border-b border-gray-500 mb-4'} />
                <div className='px-5'>
                    <ClientDropdown sideBar={true} />
                </div>
            </div>
        </div>
    );
};

export default SideBar;
