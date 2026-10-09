import Field from '@/components/elements/Field';
import { Formik } from 'formik';
import React, { useEffect, useState } from 'react';
import EditorWrapper from '../elements/EditorWrapper';
import BorderedBox from '../elements/BorderedBox';
import SwitchField from '@/components/elements/SwitchField';
import { Button, styles } from '@/components/elements/button/index';
import Spinner from '@/components/elements/Spinner';
import FlashMessageRender from '@/components/FlashMessageRender';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import FormPreviewHashSync from '@/plugins/FormPreviewHashSync';
import getAdvanced, { AdvancedResponse, AdvancedSettings, updateAdvanced } from '@/api/admin/Advanced';
import SelectField from '../elements/SelectField';
import Input from '@/components/elements/Input';
import classNames from 'classnames';
import Label from '@/components/elements/Label';
import { ExclamationCircleIcon } from '@heroicons/react/outline';
import OptionField from '../elements/OptionField';

interface AdvancedFormValues {
    defaultMode: string;
    modeToggler: boolean;
    langSwitch: boolean;
    defaultLang: string;
    copyright: string;
    profileType: string;
    ipFlag: boolean;
    lowResourcesAlert: boolean;
    alertLink?: string;
    dashboardPage: boolean;
    registration: boolean;

    trashbin: boolean;
    gracePeriod: number;

    adminTheme: boolean;

    tierVisibility: string;

    profileCustomization: {
        username: boolean;
        name: boolean;
        email: boolean;
    };

    subscription: {
        target: string;
        endpoint?: string;
        identifier?: string;
        secret?: string;
        alert: boolean;
    };
}

