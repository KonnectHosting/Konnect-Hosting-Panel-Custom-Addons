import React, { useEffect, useState } from 'react';
import getServerSchedules from '@/api/server/schedules/getServerSchedules';
import { ServerContext } from '@/state/server';
import Spinner from '@/components/elements/Spinner';
import FlashMessageRender from '@/components/FlashMessageRender';
import ScheduleRow from '@/components/server/schedules/ScheduleRow';
import { httpErrorToHuman } from '@/api/http';
import EditScheduleModal from '@/components/server/schedules/EditScheduleModal';
import Can from '@/components/elements/Can';
import useFlash from '@/plugins/useFlash';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import ItemList, { ItemRow, ItemCell } from '@/components/elements/ItemList';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import { CalendarIcon } from '@heroicons/react/outline';
import { useTranslation } from 'react-i18next';

export default () => {
    const { t } = useTranslation('arix/server/schedules');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { clearFlashes, addError } = useFlash();
    const [loading, setLoading] = useState(true);
    const [visible, setVisible] = useState(false);

    const schedules = ServerContext.useStoreState((state) => state.schedules.data);
    const setSchedules = ServerContext.useStoreActions((actions) => actions.schedules.setSchedules);

    useEffect(() => {
        clearFlashes('schedules');
        getServerSchedules(uuid)
            .then((schedules) => setSchedules(schedules))
            .catch((error) => {
                addError({ message: httpErrorToHuman(error), key: 'schedules' });
                console.error(error);
            })
            .then(() => setLoading(false));
    }, []);

    return (
        <ServerContentBlock title={t('schedules')} icon={CalendarIcon}>
            <FlashMessageRender byKey={'schedules'} css={tw`mb-4`} />
            {!schedules.length && loading ? (
                <Spinner size={'large'} centered />
            ) : (
                <>
                    <ItemList
                        title={
                            <div className={'flex lg:flex-row flex-col gap-2 items-start justify-between'}>
                                <div>
                                    <p className={'text-medium text-gray-300'}>{t('manage-schedules')}</p>
                                </div>
                                <Can action={'schedule.create'}>
                                    <EditScheduleModal open={visible} onClose={() => setVisible(false)} />
                                    <Button type={'button'} onClick={() => setVisible(true)}>
                                        {t('create-schedule')}
                                    </Button>
                                </Can>
                            </div>
                        }
                        headers={
                            <tr>
                                <th>{t('name')}</th>
                                <th>{t('last-run-at')}</th>
                                <th>{t('status')}</th>
                                <th></th>
                            </tr>
                        }
                    >
                        {schedules.length === 0 ? (
                            <ItemRow>
                                <ItemCell colSpan={5} className={`text-center text-sm`}>
                                    {t('no-schedules')}
                                </ItemCell>
                            </ItemRow>
                        ) : (
                            schedules.map((schedule) => (
                                <ItemRow key={schedule.id}>
                                    <ScheduleRow schedule={schedule} />
                                </ItemRow>
                            ))
                        )}
                    </ItemList>
                </>
            )}
        </ServerContentBlock>
    );
};
