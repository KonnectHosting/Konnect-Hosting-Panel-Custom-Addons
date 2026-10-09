import getSubscriptionInfo, { SubscriptionInfo } from '@/api/server/getSubscriptionInfo';
import { ServerContext } from '@/state/server';
import { ExclamationIcon } from '@heroicons/react/outline';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as locales from 'date-fns/locale';
import { formatDistanceToNowStrict } from 'date-fns';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';

const getLocale = (localeKey: keyof typeof locales) => {
    if (locales[localeKey]) {
        return locales[localeKey];
    } else {
        const keyString = String(localeKey);
        console.warn(`Locale '${keyString}' not found. Falling back to '${locales.enUS}'`);
        return locales.enUS;
    }
};

export default () => {
    const { i18n } = useTranslation();
    const currentLang = i18n.language;
    const localeKey = currentLang as keyof typeof locales;
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const subscriptionAlert = useStoreState(
        (state: ApplicationStore) => state.settings.data!.arix.advanced.subscriptionAlert
    );

    const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);

    useEffect(() => {
        if (subscriptionAlert) {
            getSubscriptionInfo(uuid)
                .then((resp) => setSubscriptionInfo(resp))
                .catch((error) => {
                    console.error(error);
                });
        }
    }, []);

    return subscriptionInfo?.invoice.pending && subscriptionAlert ? (
        <div className='px-4'>
            <div
                className={
                    'mx-auto w-full max-w-[1200px] mt-4 bg-yellow-500/25 rounded-component !border-yellow-500 p-4 mb-4 flex gap-4 items-center flex-wrap'
                }
                style={{ borderLeft: 'var(--radiusInput) solid' }}
            >
                <div>
                    <ExclamationIcon className={'w-6 h-6 text-yellow-500'} />
                </div>
                <div>
                    <p className={'font-medium text-yellow-50'}>Invoice #{subscriptionInfo.invoice.id}</p>
                    <div className='text-sm flex items-center gap-x-2'>
                        {subscriptionInfo.invoice.due_at && (
                            <p className='text-yellow-50'>
                                is due{' '}
                                {formatDistanceToNowStrict(new Date(subscriptionInfo.invoice.due_at), {
                                    addSuffix: true,
                                    locale: getLocale(localeKey),
                                })}
                            </p>
                        )}
                        <span>•</span>
                        {subscriptionInfo.invoice.amount && (
                            <p className='text-yellow-50'>
                                {subscriptionInfo.invoice.amount} {subscriptionInfo?.price?.currency}
                            </p>
                        )}
                    </div>
                </div>
                <a
                    href={subscriptionInfo.invoice.link}
                    target={'_blank'}
                    rel={'noreferrer'}
                    className='ml-auto rounded-full border border-white/40 text-yellow-50 px-4 py-2 hover:bg-white/20 duration-300'
                >
                    View Invoice
                </a>
            </div>
        </div>
    ) : null;
};
