import React, { useState } from 'react';
import { Schedule } from '@/api/server/schedules/getServerSchedules';
import TaskDetailsModal from '@/components/server/schedules/TaskDetailsModal';
import { Button } from '@/components/elements/button/index';
import { useTranslation } from 'react-i18next';

interface Props {
    schedule: Schedule;
}

export default ({ schedule }: Props) => {
    const { t } = useTranslation('arix/server/schedules');
    const [visible, setVisible] = useState(false);

    return (
        <>
            <TaskDetailsModal schedule={schedule} open={visible} onClose={() => setVisible(false)} />
            <Button onClick={() => setVisible(true)}>{t('new-task')}</Button>
        </>
    );
};
