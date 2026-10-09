import React from 'react';
import { useHistory, useRouteMatch } from 'react-router-dom';
import { Schedule } from '@/api/server/schedules/getServerSchedules';
import { Button } from '@/components/elements/button/index';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import * as locales from 'date-fns/locale';
import { ItemCell } from '@/components/elements/ItemList';

const getLocale = (localeKey: keyof typeof locales) => {
    if (locales[localeKey]) {
        return locales[localeKey];
    } else {
        const keyString = String(localeKey);
        console.warn(`Locale '${keyString}' not found. Falling back to '${locales.enUS}'`);
        return locales.enUS;
    }
};

export default ({ schedule }: { schedule: Schedule }) => {
    const { t, i18n } = useTranslation('arix/server/schedules');
    const currentLang = i18n.language;
    const localeKey = currentLang as keyof typeof locales;
    const match = useRouteMatch();
    const history = useHistory();

    return (
        <>
            <ItemCell>{schedule.name}</ItemCell>
            <ItemCell>
                {schedule.lastRunAt
                    ? format(schedule.lastRunAt, "MMM do 'at' h:mma", { locale: getLocale(localeKey) })
                    : t('never')}
            </ItemCell>
            <ItemCell>
                <span
                    className={`py-1 px-3 rounded-component ${
                        schedule.isActive ? 'text-success-50 bg-success-200/40' : 'text-danger-50 bg-danger-200/40'
                    }`}
                >
                    {schedule.isActive ? t('active') : t('inactive')}
                </span>
            </ItemCell>
            <ItemCell className={'w-1'}>
                <Button.Text
                    onClick={(e: any) => {
                        e.preventDefault();
                        history.push(`${match.url}/${schedule.id}`);
                    }}
                >
                    {t('manage-schedule')}
                </Button.Text>
            </ItemCell>
        </>
    );
};
