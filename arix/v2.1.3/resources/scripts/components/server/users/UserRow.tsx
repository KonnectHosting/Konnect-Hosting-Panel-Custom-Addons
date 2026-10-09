import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Subuser } from '@/state/server/subusers';
import RemoveSubuserButton from '@/components/server/users/RemoveSubuserButton';
import EditSubuserModal from '@/components/server/users/EditSubuserModal';
import UserAvatar from '@/components/UserAvatar';
import Can from '@/components/elements/Can';
import { Button } from '@/components/elements/button/index';
import { useStoreState } from 'easy-peasy';
import { LockOpenIcon, LockClosedIcon } from '@heroicons/react/outline';
import { useTranslation } from 'react-i18next';
import * as locales from 'date-fns/locale';
import { ItemRow, ItemCell } from '@/components/elements/ItemList';

const getLocale = (localeKey: keyof typeof locales) => {
    if (locales[localeKey]) {
        return locales[localeKey];
    } else {
        const keyString = String(localeKey);
        console.warn(`Locale '${keyString}' not found. Falling back to '${locales.enUS}'`);
        return locales.enUS;
    }
};

interface Props {
    subuser: Subuser;
}

export default ({ subuser }: Props) => {
    const { t, i18n } = useTranslation('arix/server/users');
    const currentLang = i18n.language;
    const localeKey = currentLang as keyof typeof locales;
    const uuid = useStoreState((state) => state.user!.data!.uuid);
    const [visible, setVisible] = useState(false);

    return (
        <ItemRow>
            <ItemCell>
                <div className={'flex gap-x-2 items-center font-medium'}>
                    <UserAvatar uuid={subuser.uuid} email={subuser.email} user={subuser.username} />
                    {subuser.username}
                </div>
            </ItemCell>
            <ItemCell className='privacy:blur-sm hover:privacy:blur-none duration-300'>{subuser.email}</ItemCell>
            <ItemCell>
                {formatDistanceToNow(subuser.createdAt, {
                    includeSeconds: true,
                    addSuffix: true,
                    locale: getLocale(localeKey),
                })}
            </ItemCell>
            <ItemCell>
                {subuser.expiresAt ? (
                    <span
                        className={
                            new Date(subuser.expiresAt).getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000
                                ? 'text-amber-500'
                                : ''
                        }
                    >
                        {formatDistanceToNow(subuser.expiresAt, {
                            includeSeconds: true,
                            addSuffix: true,
                            locale: getLocale(localeKey),
                        })}
                    </span>
                ) : (
                    t('N/A')
                )}
            </ItemCell>
            <ItemCell>
                <div
                    className={`w-10 h-10 flex items-center justify-center rounded-component ${
                        !subuser.twoFactorEnabled
                            ? 'text-danger-50 bg-danger-200/40'
                            : 'text-success-50 bg-success-200/40'
                    }`}
                >
                    {!subuser.twoFactorEnabled ? (
                        <LockOpenIcon className={'w-5'} />
                    ) : (
                        <LockClosedIcon className={'w-5'} />
                    )}
                </div>
            </ItemCell>
            <ItemCell className={'w-1'}>
                <EditSubuserModal subuser={subuser} open={visible} onClose={() => setVisible(false)} />
                <div className={'flex justify-end items-centet gap-x-2'}>
                    {subuser.uuid !== uuid && (
                        <>
                            <Can action={'user.update'}>
                                <Button.Text onClick={() => setVisible(true)}>{t('modify-permissions')}</Button.Text>
                            </Can>
                            <Can action={'user.delete'}>
                                <RemoveSubuserButton subuser={subuser} />
                            </Can>
                        </>
                    )}
                </div>
            </ItemCell>
        </ItemRow>
    );
};
