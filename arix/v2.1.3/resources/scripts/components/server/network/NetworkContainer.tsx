import React, { useEffect, useState } from 'react';
import Spinner from '@/components/elements/Spinner';
import { useFlashKey } from '@/plugins/useFlash';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import { ServerContext } from '@/state/server';
import AllocationRow from '@/components/server/network/AllocationRow';
import { Button } from '@/components/elements/button/index';
import createServerAllocation from '@/api/server/network/createServerAllocation';
import tw from 'twin.macro';
import Can from '@/components/elements/Can';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import ItemList from '@/components/elements/ItemList';
import getServerAllocations from '@/api/swr/getServerAllocations';
import isEqual from 'react-fast-compare';
import { useDeepCompareEffect } from '@/plugins/useDeepCompareEffect';
import { GlobeIcon } from '@heroicons/react/outline';
import { useTranslation } from 'react-i18next';

const NetworkContainer = () => {
    const { t } = useTranslation('arix/server/network');
    const [loading, setLoading] = useState(false);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const allocationLimit = ServerContext.useStoreState((state) => state.server.data!.featureLimits.allocations);
    const allocations = ServerContext.useStoreState((state) => state.server.data!.allocations, isEqual);
    const setServerFromState = ServerContext.useStoreActions((actions) => actions.server.setServerFromState);

    const { clearFlashes, clearAndAddHttpError } = useFlashKey('server:network');
    const { data, error, mutate } = getServerAllocations();

    useEffect(() => {
        mutate(allocations);
    }, []);

    useEffect(() => {
        clearAndAddHttpError(error);
    }, [error]);

    useDeepCompareEffect(() => {
        if (!data) return;

        setServerFromState((state) => ({ ...state, allocations: data }));
    }, [data]);

    const onCreateAllocation = () => {
        clearFlashes();

        setLoading(true);
        createServerAllocation(uuid)
            .then((allocation) => {
                setServerFromState((s) => ({ ...s, allocations: s.allocations.concat(allocation) }));
                return mutate(data?.concat(allocation), false);
            })
            .catch((error) => clearAndAddHttpError(error))
            .then(() => setLoading(false));
    };

    return (
        <ServerContentBlock showFlashKey={'server:network'} title={t('network')} icon={GlobeIcon}>
            {!data ? (
                <Spinner size={'large'} centered />
            ) : (
                <ItemList
                    title={
                        <div className={'flex lg:flex-row flex-col gap-2 items-start justify-between'}>
                            <div>
                                <p className={'text-medium text-gray-300'}>{t('manage-allocation')}</p>
                                {allocationLimit > 0 && (
                                    <p css={tw`text-sm text-neutral-300 mt-1`}>
                                        {t('currently-using', { current: data.length, max: allocationLimit })}
                                    </p>
                                )}
                            </div>
                            {allocationLimit > 0 && (
                                <Can action={'allocation.create'}>
                                    <SpinnerOverlay visible={loading} />
                                    {allocationLimit > data.length && (
                                        <Button onClick={onCreateAllocation}>{t('create-allocation')}</Button>
                                    )}
                                </Can>
                            )}
                        </div>
                    }
                    headers={
                        <tr>
                            <th>{t('IP')}</th>
                            <th>{t('port')}</th>
                            <th>{t('notes')}</th>
                            <th></th>
                        </tr>
                    }
                >
                    {data.map((allocation) => (
                        <AllocationRow key={`${allocation.ip}:${allocation.port}`} allocation={allocation} />
                    ))}
                </ItemList>
            )}
        </ServerContentBlock>
    );
};

export default NetworkContainer;
