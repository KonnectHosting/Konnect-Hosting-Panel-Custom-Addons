import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from '@/components/elements/dialog';
import { ResourceItem, ResourceVersions, InstalledResourceItem } from '@/api/server/platform/types';
import { getResourceItemVersions, installResourceItem } from '@/api/server/platform/api';
import { useInstalledItems } from '@/components/elements/platform/InstalledItemsContext';
import { ServerContext } from '@/state/server';
import { Button } from '@/components/elements/button/index';
import Select from '@/components/elements/Select';
import Switch from '@/components/elements/Switch';
import getProperties from '@/api/server/properties/getProperties';
import updateProperties from '@/api/server/properties/updateProperties';
import { Actions, useStoreActions } from 'easy-peasy';
import { numify } from 'numify';
import Spinner from '@/components/elements/Spinner';
import { differenceInCalendarMonths, format, formatDistanceToNow } from 'date-fns';
import { ExternalLinkIcon, DownloadIcon, StarIcon, CalendarIcon } from '@heroicons/react/outline';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import { ApplicationStore } from '@/state';
import { useTranslation } from 'react-i18next';
import * as locales from 'date-fns/locale';

const WORLDS_RESOURCE = 'worlds';

const getLocale = (localeKey: keyof typeof locales) => {
    if (locales[localeKey]) {
        return locales[localeKey];
    } else {
        const keyString = String(localeKey);
        console.warn(`Locale '${keyString}' not found. Falling back to '${locales.enUS}'`);
        return locales.enUS;
    }
};

