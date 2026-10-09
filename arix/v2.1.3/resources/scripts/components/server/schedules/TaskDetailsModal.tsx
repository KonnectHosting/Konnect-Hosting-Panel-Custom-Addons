import React, { useContext, useEffect } from 'react';
import { Schedule, Task } from '@/api/server/schedules/getServerSchedules';
import { Field as FormikField, Form, Formik, FormikHelpers, useField } from 'formik';
import { ServerContext } from '@/state/server';
import createOrUpdateScheduleTask from '@/api/server/schedules/createOrUpdateScheduleTask';
import { httpErrorToHuman } from '@/api/http';
import Field from '@/components/elements/Field';
import FlashMessageRender from '@/components/FlashMessageRender';
import { boolean, number, object, string } from 'yup';
import useFlash from '@/plugins/useFlash';
import FormikFieldWrapper from '@/components/elements/FormikFieldWrapper';
import tw from 'twin.macro';
import Label from '@/components/elements/Label';
import { Textarea } from '@/components/elements/Input';
import { Button } from '@/components/elements/button/index';
import Select from '@/components/elements/Select';
import FormikSwitch from '@/components/elements/FormikSwitch';
import { useTranslation } from 'react-i18next';
import asDialog from '@/hoc/asDialog';
import { DialogWrapperContext } from '@/components/elements/dialog/context';
import { Dialog } from '@/components/elements/dialog/index';

interface Props {
    schedule: Schedule;
    // If a task is provided we can assume we're editing it. If not provided,
    // we are creating a new one.
    task?: Task;
}

interface Values {
    action: string;
    payload: string;
    timeOffset: string;
    continueOnFailure: boolean;
    discordUrl: string;
    discordMessage: string;
    deleteFilesPayload: string;
}

const schema = object().shape({
    action: string().required().oneOf(['command', 'power', 'backup', 'discord', 'delete_files']),
    payload: string().when('action', {
        is: (v: string) => v !== 'backup' && v !== 'discord' && v !== 'delete_files',
        then: string().required('A task payload must be provided.'),
        otherwise: string(),
    }),
    deleteFilesPayload: string().when('action', {
        is: 'delete_files',
        then: string().required('At least one file or folder path must be provided.'),
        otherwise: string(),
    }),
    discordUrl: string().when('action', {
        is: 'discord',
        then: string().url('Must be a valid URL.').required('A webhook URL must be provided.'),
        otherwise: string(),
    }),
    discordMessage: string().when('action', {
        is: 'discord',
        then: string().required('A message must be provided.'),
        otherwise: string(),
    }),
    continueOnFailure: boolean(),
    timeOffset: number()
        .typeError('The time offset must be a valid number between 0 and 900.')
        .required('A time offset value must be provided.')
        .min(0, 'The time offset must be at least 0 seconds.')
        .max(900, 'The time offset must be less than 900 seconds.'),
});

const ActionListener = () => {
    const [{ value }, { initialValue: initialAction }] = useField<string>('action');
    const [, { initialValue: initialPayload }, { setValue, setTouched }] = useField<string>('payload');
    const [, , { setValue: setDiscordUrl }] = useField<string>('discordUrl');
    const [, , { setValue: setDiscordMessage }] = useField<string>('discordMessage');
    const [, , { setValue: setDeleteFilesPayload }] = useField<string>('deleteFilesPayload');

    useEffect(() => {
        if (value !== initialAction) {
            setValue(value === 'power' ? 'start' : '');
            setDiscordUrl('');
            setDiscordMessage('');
            setDeleteFilesPayload('');
            setTouched(false);
        } else {
            setValue(initialPayload || '');
            setTouched(false);
        }
    }, [value]);

    return null;
};

