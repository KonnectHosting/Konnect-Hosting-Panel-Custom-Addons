import FlashMessageRender from '@/components/FlashMessageRender';
import React, { useState } from 'react';
import UpdatePasswordForm from './forms/UpdatePasswordForm';
import ConfigureTwoFactorForm from './forms/ConfigureTwoFactorForm';
import { useLocation } from 'react-router-dom';
import MessageBox from '@/components/MessageBox';
import PageContentBlock from '@/components/elements/PageContentBlock';
import { useSessionHistory } from '@/api/account/sessions';
import Spinner from '@/components/elements/Spinner';
import { format } from 'date-fns';
import ItemList, { ItemRow, ItemCell } from '@/components/elements/ItemList';
import PaginationFooter from '@/components/elements/table/PaginationFooter';
import { UAParser } from 'ua-parser-js';
import { DesktopComputerIcon, DeviceMobileIcon, InformationCircleIcon } from '@heroicons/react/outline';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import { useTranslation } from 'react-i18next';

export default function AccountSecurityContainer() {
    const { state } = useLocation<undefined | { twoFactorRedirect?: boolean }>();
    const [page, setPage] = useState(1);
    const { data: sessions, isValidating } = useSessionHistory(page, { revalidateOnFocus: false });
    const { t } = useTranslation('arix/account');

    const parser = new UAParser();

    return (
        <PageContentBlock title={'Account Security'} className='space-y-4'>
            {state?.twoFactorRedirect && (
                <div>
                    <MessageBox title={'2-Factor Required'} type={'error'}>
                        {t('twofactor-messagebox')}
                    </MessageBox>
                    <ConfigureTwoFactorForm />
                </div>
            )}
            <FlashMessageRender byKey={'account:password'} />
            <UpdatePasswordForm />
            <ConfigureTwoFactorForm />
            <ItemList
                title={
                    <div className={'flex items-center justify-between'}>
                        <p className={'text-medium text-gray-300'}>{t('sessionHistory.title')}</p>
                    </div>
                }
                headers={
                    <tr>
                        <th>OS</th>
                        <th>Browser</th>
                        <th>{t('sessionHistory.ip-address')}</th>
                        <th>{t('sessionHistory.logged-in')}</th>
                    </tr>
                }
                footer={
                    sessions && <PaginationFooter pagination={sessions.pagination} onPageSelect={(p) => setPage(p)} />
                }
            >
                {!sessions && isValidating ? (
                    <ItemRow>
                        <ItemCell colSpan={4}>
                            <Spinner centered />
                        </ItemCell>
                    </ItemRow>
                ) : !sessions || sessions.items.length === 0 ? (
                    <ItemRow>
                        <ItemCell colSpan={4} className={'text-center text-sm text-gray-400'}>
                            {t('sessionHistory.no-sessions')}
                        </ItemCell>
                    </ItemRow>
                ) : (
                    sessions.items.map((entry) => {
                        const ua = String(entry.properties?.useragent ?? '');
                        return (
                            <ItemRow key={entry.id}>
                                <ItemCell className={'flex items-center gap-x-1'}>
                                    {parser.setUA(ua).getDevice().type === 'mobile' ? (
                                        <DeviceMobileIcon className={'w-4 h-4'} />
                                    ) : (
                                        <DesktopComputerIcon className={'w-4 h-4'} />
                                    )}
                                    {parser.setUA(ua).getOS().name}
                                </ItemCell>
                                <ItemCell>
                                    <div className='flex items-center gap-x-2'>
                                        {parser.getBrowser().name} {parser.getBrowser().version}
                                        <Tooltip content={`${ua}`}>
                                            <InformationCircleIcon className='w-4 text-gray-300' />
                                        </Tooltip>
                                    </div>
                                </ItemCell>
                                <ItemCell>
                                    <span className='privacy:blur-sm hover:privacy:blur-none duration-300'>
                                        {entry.ip ?? '—'}
                                    </span>
                                </ItemCell>
                                <ItemCell>{format(entry.timestamp, 'MMM d, yyyy HH:mm')}</ItemCell>
                            </ItemRow>
                        );
                    })
                )}
            </ItemList>
        </PageContentBlock>
    );
}
