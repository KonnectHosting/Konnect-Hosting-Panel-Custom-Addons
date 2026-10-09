import React, { useEffect, useState } from 'react';
import getServerDatabases from '@/api/server/databases/getServerDatabases';
import { ServerContext } from '@/state/server';
import { httpErrorToHuman } from '@/api/http';
import FlashMessageRender from '@/components/FlashMessageRender';
import DatabaseRow from '@/components/server/databases/DatabaseRow';
import Spinner from '@/components/elements/Spinner';
import CreateDatabaseButton from '@/components/server/databases/CreateDatabaseButton';
import Can from '@/components/elements/Can';
import useFlash from '@/plugins/useFlash';
import tw from 'twin.macro';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import { useDeepMemoize } from '@/plugins/useDeepMemoize';
import { DatabaseIcon } from '@heroicons/react/outline';
import { useTranslation } from 'react-i18next';
import ItemList, { ItemCell, ItemRow } from '@/components/elements/ItemList';

export default () => {
    const { t } = useTranslation('arix/server/databases');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const databaseLimit = ServerContext.useStoreState((state) => state.server.data!.featureLimits.databases);

    const { addError, clearFlashes } = useFlash();
    const [loading, setLoading] = useState(true);

    const databases = useDeepMemoize(ServerContext.useStoreState((state) => state.databases.data));
    const setDatabases = ServerContext.useStoreActions((state) => state.databases.setDatabases);

    useEffect(() => {
        setLoading(!databases.length);
        clearFlashes('databases');

        getServerDatabases(uuid)
            .then((databases) => setDatabases(databases))
            .catch((error) => {
                console.error(error);
                addError({ key: 'databases', message: httpErrorToHuman(error) });
            })
            .then(() => setLoading(false));
    }, []);

    return (
        <ServerContentBlock title={t('databases')} icon={DatabaseIcon}>
            <FlashMessageRender byKey={'databases'} css={tw`mb-4`} />

            {!databases.length && loading ? (
                <Spinner size={'large'} centered />
            ) : (
                <ItemList
                    title={
                        <div className={'flex lg:flex-row flex-col gap-2 items-start justify-between'}>
                            <div>
                                <p className={'text-medium text-gray-300'}>{t('manage-databases')}</p>
                                {databaseLimit > 0 && databases.length > 0 && (
                                    <p css={tw`text-sm text-neutral-300 mt-1`}>
                                        {t('have-been-allocated', { current: databases.length, max: databaseLimit })}
                                    </p>
                                )}
                            </div>
                            <Can action={'database.create'}>
                                {databaseLimit > 0 && databaseLimit !== databases.length && (
                                    <CreateDatabaseButton />
                                )}
                            </Can>
                        </div>
                    }
                    headers={
                        <tr>
                            <th>{t('name')}</th>
                            <th>{t('username')}</th>
                            <th>{t('endpoint')}</th>
                            <th></th>
                        </tr>
                    }
                >
                    {databases.length > 0 ? (
                        databases.map((database, index) => (
                            <DatabaseRow
                                key={database.id}
                                database={database}
                                className={index > 0 ? 'mt-1' : undefined}
                            />
                        ))
                    ) : (
                        <ItemRow>
                            <ItemCell colSpan={5} className={`text-center text-sm`}>
                                {databaseLimit > 0 ? t('no-databases') : t('cannot-be-created')}
                            </ItemCell>
                        </ItemRow>
                    )}
                </ItemList>
            )}
        </ServerContentBlock>
    );
};