const TaskDetailsModal = ({ schedule, task }: Props) => {
    const { t } = useTranslation('arix/server/schedules');
    const { close } = useContext(DialogWrapperContext);
    const { clearFlashes, addError } = useFlash();

    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const appendSchedule = ServerContext.useStoreActions((actions) => actions.schedules.appendSchedule);
    const backupLimit = ServerContext.useStoreState((state) => state.server.data!.featureLimits.backups);

    useEffect(() => {
        return () => {
            clearFlashes('schedule:task');
        };
    }, []);

    const submit = (values: Values, { setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes('schedule:task');
        if (backupLimit === 0 && values.action === 'backup') {
            setSubmitting(false);
            addError({
                message: t('task.message'),
                key: 'schedule:task',
            });
        } else {
            const payload =
                values.action === 'discord'
                    ? JSON.stringify({ url: values.discordUrl, message: values.discordMessage })
                    : values.action === 'delete_files'
                    ? values.deleteFilesPayload
                    : values.payload;
            createOrUpdateScheduleTask(uuid, schedule.id, task?.id, { ...values, payload })
                .then((task) => {
                    let tasks = schedule.tasks.map((t) => (t.id === task.id ? task : t));
                    if (!schedule.tasks.find((t) => t.id === task.id)) {
                        tasks = [...tasks, task];
                    }

                    appendSchedule({ ...schedule, tasks });
                    close();
                })
                .catch((error) => {
                    console.error(error);
                    setSubmitting(false);
                    addError({ message: httpErrorToHuman(error), key: 'schedule:task' });
                });
        }
    };

    return (
        <Formik
            onSubmit={submit}
            validationSchema={schema}
            initialValues={{
                action: task?.action || 'command',
                payload: task?.payload || '',
                timeOffset: task?.timeOffset.toString() || '0',
                continueOnFailure: task?.continueOnFailure || false,
                discordUrl: (() => {
                    if (task?.action === 'discord' && task.payload) {
                        try {
                            return JSON.parse(task.payload).url || '';
                        } catch {
                            return '';
                        }
                    }
                    return '';
                })(),
                discordMessage: (() => {
                    if (task?.action === 'discord' && task.payload) {
                        try {
                            return JSON.parse(task.payload).message || '';
                        } catch {
                            return '';
                        }
                    }
                    return '';
                })(),
                deleteFilesPayload: task?.action === 'delete_files' ? task.payload || '' : '',
            }}
        >
            {({ isSubmitting, values, submitForm }) => (
                <Form css={tw`m-0`}>
                    <FlashMessageRender byKey={'schedule:task'} css={tw`mb-4`} />
                    <div css={tw`flex`}>
                        <div css={tw`mr-2 w-1/3`}>
                            <Label>{t('task.action')}</Label>
                            <ActionListener />
                            <FormikFieldWrapper name={'action'}>
                                <FormikField as={Select} name={'action'}>
                                    <option value={'command'}>{t('task.send-command')}</option>
                                    <option value={'power'}>{t('task.send-power-action')}</option>
                                    <option value={'backup'}>{t('task.create-backup')}</option>
                                    <option value={'discord'}>{t('task.discord-webhook')}</option>
                                    <option value={'delete_files'}>{t('task.delete-files')}</option>
                                </FormikField>
                            </FormikFieldWrapper>
                        </div>
                        <div css={tw`flex-1 ml-6`}>
                            <Field
                                name={'timeOffset'}
                                label={t('task.offset')}
                                description={t('task.offset-description')}
                            />
                        </div>
                    </div>
                    <div css={tw`mt-6`}>
                        {values.action === 'command' ? (
                            <div>
                                <Label>{t('task.payload')}</Label>
                                <FormikFieldWrapper name={'payload'}>
                                    <FormikField as={Textarea} name={'payload'} rows={6} />
                                </FormikFieldWrapper>
                            </div>
                        ) : values.action === 'power' ? (
                            <div>
                                <Label>{t('task.payload')}</Label>
                                <FormikFieldWrapper name={'payload'}>
                                    <FormikField as={Select} name={'payload'}>
                                        <option value={'start'}>{t('task.start-server')}</option>
                                        <option value={'restart'}>{t('task.restart-server')}</option>
                                        <option value={'stop'}>{t('task.stop-server')}</option>
                                        <option value={'kill'}>{t('task.kill-server')}</option>
                                    </FormikField>
                                </FormikFieldWrapper>
                            </div>
                        ) : values.action === 'discord' ? (
                            <div>
                                <Field name={'discordUrl'} label={'Webhook URL'} />
                                <div css={tw`mt-4`}>
                                    <Label>Message</Label>
                                    <FormikFieldWrapper name={'discordMessage'}>
                                        <FormikField as={Textarea} name={'discordMessage'} rows={4} />
                                    </FormikFieldWrapper>
                                </div>
                            </div>
                        ) : values.action === 'delete_files' ? (
                            <div>
                                <Label>{t('task.files-and-folders')}</Label>
                                <FormikFieldWrapper
                                    name={'deleteFilesPayload'}
                                    description={t('task.one-path-per-line')}
                                >
                                    <FormikField as={Textarea} name={'deleteFilesPayload'} rows={6} />
                                </FormikFieldWrapper>
                            </div>
                        ) : (
                            <div>
                                <Label>{t('task.ignored-files')}</Label>
                                <FormikFieldWrapper name={'payload'} description={t('task.ignored-files-description')}>
                                    <FormikField as={Textarea} name={'payload'} rows={6} />
                                </FormikFieldWrapper>
                            </div>
                        )}
                    </div>
                    <div css={tw`mt-4 rounded-component border border-gray-500 p-4`}>
                        <FormikSwitch
                            name={'continueOnFailure'}
                            description={t('task.continue-on-failure-description')}
                            label={t('task.continue-on-failure')}
                        />
                    </div>
                    <Dialog.Footer>
                        <Button.Text onClick={() => close()} variant={Button.Variants.Secondary}>
                            Cancel
                        </Button.Text>
                        <Button type={'submit'} disabled={isSubmitting} onClick={submitForm}>
                            {task ? t('task.save-changes') : t('task.create-task')}
                        </Button>
                    </Dialog.Footer>
                </Form>
            )}
        </Formik>
    );
};

export default asDialog({
    title: 'Schedule Task',
})(TaskDetailsModal);