export default () => {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<AdvancedResponse | null>(null);
    const { clearFlashes, addFlash } = useFlash();
    const [previewHash, setPreviewHash] = useState('');
    const [languages, setLanguages] = useState<{ key: string; name: string }[]>([]);

    useEffect(() => {
        clearFlashes();
    }, []);

    useEffect(() => {
        getAdvanced()
            .then((data) => {
                setData(data);
                setLanguages(data.languageOptions);
                setIsLoading(false);
            })
            .catch((error) => {
                clearFlashes();
                addFlash({ type: 'error', message: httpErrorToHuman(error) });
                setIsLoading(false);
            });
    }, []);

    const handleSubmit = (values: AdvancedFormValues) => {
        clearFlashes();

        const payload: AdvancedSettings = {
            ...values,
            languageOptions: languages ?? [],
            modeToggler: Boolean(values.modeToggler),
            langSwitch: Boolean(values.langSwitch),
            ipFlag: Boolean(values.ipFlag),
            lowResourcesAlert: Boolean(values.lowResourcesAlert),
            dashboardPage: Boolean(values.dashboardPage),
            registration: Boolean(values.registration),

            trashbin: Boolean(values.trashbin),
            gracePeriod: Number(values.gracePeriod),

            adminTheme: Boolean(values.adminTheme),

            profileCustomization: {
                username: Boolean(values.profileCustomization.username),
                name: Boolean(values.profileCustomization.name),
                email: Boolean(values.profileCustomization.email),
            },

            subscription: {
                ...values.subscription,
                alert: Boolean(values.subscription.alert),
            },
        };

        return updateAdvanced(payload)
            .then((updated) => {
                setData(updated ?? payload);
                addFlash({ type: 'success', message: 'Advanced settings updated successfully.' });
            })
            .catch((error) => {
                addFlash({ type: 'error', message: httpErrorToHuman(error) });
            });
    };

    const initialValues: AdvancedFormValues = {
        defaultMode: data?.defaultMode ?? 'darkmode',
        modeToggler: Boolean(data?.modeToggler),
        langSwitch: Boolean(data?.langSwitch),
        defaultLang: data?.defaultLang ?? 'en',
        copyright: data?.copyright ?? '',
        profileType: data?.profileType ?? '',
        ipFlag: Boolean(data?.ipFlag),
        lowResourcesAlert: Boolean(data?.lowResourcesAlert),
        alertLink: data?.alertLink ?? '',
        dashboardPage: Boolean(data?.dashboardPage),
        registration: Boolean(data?.registration),
        trashbin: Boolean(data?.trashbin),
        gracePeriod: Number(data?.gracePeriod) ?? 7,
        adminTheme: Boolean(data?.adminTheme),
        tierVisibility: data?.tierVisibility ?? 'hidden',
        profileCustomization: {
            username: Boolean(data?.profileCustomization?.username),
            name: Boolean(data?.profileCustomization?.name),
            email: Boolean(data?.profileCustomization?.email),
        },
        subscription: {
            target: data?.subscription?.target ?? 'none',
            endpoint: data?.subscription?.endpoint ?? '',
            identifier: data?.subscription?.identifier ?? '',
            secret: data?.subscription?.secret ?? '',
            alert: Boolean(data?.subscription?.alert),
        },
    };

    return (
        <EditorWrapper title='General Settings' previewHash={previewHash}>
            <FlashMessageRender />
            {isLoading || !data ? (
                <Spinner size='large' centered />
            ) : (
                <Formik<AdvancedFormValues> initialValues={initialValues} enableReinitialize onSubmit={handleSubmit}>
                    {({ isSubmitting, submitForm, values }) => (
                        <React.Fragment>
                            <FormPreviewHashSync
                                prefix={'arix-advanced'}
                                initialValues={initialValues}
                                onHashChange={setPreviewHash}
                            />
                            <BorderedBox title='General Settings'>
                                <Field
                                    name='copyright'
                                    label='Copyright Text'
                                    type='text'
                                    placeholder='Pterodactyl Software Ltd.'
                                />
                                <SwitchField
                                    name='dashboardPage'
                                    label='Dashboard Page'
                                    description='Toggle the dashbaord page off, and make Console the default page for servers.'
                                />
                                <SwitchField
                                    name='registration'
                                    label='Registration'
                                    description='Allow users to register an account on the panel.'
                                />
                                <SwitchField
                                    name='ipFlag'
                                    label='Geolocation Flags'
                                    description='Display country flags next to IP addresses on the activity page.'
                                />
                                <SelectField
                                    name='profileType'
                                    label='User Profile Type'
                                    description='Select the information shown on user profiles.'
                                    options={[
                                        { label: 'Gravatar', value: 'gravatar' },
                                        { label: 'Avataaars Neutral', value: 'avataaars' },
                                        { label: 'Bottts Neutral', value: 'bottts' },
                                        { label: 'Identicon', value: 'identicon' },
                                        { label: 'Initials', value: 'initials' },
                                        { label: 'Boring', value: 'boring' },
                                        { label: 'Thumbs', value: 'thumbs' },
                                        { label: 'Glass', value: 'glass' },
                                        { label: 'Toon Head', value: 'toon-head' },
                                        { label: 'Dylan', value: 'dylan' },
                                        { label: 'Big Smile', value: 'big-smile' },
                                    ]}
                                />
                            </BorderedBox>
                            <BorderedBox title='Theme Modes'>
                                <SwitchField
                                    name='modeToggler'
                                    label='Theme Switcher'
                                    description='Toggle the theme switch in the account page'
                                />
                                <div>
                                    <SelectField
                                        name='defaultMode'
                                        label='Default Theme'
                                        options={[
                                            { label: 'Dark Mode', value: 'darkmode' },
                                            { label: 'Light Mode', value: 'lightmode' },
                                        ]}
                                    />
                                    <p className='text-xs text-red-400 font-medium rounded-component flex items-start gap-x-1 mt-2'>
                                        <ExclamationCircleIcon className='w-3 shrink-0 mt-0.5' />
                                        Updates after saving (not shown in Live Preview)
                                    </p>
                                </div>
                            </BorderedBox>
                            <BorderedBox title='Upselling'>
                                <SwitchField
                                    name='lowResourcesAlert'
                                    label='Low Resources Alert'
                                    description='Display an alert on the server page when CPU or memory usage is above 95%.'
                                />
                                <Field
                                    name='alertLink'
                                    label='Alert Link'
                                    type='text'
                                    placeholder='https://example.com/upgrade'
                                    description='URL to open when users click the low resources alert.'
                                />
                                <div>
                                    <Label>Tier Visibility</Label>
                                    <div className='grid lg:grid-cols-2 gap-2'>
                                        <OptionField
                                            name='tierVisibility'
                                            label='Show'
                                            value='show'
                                            image={<p className='py-2'>Show</p>}
                                            description='Show routes of other tiers, with an page explain its for a certian tier.'
                                        />
                                        <OptionField
                                            name='tierVisibility'
                                            label='Hidden'
                                            value='hidden'
                                            image={<p className='py-2'>Hidden</p>}
                                            description='Only show routes of the current tier, without any routes of other tiers.'
                                        />
                                    </div>
                                </div>
                            </BorderedBox>
                            <BorderedBox
                                title='Subscription Service'
                                description='Show subscription info on server pages, directly coming from WHMCS or Paymenter.'
                            >
                                <SelectField
                                    label='Subscription Service'
                                    name='subscription.target'
                                    options={[
                                        { label: 'WHMCS', value: 'whmcs' },
                                        { label: 'Paymenter', value: 'paymenter' },
                                    ]}
                                />
                                <Field
                                    name='subscription.endpoint'
                                    label='Billing Settings'
                                    placeholder='https://example.com/'
                                    description='Make sure the endpoint starts with http:// or https:// and ends with a /'
                                />
                                {values.subscription.target === 'whmcs' && (
                                    <Field name='subscription.identifier' label='WHMCS Identifier' type='password' />
                                )}
                                <Field
                                    name='subscription.secret'
                                    label={values.subscription.target === 'whmcs' ? 'WHMCS Secret' : 'Paymenter Key'}
                                    type='password'
                                />
                                <div>
                                    <SwitchField
                                        name='subscription.alert'
                                        label='Unpaid Invoice Alert'
                                        description='Display an alert on the server page when a subscription is about to expire or has expired.'
                                    />
                                    <p className='text-xs text-red-400 font-medium rounded-component flex items-start gap-x-1 mt-2'>
                                        <ExclamationCircleIcon className='w-3 shrink-0 mt-0.5' />
                                        Updates after saving (not shown in Live Preview)
                                    </p>
                                </div>
                            </BorderedBox>
                            <BorderedBox title='Trashbin'>
                                <SwitchField
                                    name='trashbin'
                                    label='Enable Trashbin'
                                    description='When enabled, deleted files/folders will be moved to a trashbin instead of being permanently deleted.'
                                />
                                <Field
                                    name='gracePeriod'
                                    label='Grace Period'
                                    type='number'
                                    description='The number of days files/folders will remain in the trashbin before being automatically and permanently deleted.'
                                />
                            </BorderedBox>
                            <BorderedBox title='Admin Theme'>
                                <SwitchField
                                    label='Admin Theme'
                                    description='Toggle the admin theme to default or Arix Theme'
                                    name='adminTheme'
                                />
                            </BorderedBox>
                            <BorderedBox title='Profile Customization'>
                                <SwitchField
                                    name='profileCustomization.username'
                                    label='Username Customization'
                                    description='Allow to customize their username.'
                                />
                                <SwitchField
                                    name='profileCustomization.name'
                                    label='Name Customization'
                                    description='Allow users to customize their first- and last names.'
                                />
                                <SwitchField
                                    name='profileCustomization.email'
                                    label='Email Customization'
                                    description='Allow users to customize their email.'
                                />
                            </BorderedBox>
                            <BorderedBox title='Languages'>
                                <SwitchField name='langSwitch' label='Language Switcher' />
                                <SelectField
                                    name='defaultLang'
                                    label='Default Language'
                                    options={languages.map((option) => ({
                                        label: option.name || option.key,
                                        value: option.key,
                                    }))}
                                />
                                <div>
                                    <Label>Select Languages</Label>
                                    <div className='grid lg:grid-cols-2 gap-2'>
                                        {Object.entries(data.availableLanguages).map(([key, name]) => (
                                            <label
                                                key={key}
                                                className={classNames(
                                                    styles.button,
                                                    styles.text,
                                                    'flex items-center !justify-between'
                                                )}
                                            >
                                                {name || key}
                                                <Input
                                                    type='checkbox'
                                                    checked={Boolean(languages.find((option) => option.key === key))}
                                                    onChange={() => {
                                                        const updatedLanguages = [...languages];
                                                        const index = updatedLanguages.findIndex(
                                                            (option) => option.key === key
                                                        );
                                                        if (index !== -1) {
                                                            updatedLanguages.splice(index, 1);
                                                        } else {
                                                            updatedLanguages.push({
                                                                key: key,
                                                                name: name || key,
                                                            });
                                                        }
                                                        setLanguages(updatedLanguages);
                                                    }}
                                                    name={`availableLanguages.${key}`}
                                                />
                                            </label>
                                        ))}
                                    </div>
                                    <p className='text-xs text-red-400 font-medium rounded-component flex items-start gap-x-1 mt-2'>
                                        <ExclamationCircleIcon className='w-3 shrink-0 mt-0.5' />
                                        Updates after saving (not shown in Live Preview)
                                    </p>
                                </div>
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
