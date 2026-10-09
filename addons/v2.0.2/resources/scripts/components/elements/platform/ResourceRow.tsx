import React from 'react';
import { numify } from 'numify';
import { ResourceItem } from '@/api/server/platform/types';
import { differenceInCalendarMonths, format, formatDistanceToNow } from 'date-fns';
import { ExternalLinkIcon, DownloadIcon, StarIcon, CalendarIcon } from '@heroicons/react/outline';
import { useInstalledItems } from '@/components/elements/platform/InstalledItemsContext';
import GreyRowBox from '@/components/elements/GreyRowBox';
import Can from '@/components/elements/Can';
import InstallResourceButton from '@/components/elements/platform/InstallResourceButton';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import { useTranslation } from 'react-i18next';
import * as locales from 'date-fns/locale';

const getLocale = (localeKey: keyof typeof locales) => {
    if (locales[localeKey]) {
        return locales[localeKey];
    } else {
        const keyString = String(localeKey);
        console.warn(`Locale '${keyString}' not found. Falling back to '${locales.enUS}'`);
        return locales.enUS;
    }
};

export default function ResourceRow({
    item,
    resource,
    service,
    translationNamespace,
}: {
    item: ResourceItem;
    resource: string;
    service: string;
    translationNamespace: string;
}) {
    const { t } = useTranslation(translationNamespace);
    const { i18n } = useTranslation();
    const currentLang = i18n.language;
    const localeKey = currentLang as keyof typeof locales;
    const { items: installedItems } = useInstalledItems();
    const isInstalled = installedItems.find(
        (installed) => installed.plugin_service_id === item.id && installed.plugin_service === service
    );

    return (
        <GreyRowBox key={item.id} className={'flex-col !items-start gap-3'} $hoverable={false}>
            <div className={'flex items-center gap-x-5'}>
                <div className={'p-1 bg-gray-600 rounded-lg overflow-hidden'}>
                    <img
                        src={item.icon === 'https://www.spigotmc.org/' ? '/arix/Arix.png' : item.icon}
                        width={64}
                        height={64}
                        alt={`${item.name.slice(0, 5)} Icon`}
                        className={'shrink-0'}
                    />
                </div>
                <div>
                    <p className={'text-xl font-medium text-gray-50 flex items-center gap-x-2'}>
                        {item.name}
                        <a href={item.project.projectUrl} target={'_blank'} rel={'noreferrer'}>
                            <ExternalLinkIcon className={'w-6'} />
                        </a>
                    </p>
                    <div className={'text-gray-400 text-sm'}>
                        <p>
                            {t('by')}&nbsp;
                            <a
                                href={item.project.authorUrl}
                                target={'_blank'}
                                rel={'noreferrer'}
                                className={'underline'}
                            >
                                {item.project.author}
                            </a>
                        </p>
                    </div>
                </div>
            </div>
            <p className='line-clamp-2'>{item.description}</p>
            <p className={'flex items-center gap-x-1'}>
                <CalendarIcon className={'w-4 text-arix'} />
                {t('last-updated')}&nbsp;
                {item.stats.lastUpdated
                    ? (() => {
                          const lastUpdated = new Date(item.stats.lastUpdated);
                          const monthsDifference = Math.abs(differenceInCalendarMonths(lastUpdated, new Date()));
                          return monthsDifference > 12
                              ? format(lastUpdated, 'MMM do, yyyy', { locale: getLocale(localeKey) })
                              : formatDistanceToNow(lastUpdated, { addSuffix: true, locale: getLocale(localeKey) });
                      })()
                    : 'Unknown'}
            </p>
            <div className={'mt-auto w-full flex items-center justify-between gap-2 flex-wrap'}>
                <div className={'flex items-center gap-x-3'}>
                    <Tooltip content={`${t('downloads')}`} placement={'top'}>
                        <p className={'flex items-center gap-x-1'}>
                            <DownloadIcon className={'w-4 text-gray-300'} />
                            {numify(item.stats.downloads)}
                        </p>
                    </Tooltip>
                    {item.stats.likes > 0 && (
                        <Tooltip content={`${t('likes')}`} placement={'top'}>
                            <p className={'flex items-center gap-x-1'}>
                                <StarIcon className={'w-4 text-gray-300'} />
                                {numify(item.stats.likes)}
                            </p>
                        </Tooltip>
                    )}
                </div>
                {!isInstalled ? (
                    <Can action={'file.create'}>
                        <InstallResourceButton
                            item={item}
                            resource={resource}
                            service={service}
                            translationNamespace={translationNamespace}
                        />
                    </Can>
                ) : (
                    <span
                        className={
                            'rounded-component px-2 py-1 text-sm inline-block font-medium bg-success-200 text-success-50'
                        }
                    >
                        {t('item-installed')}
                    </span>
                )}
            </div>
        </GreyRowBox>
    );
}
