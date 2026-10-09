import Field from '@/components/elements/Field';
import { FieldProps, Formik } from 'formik';
import React, { useEffect, useState } from 'react';
import EditorWrapper from '../elements/EditorWrapper';
import BorderedBox from '../elements/BorderedBox';
import SwitchField from '@/components/elements/SwitchField';
import { Button, styles } from '@/components/elements/button/index';
import Spinner from '@/components/elements/Spinner';
import FlashMessageRender from '@/components/FlashMessageRender';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import { Field as FormikField } from 'formik';
import getAnnouncement, { AnnouncementSettings, updateAnnouncement } from '@/api/admin/Announcement';
import { Textarea } from '@/components/elements/Input';
import Label from '@/components/elements/Label';
import ColorField from '../elements/ColorField';
import FormPreviewHashSync from '@/plugins/FormPreviewHashSync';
import {
    LuCircleAlert,
    LuCircleCheck,
    LuFlame,
    LuInfo,
    LuLifeBuoy,
    LuMegaphone,
    LuPartyPopper,
    LuTriangleAlert,
} from 'react-icons/lu';
import classNames from 'classnames';
import OptionField from '../elements/OptionField';
import { TerminalIcon } from '@heroicons/react/outline';

const IconOptions = ({
    icon: Icon,
    field,
    value,
}: {
    icon: React.ComponentType;
    field: FieldProps['field'];
    value: string;
}) => {
    const selected = field.value === value;

    return (
        <label
            className={classNames(
                styles.button,
                styles.text,
                `relative !py-3 !text-xl ${selected ? '!bg-secondary-100 !text-white' : ''}`
            )}
        >
            <input {...field} value={value} type='radio' className='sr-only' />
            <Icon />
        </label>
    );
};

