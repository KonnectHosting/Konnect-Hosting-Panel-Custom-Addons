import * as React from 'react';
import { useState, useRef } from 'react';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import http from '@/api/http';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import UserAvatar from '@/components/UserAvatar';
import DropdownMenu, { DropdownLinkRow, DropdownButtonRow, DropdownDivider } from '@/components/elements/DropdownMenu';
import {
    UserCircleIcon,
    CogIcon,
    ColorSwatchIcon,
    EyeIcon,
    LogoutIcon,
    DotsVerticalIcon,
} from '@heroicons/react/outline';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface Dropdown {
    sideBar?: Boolean;
}

const ClientDropdown = ({ sideBar }: Dropdown) => {
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const onClickRef = useRef<DropdownMenu>(null);

    const { t } = useTranslation(['arix/navigation']);

    const rootAdmin = useStoreState((state: ApplicationStore) => state.user.data!.rootAdmin);

    const onTriggerLogout = () => {
        setIsLoggingOut(true);
        http.post('/auth/logout').finally(() => {
            // @ts-expect-error this is valid
            window.location = '/';
        });
    };

    return (
        <div className='flex w-full justify-between items-center'>
            {sideBar && (
                <Link to='/account' className='flex items-center gap-x-2'>
                    <UserAvatar />
                    <div>
                        <p>{t('account')}</p>
                    </div>
                </Link>
            )}
            <DropdownMenu
                ref={onClickRef}
                sideBar={sideBar ? true : false}
                renderToggle={(onClick) =>
                    sideBar ? (
                        <div onClick={onClick} className='cursor-pointer text-gray-50 p-2'>
                            <DotsVerticalIcon className='w-5' />
                        </div>
                    ) : (
                        <div onClick={onClick} className='cursor-pointer flex gap-x-2 items-center'>
                            <UserAvatar />
                            <div>
                                <p>{t`account`}</p>
                            </div>
                        </div>
                    )
                }
            >
                <SpinnerOverlay visible={isLoggingOut} />
                {rootAdmin && (
                    <>
                        <DropdownLinkRow href='/admin/arix' className='bg-arix !text-white'>
                            <ColorSwatchIcon className='w-5 !text-white' /> Arix Editor
                        </DropdownLinkRow>
                        <DropdownLinkRow href='/admin'>
                            <CogIcon className='w-5' /> {t`admin-area`}
                        </DropdownLinkRow>
                        <DropdownDivider />
                    </>
                )}
                <DropdownLinkRow href='/account'>
                    <UserCircleIcon className='w-5' />{' '}
                    <span className={'whitespace-nowrap'}>{t`account-overview`}</span>
                </DropdownLinkRow>
                <DropdownLinkRow href='/account/activity'>
                    <EyeIcon className='w-5' /> {t`account-activity`}
                </DropdownLinkRow>
                <DropdownDivider />
                <DropdownButtonRow danger onClick={onTriggerLogout}>
                    <LogoutIcon className='w-5' /> {t`logout`}
                </DropdownButtonRow>
            </DropdownMenu>
        </div>
    );
};

export default ClientDropdown;
