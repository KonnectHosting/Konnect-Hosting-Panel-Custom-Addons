import React from 'react';
import PlatformContainer from '@/components/elements/platform/PlatformContainer';
import { FilterFieldConfig, ResourceConfig } from '@/api/server/platform/types';
import { DocumentAddIcon } from '@heroicons/react/outline';

const RESOURCE = 'plugin';
const INSTALL_DIRECTORY = '/plugins';
const TRANSLATION_NAMESPACE = 'arix/server/addons/plugins';

const LOADER_OPTIONS_BY_SERVICE: Record<string, string[]> = {
    hangar: ['PAPER', 'WATERFALL', 'VELOCITY'],
    modrinth: [
        'paper',
        'spigot',
        'bukkit',
        'folia',
        'purpur',
        'sponge',
        'bungeecord',
        'velocity',
        'waterfall',
        'geyser',
    ],
};

const FILTER_FIELDS: FilterFieldConfig[] = [
    {
        key: 'service',
        label: 'platform',
        type: 'radio',
        toggleable: false,
        resetsOnChange: ['version', 'loader', 'search'],
        // Fetched from the backend per resource type - see getResourceServices.
        options: (_filters, ctx) => ctx.services,
    },
    {
        key: 'version',
        label: 'version',
        type: 'version-tree',
        // Spigot's catalog isn't versioned, so this filter only makes sense
        // once a versioned service is selected.
        visible: (filters) => filters.service !== 'spigot',
    },
    {
        key: 'loader',
        label: 'loader',
        type: 'radio',
        visible: (filters) => filters.service === 'hangar' || filters.service === 'modrinth',
        options: (filters) => LOADER_OPTIONS_BY_SERVICE[filters.service] ?? [],
    },
];

const pluginsConfig: ResourceConfig = {
    resource: RESOURCE,
    installDirectory: INSTALL_DIRECTORY,
    translationNamespace: TRANSLATION_NAMESPACE,
    titleKey: 'plugins',
    filters: FILTER_FIELDS,
};

export default function PluginsContainer() {
    return <PlatformContainer config={pluginsConfig} icon={DocumentAddIcon} />;
}
