import React, { useEffect, useMemo, useState } from 'react';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import { PuzzleIcon, SearchIcon, XIcon } from '@heroicons/react/outline';
import { useTranslation } from 'react-i18next';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import Input from '@/components/elements/Input';
import PaginationFooter from '@/components/elements/table/PaginationFooter';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import FlashMessageRender from '@/components/FlashMessageRender';
import useFlash from '@/plugins/useFlash';
import { ServerContext } from '@/state/server';
import { PaginatedResult } from '@/api/http';
import { getResourceFilters, getResourceItems, getResourceServices } from '@/api/server/platform/api';
import { FilterContext, FilterState, ResourceConfig, ResourceItem } from '@/api/server/platform/types';
import { InstalledItemsProvider, useInstalledItems } from '@/components/elements/platform/InstalledItemsContext';
import FilterPanel from '@/components/elements/platform/FilterPanel';
import ResourceRow from '@/components/elements/platform/ResourceRow';
import InstalledResourceRow from '@/components/elements/platform/InstalledResourceRow';

function defaultFilters(config: ResourceConfig, defaultService = ''): FilterState {
    return {
        search: '',
        ...Object.fromEntries(config.filters.map((field) => [field.key, ''])),
        service: defaultService,
    };
}

const PRIORITY_SERVICES = ['modrinth', 'curseforge'];

function orderServices(services: string[]): string[] {
    const prioritized = PRIORITY_SERVICES.filter((service) => services.includes(service));
    const rest = services.filter((service) => !PRIORITY_SERVICES.includes(service));
    return [...prioritized, ...rest];
}

