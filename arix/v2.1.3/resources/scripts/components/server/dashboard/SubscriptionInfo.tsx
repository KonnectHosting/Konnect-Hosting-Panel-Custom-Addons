import React, { useEffect, useState } from 'react';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import getSubscriptionInfo, { SubscriptionInfo } from '@/api/server/getSubscriptionInfo';
import { ServerContext } from '@/state/server';
import Spinner from '@/components/elements/Spinner';
import * as locales from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNowStrict } from 'date-fns';
import classNames from 'classnames';
import { styles } from '@/components/elements/button/index';
import { ExclamationIcon } from '@heroicons/react/outline';

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
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const [loading, setLoading] = useState(true);

    const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);

    useEffect(() => {
        getSubscriptionInfo(uuid)
            .then((resp) => setSubscriptionInfo(resp))
            .catch((error) => {
                console.error(error);
            })
            .then(() => setLoading(false));
    }, []);

    return (
        <TitledGreyBox title={'Subscription Information'} className='pt-[1px]'>
            {loading ? (
                <Spinner />
            ) : subscriptionInfo ? (
                <SubscriptionInfoDisplay subscriptionInfo={subscriptionInfo} />
            ) : (
                <p>No subscription information available for this server.</p>
            )}
        </TitledGreyBox>
    );
};

type SubscriptionInfoDisplayProps = {
    subscriptionInfo: SubscriptionInfo;
};

const SubscriptionInfoDisplay = ({ subscriptionInfo }: SubscriptionInfoDisplayProps) => {
    const { i18n } = useTranslation();
    const currentLang = i18n.language;
    const localeKey = currentLang as keyof typeof locales;

    return (
        <>
            {subscriptionInfo?.invoice.pending && (
                <div
                    className={
                        'bg-yellow-500/25 rounded-component !border-yellow-500 p-4 mb-4 flex gap-x-4 items-center'
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
            )}
            <div className='divide-y-2 divide-gray-600'>
                <div className={'grid grid-cols-2 pb-4'}>
                    <span className={'text-gray-300'}>Status:</span>
                    <span className='capitalize'>{subscriptionInfo.status}</span>
                </div>
                {subscriptionInfo?.expires_at && (
                    <div className={'grid grid-cols-2 py-4'}>
                        <span className={'text-gray-300'}>Expires:</span>
                        <span>
                            {formatDistanceToNowStrict(new Date(subscriptionInfo.expires_at), {
                                addSuffix: true,
                                locale: getLocale(localeKey),
                            })}
                        </span>
                    </div>
                )}
                {subscriptionInfo?.product && (
                    <div className={'grid grid-cols-2 py-4'}>
                        <span className={'text-gray-300'}>Plan:</span>
                        <span>{subscriptionInfo.product}</span>
                    </div>
                )}
                {subscriptionInfo?.price && (
                    <div className={'grid grid-cols-2 py-4'}>
                        <span className={'text-gray-300'}>Price:</span>
                        <span>
                            {subscriptionInfo.price.amount == '0.00' || subscriptionInfo.price.amount == '0,00' ? (
                                'Free'
                            ) : (
                                <>
                                    {subscriptionInfo.price.amount} {subscriptionInfo.price?.currency}
                                </>
                            )}
                        </span>
                    </div>
                )}
                <div className='grid grid-cols-2 pt-4 items-center'>
                    <span className={'text-gray-300'}>Service Link:</span>
                    <a
                        href={subscriptionInfo?.serviceLink}
                        target={'_blank'}
                        rel={'noreferrer'}
                        className={classNames(styles.button, styles.text)}
                    >
                        View Service
                    </a>
                </div>
            </div>
        </>
    );
};
