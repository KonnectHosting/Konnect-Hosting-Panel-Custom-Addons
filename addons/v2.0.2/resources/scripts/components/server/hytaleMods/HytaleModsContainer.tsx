import React from 'react';
import PlatformContainer from '@/components/elements/platform/PlatformContainer';
import { ResourceConfig } from '@/api/server/platform/types';
import { BeakerIcon } from '@heroicons/react/outline';

const RESOURCE = 'hytale/mods';
const INSTALL_DIRECTORY = '/mods';
const TRANSLATION_NAMESPACE = 'arix/server/addons/hytalemods';

const hytaleModsConfig: ResourceConfig = {
    resource: RESOURCE,
    installDirectory: INSTALL_DIRECTORY,
    translationNamespace: TRANSLATION_NAMESPACE,
    titleKey: 'hytale-mods',
    filters: [],
};

export default function HytaleModsContainer() {
    return <PlatformContainer config={hytaleModsConfig} icon={BeakerIcon} />;
}
