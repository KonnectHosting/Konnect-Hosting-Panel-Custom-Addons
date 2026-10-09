import React, { useContext, useEffect, useState } from 'react';
import { Schedule } from '@/api/server/schedules/getServerSchedules';
import Field from '@/components/elements/Field';
import Label from '@/components/elements/Label';
import Select from '@/components/elements/Select';
import { Form, Formik, FormikHelpers } from 'formik';
import FormikSwitch from '@/components/elements/FormikSwitch';
import createOrUpdateSchedule from '@/api/server/schedules/createOrUpdateSchedule';
import { ServerContext } from '@/state/server';
import { httpErrorToHuman } from '@/api/http';
import FlashMessageRender from '@/components/FlashMessageRender';
import useFlash from '@/plugins/useFlash';
import tw from 'twin.macro';
import { Button } from '@/components/elements/button/index';
import { DialogWrapperContext } from '@/components/elements/dialog';
import asDialog from '@/hoc/asDialog';
import Switch from '@/components/elements/Switch';
import ScheduleCheatsheetCards from '@/components/server/schedules/ScheduleCheatsheetCards';
import { useTranslation } from 'react-i18next';
import cronstrue from 'cronstrue';
import { Dialog } from '@/components/elements/dialog/index';

interface Props {
    schedule?: Schedule;
}

interface Values {
    name: string;
    dayOfWeek: string;
    month: string;
    dayOfMonth: string;
    hour: string;
    minute: string;
    enabled: boolean;
    onlyWhenOnline: boolean;
}

