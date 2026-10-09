import React, { useState } from 'react';
import { Schedule, Task } from '@/api/server/schedules/getServerSchedules';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowCircleDown,
    faBullhorn,
    faClock,
    faCode,
    faFileArchive,
    faPencilAlt,
    faTimesCircle,
    faToggleOn,
    faTrashAlt,
} from '@fortawesome/free-solid-svg-icons';
import deleteScheduleTask from '@/api/server/schedules/deleteScheduleTask';
import { httpErrorToHuman } from '@/api/http';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import TaskDetailsModal from '@/components/server/schedules/TaskDetailsModal';
import Can from '@/components/elements/Can';
import useFlash from '@/plugins/useFlash';
import { ServerContext } from '@/state/server';
import tw from 'twin.macro';
import Icon from '@/components/elements/Icon';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/elements/dialog';

interface Props {
    schedule: Schedule;
    task: Task;
}

const getActionDetails = (action: string): [string, any] => {
    switch (action) {
        case 'command':
            return ['Send Command', faCode];
        case 'power':
            return ['Send Power Action', faToggleOn];
        case 'backup':
            return ['Create Backup', faFileArchive];
        case 'discord':
            return ['Send Discord Webhook', faBullhorn];
        case 'delete_files':
            return ['Delete Files', faTimesCircle];
        default:
            return ['Unknown Action', faCode];
    }
};

export default ({ schedule, task }: Props) => {
    const { t } = useTranslation('arix/server/schedules');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { clearFlashes, addError } = useFlash();
    const [visible, setVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const appendSchedule = ServerContext.useStoreActions((actions) => actions.schedules.appendSchedule);

    const onConfirmDeletion = () => {
        setIsLoading(true);
        clearFlashes('schedules');
        deleteScheduleTask(uuid, schedule.id, task.id)
            .then(() =>
                appendSchedule({
                    ...schedule,
                    tasks: schedule.tasks.filter((t) => t.id !== task.id),
                })
            )
            .catch((error) => {
                console.error(error);
                setIsLoading(false);
                addError({ message: httpErrorToHuman(error), key: 'schedules' });
            });
    };

    const [title, icon] = getActionDetails(task.action);

    return (
        <div css={tw`sm:flex items-center p-3 sm:p-6 bg-gray-600 mt-2 rounded-component`}>
            <SpinnerOverlay visible={isLoading} fixed size={'large'} />
            <TaskDetailsModal schedule={schedule} task={task} open={isEditing} onClose={() => setIsEditing(false)} />
            <Dialog.Confirm
                title={t('deleteTask.title')}
                confirm={t('deleteTask.delete')}
                onConfirmed={onConfirmDeletion}
                open={visible}
                onClose={() => setVisible(false)}
            >
                {t('deleteTask.description')}
            </Dialog.Confirm>
            <FontAwesomeIcon icon={icon} css={tw`text-lg text-gray-50 hidden md:block`} />
            <div css={tw`flex-none sm:flex-1 w-full sm:w-auto overflow-x-auto`}>
                <p css={tw`md:ml-6 text-neutral-200 uppercase text-sm`}>{title}</p>
                {task.payload && (
                    <div css={tw`md:ml-6 mt-2`}>
                        {task.action === 'backup' && (
                            <p css={tw`text-xs uppercase text-neutral-400 mb-1`}>{t('ignore-files-folders')}:</p>
                        )}
                        <div
                            css={tw`font-mono bg-neutral-800 rounded py-1 px-2 text-sm w-auto inline-block whitespace-pre-wrap break-all`}
                        >
                            {task.action === 'discord' ? JSON.parse(task.payload).message : task.payload}
                        </div>
                    </div>
                )}
            </div>
            <div css={tw`mt-3 sm:mt-0 flex items-center w-full sm:w-auto`}>
                {task.continueOnFailure && (
                    <div css={tw`mr-6`}>
                        <div
                            css={tw`flex items-center px-3 py-2 bg-yellow-500 text-yellow-800 text-sm rounded-component`}
                        >
                            <Icon icon={faArrowCircleDown} css={tw`w-3 h-3 mr-2`} />
                            {t('continues-on-failure')}
                        </div>
                    </div>
                )}
                {task.sequenceId > 1 && task.timeOffset > 0 && (
                    <div css={tw`mr-6`}>
                        <div css={tw`flex items-center px-3 py-2 bg-neutral-500 text-sm rounded-component`}>
                            <Icon icon={faClock} css={tw`w-3 h-3 mr-2`} />
                            {task.timeOffset}s {t('later')}
                        </div>
                    </div>
                )}
                <Can action={'schedule.update'}>
                    <button
                        type={'button'}
                        aria-label={'Edit scheduled task'}
                        css={tw`block text-sm p-2 text-neutral-300 hover:text-neutral-100 transition-colors duration-150 mr-4 ml-auto sm:ml-0`}
                        onClick={() => setIsEditing(true)}
                    >
                        <FontAwesomeIcon icon={faPencilAlt} />
                    </button>
                </Can>
                <Can action={'schedule.update'}>
                    <button
                        type={'button'}
                        aria-label={'Delete scheduled task'}
                        css={tw`block text-sm p-2 text-neutral-300 hover:text-danger-50 transition-colors duration-150`}
                        onClick={() => setVisible(true)}
                    >
                        <FontAwesomeIcon icon={faTrashAlt} />
                    </button>
                </Can>
            </div>
        </div>
    );
};