const DialogContent = ({
    item,
    resource,
    service,
    translationNamespace,
    open,
    onClose,
}: {
    item: ResourceItem;
    resource: string;
    service: string;
    translationNamespace: string;
    open: boolean;
    onClose: () => void;
}) => {
    const { t } = useTranslation(translationNamespace);
    const { i18n } = useTranslation();
    const currentLang = i18n.language;
    const localeKey = currentLang as keyof typeof locales;
    const [loading, setLoading] = useState(false);
    const [preloading, setPreloading] = useState(true);
    const [versions, setVersions] = useState<ResourceVersions>();
    const [selectedVersion, setSelectedVersion] = useState<string>();
    const [makeDefaultWorld, setMakeDefaultWorld] = useState(false);
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { clearFlashes, addFlash } = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes);
    const { appendItem } = useInstalledItems();
    const isWorldInstaller = resource === WORLDS_RESOURCE;

    const isMountedRef = useRef(true);
    useEffect(
        () => () => {
            isMountedRef.current = false;
        },
        []
    );

    const onError = (message?: string) => {
        if (isMountedRef.current) {
            onClose();
        }
        addFlash({
            type: 'error',
            key: 'resource-browser',
            message: message ?? t('install.download-not-available'),
        });
    };

    const setAsDefaultWorld = async (fileName: string) => {
        try {
            const properties = await getProperties(uuid, '/server.properties');
            await updateProperties(uuid, '/server.properties', { ...properties, "level-name": fileName });
        } catch {
            addFlash({
                type: 'error',
                key: 'resource-browser',
                message: t('install.set-default-world-failed'),
            });
        }
    };

    const install = async () => {
        if (selectedVersion && versions) {
            setLoading(true);
            installResourceItem({
                id,
                resource,
                service,
                itemId: item.id,
                itemName: item.name,
                itemIcon: item.icon,
                version: selectedVersion,
            })
                .then(async (installed: InstalledResourceItem) => {
                    appendItem(installed);

                    if (isWorldInstaller && makeDefaultWorld) {
                        await setAsDefaultWorld(installed.file_name);
                    }

                    addFlash({
                        type: 'success',
                        key: 'resource-browser',
                        message: t('install.installed-successfully'),
                    });
                    if (isMountedRef.current) {
                        onClose();
                    }
                })
                .catch((error: any) => {
                    if (error?.code === 'ECONNABORTED') {
                        addFlash({
                            type: 'info',
                            key: 'resource-browser',
                            message: t('install.processing-in-background'),
                        });
                        if (isMountedRef.current) {
                            onClose();
                        }
                        return;
                    }

                    onError(error);
                })
                .finally(() => {
                    if (isMountedRef.current) {
                        setLoading(false);
                    }
                });
        } else {
            onError();
        }
    };

    useEffect(() => {
        if (open) {
            clearFlashes('resource-browser');

            getResourceItemVersions({ id, resource, service, itemId: item.id })
                .then((response: ResourceVersions) => {
                    if (!isMountedRef.current) return;
                    setVersions(response);
                    setSelectedVersion(response ? response.versions[0]?.name : '');
                    setPreloading(false);
                })
                .catch((error) => {
                    addFlash({
                        type: 'error',
                        key: 'resource-browser',
                        message: error,
                    });
                });
        }
    }, [id, item, resource, service, open]);

    return (
        <Dialog open={open} onClose={onClose}>
            <div className={'flex flex-col items-start gap-3'}>
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
                        <div className={'flex gap-5 text-gray-400 text-sm'}>
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
                <div className={'flex gap-3'}>
                    <Tooltip content={`${t('downloads')}`} placement={'top'}>
                        <p className={'flex items-center gap-x-1'}>
                            <DownloadIcon className={'w-4 text-arix'} />
                            {numify(item.stats.downloads)}
                        </p>
                    </Tooltip>
                    <Tooltip content={`${t('likes')}`} placement={'top'}>
                        <p className={'flex items-center gap-x-1'}>
                            <StarIcon className={'w-4 text-arix'} />
                            {numify(item.stats.likes)}
                        </p>
                    </Tooltip>
                    <Tooltip content={`${t('last-updated')}`} placement={'top'}>
                        <p className={'flex items-center gap-x-1'}>
                            <CalendarIcon className={'w-4 text-arix'} />
                            {item.stats.lastUpdated
                                ? (() => {
                                      const lastUpdated = new Date(item.stats.lastUpdated);
                                      const monthsDifference = Math.abs(
                                          differenceInCalendarMonths(lastUpdated, new Date())
                                      );
                                      return monthsDifference > 12
                                          ? format(lastUpdated, 'MMM do, yyyy', { locale: getLocale(localeKey) })
                                          : formatDistanceToNow(lastUpdated, {
                                                addSuffix: true,
                                                locale: getLocale(localeKey),
                                            });
                                  })()
                                : 'Unknown'}
                        </p>
                    </Tooltip>
                </div>
                <p>{item.description}</p>
            </div>
            <div>
                <p className={'mb-1 mt-4'}>{t('install.select-a-version')}:</p>
                <div className='relative flex items-center'>
                    {preloading && (
                        <div className='px-4 absolute flex items-center gap-x-2 text-gray-300'>
                            <Spinner size={'small'} /> {t('install.loading-versions')}
                        </div>
                    )}
                    <Select onChange={(e) => setSelectedVersion(e.target.value)}>
                        {versions?.versions?.map((version) => (
                            <option value={version.name} key={version.url}>
                                {version.name}
                            </option>
                        ))}
                    </Select>
                </div>
            </div>
            {isWorldInstaller && (
                <div className={'mt-4'}>
                    <Switch
                        name={'make_default_world'}
                        label={t('install.make-default-world-label')}
                        description={t('install.make-default-world-description')}
                        checked={makeDefaultWorld}
                        onChange={() => setMakeDefaultWorld((v) => !v)}
                    />
                </div>
            )}
            <Dialog.Footer>
                <Button.Text onClick={onClose}>Cancel</Button.Text>
                <Button
                    disabled={!selectedVersion || loading}
                    onClick={install}
                    className={'flex items-center gap-x-2'}
                >
                    {loading && <Spinner size={'small'} />}
                    {t('install.install')}
                </Button>
            </Dialog.Footer>
        </Dialog>
    );
};

export default function InstallResourceButton({
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
    const [open, setOpen] = useState(false);

    return (
        <div>
            <DialogContent
                item={item}
                resource={resource}
                service={service}
                translationNamespace={translationNamespace}
                open={open}
                onClose={() => setOpen(false)}
            />

            <Button onClick={() => setOpen(true)}>{t('install.select-version')}</Button>
        </div>
    );
}