import React, { useCallback, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import getServerSchedule from '@/api/server/schedules/getServerSchedule';
import Spinner from '@/components/elements/Spinner';
import FlashMessageRender from '@/components/FlashMessageRender';
import EditScheduleModal from '@/components/server/schedules/EditScheduleModal';
import NewTaskButton from '@/components/server/schedules/NewTaskButton';
import DeleteScheduleButton from '@/components/server/schedules/DeleteScheduleButton';
import Can from '@/components/elements/Can';
import useFlash from '@/plugins/useFlash';
import { ServerContext } from '@/state/server';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import ScheduleTaskRow from '@/components/server/schedules/ScheduleTaskRow';
import isEqual from 'react-fast-compare';
import { format } from 'date-fns';
import RunScheduleButton from '@/components/server/schedules/RunScheduleButton';
import { CalendarIcon } from '@heroicons/react/outline';
import { useTranslation } from 'react-i18next';
import * as locales from 'date-fns/locale';

const getLocale = (localeKey: keyof typeof locales) => {
    if (locales[localeKey]) {
        return locales[localeKey];
    } else {
        const keyString = String(localeKey);
        console.warn(`Locale '${keyString}' not found. Falling back to '${locales.enUS}'`);
        return locales.enUS;
    }
};

interface Params {
    id: string;
}

const CronBox = ({ title, value }: { title: string; value: string }) => (
    <div className={`lg:border-r lg:border-b-0 border-b last:!border-0 border-gray-500 lg:px-5 lg:py-4 px-2 py-1`}>
        <p css={tw`text-neutral-300 text-sm`}>{title}</p>
        <p css={tw`text-xl font-medium text-neutral-100`}>{value}</p>
    </div>
);

const ActivePill = ({ active }: { active: boolean }) => {
    const { t } = useTranslation('arix/server/schedules');

    return (
        <span
            className={`py-1 px-3 rounded-component ${
                active ? 'text-success-50 bg-success-200/40' : 'text-danger-50 bg-danger-200/40'
            }`}
        >
            {active ? t('active') : t('inactive')}
        </span>
    );
};

export default () => {
    const { t, i18n } = useTranslation('arix/server/schedules');
    const currentLang = i18n.language;
    const localeKey = currentLang as keyof typeof locales;

    const history = useHistory();
    const { id: scheduleId } = useParams<Params>();

    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);

    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const [isLoading, setIsLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);

    const schedule = ServerContext.useStoreState(
        (st) => st.schedules.data.find((s) => s.id === Number(scheduleId)),
        isEqual
    );
    const appendSchedule = ServerContext.useStoreActions((actions) => actions.schedules.appendSchedule);

    useEffect(() => {
        if (schedule?.id === Number(scheduleId)) {
            setIsLoading(false);
            return;
        }

        clearFlashes('schedules');
        getServerSchedule(uuid, Number(scheduleId))
            .then((schedule) => appendSchedule(schedule))
            .catch((error) => {
                console.error(error);
                clearAndAddHttpError({ error, key: 'schedules' });
            })
            .then(() => setIsLoading(false));
    }, [scheduleId]);

    return (
        <ServerContentBlock title={t('schedules')} icon={CalendarIcon}>
            <FlashMessageRender byKey={'schedules'} css={tw`mb-4`} />
            {!schedule || isLoading ? (
                <Spinner size={'large'} centered />
            ) : (
                <>
                    <div className={'bg-gray-700 rounded-box px-6 py-5 backdrop boxBorder'}>
                        <div className={'flex lg:flex-row flex-col gap-4 items-start justify-between'}>
                            <div>
                                <div className={'flex gap-x-2 items-center'}>
                                    <p className={'text-lg font-medium text-gray-50'}>{schedule.name}</p>
                                    {schedule.isProcessing ? (
                                        <span
                                            css={tw`flex items-center py-1 px-3 rounded-component bg-neutral-600 text-gray-50`}
                                        >
                                            <Spinner css={tw`w-3! h-3! mr-2`} />
                                            {t('processing')}
                                        </span>
                                    ) : (
                                        <ActivePill active={schedule.isActive} />
                                    )}
                                </div>
                                <div className={'flex gap-x-4 flex-wrap mt-2'}>
                                    <div className={'flex'}>
                                        <p className={'text-gray-300'}>{t('last-run-at')}:&nbsp;</p>
                                        <p>
                                            {schedule.lastRunAt ? (
                                                format(schedule.lastRunAt, "MMM do 'at' h:mma", {
                                                    locale: getLocale(localeKey),
                                                })
                                            ) : (
                                                <span>{t('n/a')}</span>
                                            )}
                                        </p>
                                    </div>
                                    <div className={'flex'}>
                                        <p className={'text-gray-300'}>{t('next-run-at')}:&nbsp;</p>
                                        <p>
                                            {schedule.nextRunAt ? (
                                                format(schedule.nextRunAt, "MMM do 'at' h:mma", {
                                                    locale: getLocale(localeKey),
                                                })
                                            ) : (
                                                <span>{t('n/a')}</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className={'flex flex-1 flex-wrap justify-end gap-2'}>
                                <EditScheduleModal
                                    open={showEditModal}
                                    schedule={schedule}
                                    onClose={() => setShowEditModal(false)}
                                />
                                {schedule.tasks.length > 0 && (
                                    <Can action={'schedule.update'}>
                                        <RunScheduleButton schedule={schedule} />
                                    </Can>
                                )}
                                <Can action={'schedule.update'}>
                                    <Button.Text onClick={() => setShowEditModal(true)}>{t('editBtn')}</Button.Text>
                                    <NewTaskButton schedule={schedule} />
                                </Can>
                                <Can action={'schedule.delete'}>
                                    <DeleteScheduleButton
                                        scheduleId={schedule.id}
                                        onDeleted={() => history.push(`/server/${id}/schedules`)}
                                    />
                                </Can>
                            </div>
                        </div>
                        <div
                            className={
                                'grid lg:grid-cols-5 bg-gray-600 border border-gray-500 my-4 rounded-component overflow-hidden'
                            }
                        >
                            <CronBox title={t('minute')} value={schedule.cron.minute} />
                            <CronBox title={t('hour')} value={schedule.cron.hour} />
                            <CronBox title={`${t('day')} (${t('month')})`} value={schedule.cron.dayOfMonth} />
                            <CronBox title={t('month')} value={schedule.cron.month} />
                            <CronBox title={`${t('day')} (${t('week')})`} value={schedule.cron.dayOfWeek} />
                        </div>
                        {schedule.tasks.length > 0
                            ? schedule.tasks
                                  .sort((a, b) =>
                                      a.sequenceId === b.sequenceId ? 0 : a.sequenceId > b.sequenceId ? 1 : -1
                                  )
                                  .map((task) => (
                                      <ScheduleTaskRow
                                          key={`${schedule.id}_${task.id}`}
                                          task={task}
                                          schedule={schedule}
                                      />
                                  ))
                            : null}
                    </div>
                </>
            )}
        </ServerContentBlock>
    );
};
