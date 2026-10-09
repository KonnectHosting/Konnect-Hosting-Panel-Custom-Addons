import React from 'react';
import PlatformContainer from '@/components/elements/platform/PlatformContainer';
import { FilterFieldConfig, ResourceConfig } from '@/api/server/platform/types';
import { PuzzleIcon } from '@heroicons/react/outline';

const RESOURCE = 'mods';
const INSTALL_DIRECTORY = '/mods';
const TRANSLATION_NAMESPACE = 'arix/server/addons/mods';

const LOADER_OPTIONS_BY_SERVICE: Record<string, string[]> = {
    curseforge: ['forge', 'fabric', 'neoforge', 'quilt'],
    modrinth: [
        'fabric',
        'forge',
        'neoforge',
        'babric',
        'bta-babric',
        'java-agent',
        'legacy-fabric',
        'liteloader',
        'modloader',
        'ornithe',
        'nilloader',
        'quilt',
        'rift'
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
        visible: (filters) => filters.service === 'curseforge' || filters.service === 'modrinth',
        options: (filters) => LOADER_OPTIONS_BY_SERVICE[filters.service] ?? [],
    },
];

const modsConfig: ResourceConfig = {
    resource: RESOURCE,
    installDirectory: INSTALL_DIRECTORY,
    translationNamespace: TRANSLATION_NAMESPACE,
    titleKey: 'mods',
    filters: FILTER_FIELDS,
};

export default function ModsContainer() {
    return <PlatformContainer config={modsConfig} icon={PuzzleIcon} />;
}