const EditScheduleModal = ({ schedule }: Props) => {
    const { t } = useTranslation('arix/server/schedules');
    const { addError, clearFlashes } = useFlash();
    const { close: dismiss } = useContext(DialogWrapperContext);

    const [mode, setMode] = useState<'easy' | 'advanced'>(schedule?.name ? 'advanced' : 'easy');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const appendSchedule = ServerContext.useStoreActions((actions) => actions.schedules.appendSchedule);
    const [showCheatsheet, setShowCheetsheet] = useState(false);

    useEffect(() => {
        return () => {
            clearFlashes('schedule:edit');
        };
    }, []);

    const submit = (values: Values, { setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes('schedule:edit');
        createOrUpdateSchedule(uuid, {
            id: schedule?.id,
            name: values.name,
            cron: {
                minute: values.minute,
                hour: values.hour,
                dayOfWeek: values.dayOfWeek,
                month: values.month,
                dayOfMonth: values.dayOfMonth,
            },
            onlyWhenOnline: values.onlyWhenOnline,
            isActive: values.enabled,
        })
            .then((schedule) => {
                setSubmitting(false);
                appendSchedule(schedule);
                dismiss();
            })
            .catch((error) => {
                console.error(error);

                setSubmitting(false);
                addError({ key: 'schedule:edit', message: httpErrorToHuman(error) });
            });
    };

    const CronRender = ({ minute, hour, dayOfMonth, month, dayOfWeek }: Values) => {
        try {
            return cronstrue.toString(
                `${minute ?? '*'} ${hour ?? '*'} ${dayOfMonth ?? '*'} ${month ?? '*'} ${dayOfWeek ?? '*'}`
            );
        } catch {
            return null;
        }
    };

    return (
        <Formik
            onSubmit={submit}
            initialValues={
                {
                    name: schedule?.name || '',
                    minute: schedule?.cron.minute || '*/5',
                    hour: schedule?.cron.hour || '*',
                    dayOfMonth: schedule?.cron.dayOfMonth || '*',
                    month: schedule?.cron.month || '*',
                    dayOfWeek: schedule?.cron.dayOfWeek || '*',
                    enabled: schedule?.isActive ?? true,
                    onlyWhenOnline: schedule?.onlyWhenOnline ?? true,
                } as Values
            }
        >
            {({ isSubmitting, values, setFieldValue, submitForm }) => (
                <Form>
                    <FlashMessageRender byKey={'schedule:edit'} css={tw`mb-6`} />
                    <Field name={'name'} label={t('edit.name')} description={t('edit.name-description')} />
                    <div className='w-full flex items-center justify-between mt-4'>
                        <div>
                            <p className='text-gray-100 font-semibold'>{t('edit.easy-mode')}</p>
                            <p>{t('edit.easy-mode-description')}</p>
                        </div>
                        <div className='flex items-center gap-x-2'>
                            <span className='text-sm text-secondary-300'>{t('edit.easy')}</span>
                            <Switch
                                name={'mode'}
                                defaultChecked={mode === 'advanced'}
                                onChange={() => setMode((m) => (m === 'easy' ? 'advanced' : 'easy'))}
                            />
                            <span className='text-sm text-secondary-300'>{t('edit.advanced')}</span>
                        </div>
                    </div>
                    {mode === 'easy' ? (
                        <div className='mt-4 rounded-component border border-gray-500 p-4'>
                            <div css={tw`grid grid-cols-1 sm:grid-cols-5 gap-x-4 gap-y-3`}>
                                <div>
                                    <Label>{t('minute')}</Label>
                                    <Select
                                        name={'minute'}
                                        defaultValue={values.minute}
                                        onChange={(e: any) => setFieldValue('minute', e.target.value)}
                                    >
                                        <option value='*'>Every Minute</option>
                                        <option value='*/5'>Every 5 Minutes</option>
                                        <option value='*/10'>Every 10 Minutes</option>
                                        <option value='*/15'>Every 15 Minutes</option>
                                        <option value='*/30'>Every 30 Minutes</option>
                                        <option value='0'>Once</option>
                                    </Select>
                                </div>
                                <div>
                                    <Label>{t('hour')}</Label>
                                    <Select name={'hour'} onChange={(e: any) => setFieldValue('hour', e.target.value)}>
                                        <option value='*'>Every Hour</option>
                                        <option value='0'>Every Day at Midnight</option>
                                        <option value='6'>Every Day at 6:00 AM</option>
                                        <option value='12'>Every Day at Noon</option>
                                        <option value='18'>Every Day at 6:00 PM</option>
                                        <option value='0'>Once</option>
                                    </Select>
                                </div>
                                <div>
                                    <Label>{t('day-of-month')}</Label>
                                    <Select
                                        name={'dayOfMonth'}
                                        onChange={(e: any) => setFieldValue('dayOfMonth', e.target.value)}
                                    >
                                        <option value='*'>Every Day</option>
                                        <option value='1'>1st of the Month</option>
                                        <option value='15'>15th of the Month</option>
                                        <option value='28'>28th of the Month</option>
                                    </Select>
                                </div>
                                <div>
                                    <Label>{t('month')}</Label>
                                    <Select
                                        name={'month'}
                                        onChange={(e: any) => setFieldValue('month', e.target.value)}
                                    >
                                        <option value='*'>Every Month</option>
                                        <option value='1'>January</option>
                                        <option value='4'>April</option>
                                        <option value='7'>July</option>
                                        <option value='10'>October</option>
                                    </Select>
                                </div>
                                <div>
                                    <Label>{t('day-of-week')}</Label>
                                    <Select
                                        name={'dayOfWeek'}
                                        onChange={(e: any) => setFieldValue('dayOfWeek', e.target.value)}
                                    >
                                        <option value='*'>Every Day of the Week</option>
                                        <option value='0'>Sunday</option>
                                        <option value='1'>Monday</option>
                                        <option value='2'>Tuesday</option>
                                        <option value='3'>Wednesday</option>
                                        <option value='4'>Thursday</option>
                                        <option value='5'>Friday</option>
                                        <option value='6'>Saturday</option>
                                        <option value='5-6'>Weekend (Saturday & Sunday)</option>
                                        <option value='1-5'>Weekdays (Monday to Friday)</option>
                                    </Select>
                                </div>
                            </div>
                            <div className='mt-4'>
                                Preview:&nbsp;
                                <span className='font-semibold'>
                                    {CronRender({
                                        minute: values.minute,
                                        hour: values.hour,
                                        dayOfMonth: values.dayOfMonth,
                                        month: values.month,
                                        dayOfWeek: values.dayOfWeek,
                                        name: '',
                                        enabled: false,
                                        onlyWhenOnline: false,
                                    })}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className='mt-4 rounded-component border border-gray-500 p-4'>
                                <div css={tw`grid grid-cols-2 sm:grid-cols-5 gap-4`}>
                                    <Field
                                        onChange={(e: any) => setFieldValue('minute', e.target.value)}
                                        name={'minute'}
                                        label={t('minute')}
                                    />
                                    <Field
                                        onChange={(e: any) => setFieldValue('hour', e.target.value)}
                                        name={'hour'}
                                        label={t('hour')}
                                    />
                                    <Field
                                        onChange={(e: any) => setFieldValue('dayOfMonth', e.target.value)}
                                        name={'dayOfMonth'}
                                        label={t('day-of-month')}
                                    />
                                    <Field
                                        onChange={(e: any) => setFieldValue('month', e.target.value)}
                                        name={'month'}
                                        label={t('month')}
                                    />
                                    <Field
                                        onChange={(e: any) => setFieldValue('dayOfWeek', e.target.value)}
                                        name={'dayOfWeek'}
                                        label={t('day-of-week')}
                                    />
                                </div>
                                <p css={tw`text-neutral-400 text-xs mt-2`}>{t('edit.description')}</p>
                                <div css={tw`mt-4`}>
                                    Preview:&nbsp;
                                    <span className='font-semibold'>
                                        {(() => {
                                            try {
                                                return cronstrue.toString(
                                                    `${values.minute ?? '*'} ${values.hour ?? '*'} ${
                                                        values.dayOfMonth ?? '*'
                                                    } ${values.month ?? '*'} ${values.dayOfWeek ?? '*'}`
                                                );
                                            } catch {
                                                return null;
                                            }
                                        })()}
                                    </span>
                                </div>
                            </div>
                            <div css={tw`mt-4 rounded-component border border-gray-500 p-4`}>
                                <Switch
                                    name={'show_cheatsheet'}
                                    description={t('edit.cheatsheet-description')}
                                    label={t('edit.cheatsheet')}
                                    defaultChecked={showCheatsheet}
                                    onChange={() => setShowCheetsheet((s) => !s)}
                                />
                                {showCheatsheet && (
                                    <div css={tw`block md:flex w-full`}>
                                        <ScheduleCheatsheetCards />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <div css={tw`mt-4 rounded-component border border-gray-500 p-4`}>
                        <FormikSwitch
                            name={'onlyWhenOnline'}
                            description={t('edit.online-when-online-description')}
                            label={t('edit.online-when-online')}
                        />
                    </div>
                    <div css={tw`mt-4 rounded-component border border-gray-500 p-4`}>
                        <FormikSwitch
                            name={'enabled'}
                            description={t('edit.enabled-description')}
                            label={t('edit.enabled')}
                        />
                    </div>
                    <Dialog.Footer>
                        <Button.Text onClick={() => dismiss()}>Cancel</Button.Text>
                        <Button
                            className={'w-full sm:w-auto'}
                            type={'submit'}
                            onClick={submitForm}
                            disabled={isSubmitting}
                        >
                            {schedule ? t('edit.save-changes') : t('create-schedule')}
                        </Button>
                    </Dialog.Footer>
                </Form>
            )}
        </Formik>
    );
};

export default asDialog({
    title: 'Schedules',
    extraWidth: true,
})(EditScheduleModal);
