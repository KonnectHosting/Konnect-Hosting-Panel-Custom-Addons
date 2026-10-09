import React from 'react';
import { InstalledResourceItem } from '@/api/server/platform/types';
import GreyRowBox from '@/components/elements/GreyRowBox';
import DeleteResourceButton from '@/components/elements/platform/DeleteResourceButton';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';

export default function InstalledResourceRow({
    item,
    resource,
    installDirectory,
}: {
    item: InstalledResourceItem;
    resource: string;
    installDirectory: string;
}) {
    const logo = useStoreState(
        (state: ApplicationStore) => state.settings.data!.arix.general.logo
    );

    return (
        <GreyRowBox key={item.id} className={'items-center gap-3 flex-wrap'} $hoverable={false}>
            {item.plugin_icon !== 'local' ? (
                <img
                    src={item.plugin_icon === 'https://www.spigotmc.org/' ? logo : item.plugin_icon}
                    width={64}
                    height={64}
                    alt={`${item.plugin_name.slice(0, 5)} Icon`}
                    className={'shrink-0'}
                />
            ) : (
                <img
                    src={logo}
                    width={64}
                    height={64}
                    alt={`${item.plugin_name.slice(0, 5)} Icon`}
                    className={'shrink-0'}
                />
            )}
            <div>
                <p className={'text-lg font-medium line-clamp-1'}>{item.plugin_name}</p>
                <p className={'text-sm text-gray-300'}>{item.plugin_version}</p>
            </div>

            <DeleteResourceButton
                resource={resource}
                installDirectory={installDirectory}
                itemId={item.id}
                fileName={item.file_name}
                managedPaths={item.managed_paths}
            />
        </GreyRowBox>
    );
}