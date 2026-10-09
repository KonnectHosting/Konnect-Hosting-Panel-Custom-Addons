import React, { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import { Actions, useStoreActions, useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import Spinner from '@/components/elements/Spinner';
import AddSubuserButton from '@/components/server/users/AddSubuserButton';
import UserRow from '@/components/server/users/UserRow';
import FlashMessageRender from '@/components/FlashMessageRender';
import getServerSubusers from '@/api/server/users/getServerSubusers';
import { httpErrorToHuman } from '@/api/http';
import Can from '@/components/elements/Can';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import ItemList, { ItemRow, ItemCell } from '@/components/elements/ItemList';
import { UserGroupIcon } from '@heroicons/react/outline';
import tw from 'twin.macro';
import { useTranslation } from 'react-i18next';
import PresetButton from './presets/PresetButton';

export default () => {
    const { t } = useTranslation('arix/server/users');
    const [loading, setLoading] = useState(true);

    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const subusers = ServerContext.useStoreState((state) => state.subusers.data);
    const setSubusers = ServerContext.useStoreActions((actions) => actions.subusers.setSubusers);

    const permissions = useStoreState((state: ApplicationStore) => state.permissions.data);
    const getPermissions = useStoreActions((actions: Actions<ApplicationStore>) => actions.permissions.getPermissions);
    const { addError, clearFlashes } = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes);

    useEffect(() => {
        clearFlashes('users');
        getServerSubusers(uuid)
            .then((subusers) => {
                setSubusers(subusers);
                setLoading(false);
            })
            .catch((error) => {
                console.error(error);
                addError({ key: 'users', message: httpErrorToHuman(error) });
            });
    }, []);

    useEffect(() => {
        getPermissions().catch((error) => {
            addError({ key: 'users', message: httpErrorToHuman(error) });
            console.error(error);
        });
    }, []);

    if (!subusers.length && (loading || !Object.keys(permissions).length)) {
        return <Spinner size={'large'} centered />;
    }

    return (
        <ServerContentBlock title={t('title')} icon={UserGroupIcon}>
            <FlashMessageRender byKey={'users'} css={tw`mb-4`} />
            <ItemList
                title={
                    <div className={'flex lg:flex-row flex-col gap-2 items-start justify-between'}>
                        <p className={'text-medium text-gray-300'}>{t('manage-subusers')}</p>
                        <div className={'flex items-center gap-x-2'}>
                            <Can action={['user.create', 'user.read']} matchAny>
                                <PresetButton />
                            </Can>
                            <Can action={'user.create'}>
                                <AddSubuserButton />
                            </Can>
                        </div>
                    </div>
                }
                headers={
                    <tr>
                        <th>{t('name')}</th>
                        <th>{t('email')}</th>
                        <th>{t('creation-date')}</th>
                        <th>Expiration date</th>
                        <th>{t('2FA-enabled')}</th>
                        <th></th>
                    </tr>
                }
            >
                {!subusers.length ? (
                    <ItemRow>
                        <ItemCell colSpan={6} className={`text-center text-sm`}>
                            {t('no-users')}
                        </ItemCell>
                    </ItemRow>
                ) : (
                    subusers.map((subuser) => <UserRow key={subuser.uuid} subuser={subuser} />)
                )}
            </ItemList>
        </ServerContentBlock>
    );
};
