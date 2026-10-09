import React from 'react';
import PlatformContainer from '@/components/elements/platform/PlatformContainer';
import { ResourceConfig } from '@/api/server/platform/types';
import { MapIcon } from '@heroicons/react/outline';

const RESOURCE = 'worlds';
const INSTALL_DIRECTORY = '/worlds';
const TRANSLATION_NAMESPACE = 'arix/server/addons/worlds';

const modsConfig: ResourceConfig = {
    resource: RESOURCE,
    installDirectory: INSTALL_DIRECTORY,
    translationNamespace: TRANSLATION_NAMESPACE,
    titleKey: 'worlds',
    filters: []
};

export default function WorldsContainer() {
    return <PlatformContainer config={modsConfig} icon={MapIcon} />;
}