function groupVersions(versions: string[]): Record<string, string[]> {
    return versions.reduce((acc: Record<string, string[]>, version) => {
        if (version.split('.').length < 3) {
            return acc;
        }

        const [major, minor] = version.split('.');
        const key = `${major}.${minor}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(version);

        return acc;
    }, {});
}

function PlatformBrowser({
    config,
    icon,
}: {
    config: ResourceConfig;
    icon?: React.ComponentType<{ className?: string }>;
}) {
    const { t } = useTranslation(config.translationNamespace);
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const { addError, clearFlashes } = useFlash();
    const { items: installedItems, loading: installedLoading } = useInstalledItems();

    const [browse, setBrowse] = useState(true);
    const [openFilters, setOpenFilters] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<FilterState>(() => defaultFilters(config));
    const [services, setServices] = useState<string[]>([]);
    const [versionGroups, setVersionGroups] = useState<Record<string, string[]>>({});
    const [items, setItems] = useState<PaginatedResult<ResourceItem>>();

    const ctx: FilterContext = useMemo(() => ({ services, versionGroups }), [services, versionGroups]);

    const updateFilter = (key: string, value: string) => {
        const field = config.filters.find((f) => f.key === key);
        const resetKeys = field?.resetsOnChange ?? [];
        setPage(1);
        
        if (resetKeys.includes('search')) {
            setSearchTerm('');
        }
        setFilters((prev) => {
            const next: FilterState = { ...prev };
            resetKeys.forEach((resetKey) => {
                next[resetKey] = '';
            });
            next[key] = field?.toggleable === false ? value : prev[key] === value ? '' : value;
            return next;
        });
    };

    const clearSearch = () => {
        setSearchTerm('');
        setFilters((prev) => (prev.search ? { ...prev, search: '' } : prev));
    };

    const toggleBrowse = (value: boolean) => {
        setBrowse(value);
        clearSearch();
    };

    const resetFilters = () => {
        setSearchTerm('');
        setPage(1);
        setFilters(defaultFilters(config, services[0] ?? ''));
    };

    useEffect(() => {
        setFilters(defaultFilters(config));
        setSearchTerm('');
        setPage(1);
        setServices([]);
        setVersionGroups({});
        setItems(undefined);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config.resource]);

    useEffect(() => {
        clearFlashes('resource-browser');

        getResourceServices({ id, resource: config.resource })
            .then((response) => setServices(orderServices(response)))
            .catch((error) => addError({ key: 'resource-browser', message: error.message }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, config.resource]);

    useEffect(() => {
        if (services.length === 0) return;

        setFilters((prev) => (prev.service ? prev : { ...prev, service: services[0] }));
    }, [services]);

    useEffect(() => {
        clearFlashes('resource-browser');

        getResourceFilters({ id, resource: config.resource })
            .then((response) => setVersionGroups(groupVersions(response)))
            .catch((error) => addError({ key: 'resource-browser', message: error.message }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, config.resource]);

    useEffect(() => {
        if (searchTerm === filters.search) return;
        const handler = setTimeout(() => {
            updateFilter('search', searchTerm);
        }, 1000);

        return () => clearTimeout(handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm]);

    useEffect(() => {
        const { service, ...restFilters } = filters;
        if (!service) return;

        setLoading(true);
        clearFlashes('resource-browser');

        getResourceItems({ id, resource: config.resource, service, page, ...restFilters })
            .then(setItems)
            .catch((error) => addError({ key: 'resource-browser', message: error.message }))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, config.resource, filters, page]);

    return (
        <ServerContentBlock title={t(config.titleKey)} icon={icon}>
            <SpinnerOverlay visible={loading || installedLoading} fixed size={'large'} />
            <FlashMessageRender byKey={'resource-browser'} />
            <div className={'flex flex-wrap gap-8 border-b border-gray-600'}>
                <button
                    className={`flex items-center gap-x-2 py-2 border-b ${
                        browse ? 'border-arix text-gray-100' : 'border-transparent'
                    }`}
                    onClick={() => toggleBrowse(true)}
                >
                    <SearchIcon className={'h-5 w-5'} />
                    {t('browse')}
                </button>
                <button
                    className={`flex items-center gap-x-2 py-2 border-b ${
                        !browse ? 'border-arix text-gray-100' : 'border-transparent'
                    }`}
                    onClick={() => toggleBrowse(false)}
                >
                    <PuzzleIcon className={'h-5 w-5'} />
                    {t('installed')} 
                    {installedItems?.length > 0 && (
                        <span className={'px-2 py-1 rounded bg-gray-600 text-xs font-medium'}>{installedItems.length}</span>
                    )}
                </button>
            </div>

            {browse ? (
                <div className={'mt-4'}>
                    {config.filters.length > 0 && (
                        <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
                            <div
                                className={`pointer-events-auto absolute h-screen w-full max-w-sm top-0 p-4 transition-transform duration-300 ${
                                    !openFilters ? 'translate-x-full' : 'translate-x-0'
                                } right-0`}
                            >
                                <div className="h-full flex flex-col gap-5 overflow-y-auto bg-gray-700 boxBorder px-6 py-5 rounded-component">
                                    <div className='flex items-center'>
                                        <p className='text-lg font-medium mr-auto'>
                                            {t('filters')}
                                        </p>
                                        {Object.keys(filters).some((key) => filters[key] !== defaultFilters(config, services[0] ?? '')[key]) && (
                                            <button
                                                onClick={resetFilters}
                                                className='text-sm underline mr-2'
                                            >
                                                ({t('reset-filters')})
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setOpenFilters(false)}
                                            className='w-8 h-8 flex items-center justify-center bg-secondary-200 rounded-component hover:bg-secondary-100 duration-300'
                                        >
                                            <XIcon className={'w-5'} />
                                        </button>
                                    </div>
                                    <FilterPanel
                                        fields={config.filters}
                                        filters={filters}
                                        ctx={ctx}
                                        updateFilter={updateFilter}
                                        translationNamespace={config.translationNamespace}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    <div>
                        <div className='flex items-center gap-x-2 mb-4'>
                            <Input
                                name='search'
                                type='text'
                                placeholder={t('search-for-a')}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            
                            {config.filters.length > 0 && (
                                <button
                                    className={'px-4 py-2 underline font-medium text-lg'}
                                    onClick={() => setOpenFilters(!openFilters)}
                                >
                                    {t('filters')}
                                </button>
                            )}
                        </div>
                        <div className={'grid lg:grid-cols-3 gap-4'}>
                            {(items?.items?.length ?? 0) > 0 ? (
                                items?.items?.map((item) => (
                                    <ResourceRow
                                        key={item.id}
                                        item={item}
                                        resource={config.resource}
                                        service={filters.service}
                                        translationNamespace={config.translationNamespace}
                                    />
                                ))
                            ) : (
                                <div className={'lg:col-span-2'}>{t('no-found')}</div>
                            )}
                        </div>
                        {items && <PaginationFooter pagination={items.pagination} onPageSelect={setPage} />}
                    </div>
                </div>
            ) : (
                <div className={'mt-4 grid lg:grid-cols-3 gap-4'}>
                    <div className={'lg:col-span-3'}>
                        <Input
                            name='search'
                            type='text'
                            placeholder={t('search-for-a')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {installedItems
                        .filter((item) =>
                            item.plugin_name
                                .toLowerCase()
                                .replace(/-/g, ' ')
                                .includes(searchTerm.toLowerCase().replace(/-/g, ' '))
                        )
                        .map((item) => (
                            <InstalledResourceRow
                                key={item.id ?? item.file_name}
                                item={item}
                                resource={config.resource}
                                installDirectory={config.installDirectory}
                            />
                        ))}
                </div>
            )}
        </ServerContentBlock>
    );
}

export default function PlatformContainer({
    config,
    icon,
}: {
    config: ResourceConfig;
    icon?: React.ComponentType<{ className?: string }>;
}) {
    const id = ServerContext.useStoreState((state) => state.server.data!.id);

    return (
        <InstalledItemsProvider id={id} resource={config.resource}>
            <PlatformBrowser config={config} icon={icon} />
        </InstalledItemsProvider>
    );
}
