import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ActivityLog } from '@definitions/user';
import ActivityLogMetaButton from '@/components/elements/activity/ActivityLogMetaButton';
import { FolderOpenIcon, TerminalIcon } from '@heroicons/react/solid';
import UserAvatar from '@/components/UserAvatar';
import useLocationHash from '@/plugins/useLocationHash';
import { getObjectKeys, isObject } from '@/lib/objects';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
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
    activity: ActivityLog;
    children?: React.ReactNode;
}

function wrapProperties(value: unknown): any {
    if (value === null || typeof value === 'string' || typeof value === 'number') {
        return `<strong>${String(value)}</strong>`;
    }

    if (isObject(value)) {
        return getObjectKeys(value).reduce((obj, key) => {
            if (key === 'count' || (typeof key === 'string' && key.endsWith('_count'))) {
                return { ...obj, [key]: value[key] };
            }
            return { ...obj, [key]: wrapProperties(value[key]) };
        }, {} as Record<string, unknown>);
    }

    if (Array.isArray(value)) {
        return value.map(wrapProperties);
    }

    return value;
}

export default ({ activity, children }: Props) => {
    const { i18n } = useTranslation();
    const currentLang = i18n.language;
    const localeKey = currentLang as keyof typeof locales;

    const { pathTo } = useLocationHash();
    const actor = activity.relationships.actor;
    const properties = wrapProperties(activity.properties);
    const [countryCode, setCountryCode] = useState<string | null>(null);

    const ipFlag = useStoreState((state: ApplicationStore) => state.settings.data!.arix.advanced.ipFlag);

    // 1a650079277776d7b60f9b92bd883c63

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(`https://api.country.is/${activity.ip}`);
                const data = await response.json();
                if (data.country) {
                    // Transform the country code to lowercase
                    setCountryCode(data.country.toLowerCase());
                }
            } catch (error) {
                console.error('Error fetching country data:', error);
            }
        };

        if (activity.ip && ipFlag) {
            fetchData();
        }
    }, [activity.ip]);

    const countryLogo = countryCode ? countryCode : 'us';

    return (
        <ItemRow className='my-4 p-4'>
            <ItemCell>
                <div className='flex items-center gap-x-2 font-medium text-gray-50'>
                    {activity.isApi && (
                        <Tooltip placement={'top'} content={'Using API Key'}>
                            <TerminalIcon className='w-6' />
                        </Tooltip>
                    )}
                    {activity.event.startsWith('server:sftp.') && (
                        <Tooltip placement={'top'} content={'Using SFTP'}>
                            <FolderOpenIcon className='w-6' />
                        </Tooltip>
                    )}
                    {actor?.uuid && actor?.email && actor?.username ? (
                        <UserAvatar uuid={actor?.uuid} email={actor?.email} user={actor?.username} width={'28px'} />
                    ) : (
                        children
                    )}
                    <Link
                        to={`#${pathTo({ user: actor?.uuid || 'System' })}`}
                        className={'duration-75 text-gray-200 text-sm hover:text-gray-50'}
                    >
                        {actor?.username || 'System'}
                    </Link>
                </div>
            </ItemCell>
            <ItemCell>
                <Link
                    to={`#${pathTo({ event: activity.event })}`}
                    className={'duration-75 text-gray-200 text-sm hover:text-gray-50'}
                >
                    {activity.event}
                </Link>
            </ItemCell>
            <ItemCell>
                {activity.ip && (
                    <Link
                        to={`#${pathTo({ ip: activity.ip })}`}
                        className={'group flex items-center hover:text-gray-50'}
                    >
                        {ipFlag && (
                            <img
                                src={`https://cdn.jsdelivr.net/gh/hampusborgos/country-flags@main/svg/${countryLogo}.svg`}
                                className={'w-6 rounded-sm'}
                            />
                        )}
                        <span
                            className={'filter privacy:blur-sm hover:privacy:blur-none select-none duration-300 px-2'}
                        >
                            {activity.ip}
                        </span>
                    </Link>
                )}
            </ItemCell>
            <ItemCell>
                <Tooltip content={format(activity.timestamp, 'MMM do, yyyy H:mm:ss', { locale: getLocale(localeKey) })}>
                    <span>
                        {formatDistanceToNowStrict(activity.timestamp, {
                            addSuffix: true,
                            locale: getLocale(localeKey),
                        })}
                    </span>
                </Tooltip>
            </ItemCell>
            <ItemCell className='text-end'>
                {activity.hasAdditionalMetadata && <ActivityLogMetaButton meta={activity.properties} />}
            </ItemCell>
        </ItemRow>
    );
};