export default () => {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<AnnouncementSettings | null>(null);
    const [previewHash, setPreviewHash] = useState('');
    const { clearFlashes, addFlash } = useFlash();

    useEffect(() => {
        clearFlashes();
    }, []);

    useEffect(() => {
        getAnnouncement()
            .then((data) => {
                setData(data);
                setIsLoading(false);
            })
            .catch((error) => {
                clearFlashes();
                addFlash({ type: 'error', message: httpErrorToHuman(error) });
                setIsLoading(false);
            });
    }, []);

    const handleSubmit = (values: AnnouncementSettings) => {
        clearFlashes();

        const payload: AnnouncementSettings = {
            ...values,
        };

        return updateAnnouncement(payload)
            .then((updated) => {
                setData(updated ?? payload);
                addFlash({ type: 'success', message: 'Announcement settings updated successfully.' });
            })
            .catch((error) => {
                addFlash({ type: 'error', message: httpErrorToHuman(error) });
            });
    };

    const initialValues: AnnouncementSettings = {
        enabled: data?.enabled ?? false,
        position: data?.position ?? 'header',
        color: data?.color ?? '#16aaaa',
        icon: data?.icon ?? 'megaphone',
        message: data?.message ?? '',
        cta: data?.cta ?? false,
        ctaTitle: data?.ctaTitle ?? '',
        ctaLink: data?.ctaLink ?? '',
        dismissable: data?.dismissable ?? false,
    };

    return (
        <EditorWrapper title='Announcement Settings' previewHash={previewHash}>
            <FlashMessageRender />
            {isLoading || !data ? (
                <Spinner size='large' centered />
            ) : (
                <Formik<AnnouncementSettings> initialValues={initialValues} enableReinitialize onSubmit={handleSubmit}>
                    {({ isSubmitting, submitForm, values }) => (
                        <React.Fragment>
                            <FormPreviewHashSync
                                prefix={'arix-announcement'}
                                initialValues={initialValues}
                                onHashChange={setPreviewHash}
                            />
                            <BorderedBox
                                title='General'
                                description='Configure the general settings for the announcement.'
                            >
                                <SwitchField name='enabled' label='Enable Announcement' />
                                <div>
                                    <Label className='mb-1'>Announcement Position</Label>
                                    <div className='flex gap-2'>
                                        <OptionField
                                            name='position'
                                            value={'header'}
                                            label='Header'
                                            image={
                                                <div className='p-2 w-full'>
                                                    <div className='h-20 rounded-md overflow-hidden border border-gray-300 w-full flex'>
                                                        <div className='border-r border-gray-300 h-full w-1/4'></div>
                                                        <div className='flex-1'>
                                                            <div
                                                                className='w-full p-1 border-b'
                                                                style={{
                                                                    backgroundColor: values.color + '66',
                                                                    borderColor: values.color,
                                                                }}
                                                            ></div>
                                                            <div className='p-2'>
                                                                <p className='text-[0.5rem] mb-1'>Console</p>
                                                                <div className='w-full h-10 rounded border border-gray-300 flex items-center justify-center'>
                                                                    <TerminalIcon className='w-4' />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            }
                                        />
                                        <OptionField
                                            name='position'
                                            value={'top'}
                                            label='Top'
                                            image={
                                                <div className='p-2 w-full'>
                                                    <div className='h-20 rounded-md overflow-hidden border border-gray-300 w-full flex'>
                                                        <div className='border-r border-gray-300 h-full w-1/4'></div>
                                                        <div className='flex-1 p-2'>
                                                            <div
                                                                className='mb-1 rounded w-full p-1 border-l-4'
                                                                style={{
                                                                    backgroundColor: values.color + '33',
                                                                    borderColor: values.color,
                                                                }}
                                                            ></div>
                                                            <div className='w-full h-10 rounded border border-gray-300 flex items-center justify-center'>
                                                                <TerminalIcon className='w-4' />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            }
                                        />
                                    </div>
                                </div>
                                <FormikField name='message'>
                                    {({ field }: FieldProps) => (
                                        <div>
                                            <Label htmlFor='message'>Announcement Message</Label>
                                            <Textarea {...field} rows={5} />
                                        </div>
                                    )}
                                </FormikField>
                                <ColorField
                                    id='color'
                                    name='color'
                                    label='Announcement Color'
                                    description='Set the color of the announcement.'
                                />
                                <FormikField name='icon'>
                                    {({ field }: FieldProps) => (
                                        <div className='grid lg:grid-cols-4 grid-cols-2 gap-2'>
                                            <Label className='lg:col-span-4 col-span-2'>Announcement Icon</Label>
                                            <IconOptions icon={LuPartyPopper} value='party-popper' field={field} />
                                            <IconOptions icon={LuMegaphone} value='megaphone' field={field} />
                                            <IconOptions icon={LuInfo} value='info' field={field} />
                                            <IconOptions icon={LuCircleCheck} value='circle-check' field={field} />
                                            <IconOptions icon={LuCircleAlert} value='circle-alert' field={field} />
                                            <IconOptions icon={LuTriangleAlert} value='triangle-alert' field={field} />
                                            <IconOptions icon={LuLifeBuoy} value='life-buoy' field={field} />
                                            <IconOptions icon={LuFlame} value='flame' field={field} />
                                        </div>
                                    )}
                                </FormikField>
                            </BorderedBox>
                            <BorderedBox title='Call to Action' description='Show a button on the announcement.'>
                                <SwitchField name='cta' label='Enable Call to Action' />
                                <Field
                                    id='ctaTitle'
                                    label={'Button Title'}
                                    name='ctaTitle'
                                    description='The text displayed on the call to action button.'
                                />
                                <Field
                                    id='ctaLink'
                                    label={'Button Link'}
                                    name='ctaLink'
                                    description='The URL that the user will be directed to when clicking the call to action button.'
                                />
                            </BorderedBox>
                            <BorderedBox title='Dismissable' description='Allow users to dismiss the announcement.'>
                                <SwitchField name='dismissable' label='Dismissable Announcement' />
                            </BorderedBox>
                            <div className='mt-auto sticky bottom-0 px-6 pb-5 bg-gray-700 z-20'>
                                <Button className='w-full relative' onClick={submitForm} disabled={isSubmitting}>
                                    Save Changes
                                    {isSubmitting && (
                                        <div className='absolute right-4'>
                                            <Spinner size='small' />
                                        </div>
                                    )}
                                </Button>
                            </div>
                        </React.Fragment>
                    )}
                </Formik>
            )}
        </EditorWrapper>
    );
};
