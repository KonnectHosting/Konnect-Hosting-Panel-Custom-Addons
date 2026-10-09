import React from 'react';
import { Schedule } from '@/api/server/schedules/getServerSchedules';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';

interface Props {
    cron: Schedule['cron'];
    className?: string;
}

const ScheduleCronRow = ({ cron, className }: Props) => {
    const { t } = useTranslation('arix/server/schedules');

    return (
        <div className={classNames('flex', className)}>
            <div className={'w-1/5 sm:w-auto text-center'}>
                <p className={'font-medium'}>{cron.minute}</p>
                <p className={'text-2xs text-neutral-500 uppercase'}>{t('minute')}</p>
            </div>
            <div className={'w-1/5 sm:w-auto text-center ml-4'}>
                <p className={'font-medium'}>{cron.hour}</p>
                <p className={'text-2xs text-neutral-500 uppercase'}>{t('hour')}</p>
            </div>
            <div className={'w-1/5 sm:w-auto text-center ml-4'}>
                <p className={'font-medium'}>{cron.dayOfMonth}</p>
                <p className={'text-2xs text-neutral-500 uppercase'}>
                    {t('day')} ({t('month')})
                </p>
            </div>
            <div className={'w-1/5 sm:w-auto text-center ml-4'}>
                <p className={'font-medium'}>{cron.month}</p>
                <p className={'text-2xs text-neutral-500 uppercase'}>{t('month')}</p>
            </div>
            <div className={'w-1/5 sm:w-auto text-center ml-4'}>
                <p className={'font-medium'}>{cron.dayOfWeek}</p>
                <p className={'text-2xs text-neutral-500 uppercase'}>
                    {t('day')} ({t('week')})
                </p>
            </div>
        </div>
    );
};

export default ScheduleCronRow;
