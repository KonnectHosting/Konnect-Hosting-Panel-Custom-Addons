import { Formik } from 'formik';
import React, { useEffect, useState } from 'react';
import EditorWrapper from '../elements/EditorWrapper';
import { Button } from '@/components/elements/button/index';
import Spinner from '@/components/elements/Spinner';
import FlashMessageRender from '@/components/FlashMessageRender';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import FormPreviewHashSync from '@/plugins/FormPreviewHashSync';
import getSocial, { SocialSettings, updateSocial } from '@/api/admin/Social';
import BorderedBox from '../elements/BorderedBox';
import SwitchField from '@/components/elements/SwitchField';
import {
    LuCreditCard,
    LuGithub,
    LuInstagram,
    LuLifeBuoy,
    LuLinkedin,
    LuRouter,
    LuTwitter,
    LuYoutube,
} from 'react-icons/lu';
import { RxDiscordLogo } from 'react-icons/rx';
import Input from '@/components/elements/Input';
import { ExclamationCircleIcon, ExternalLinkIcon, PlusIcon } from '@heroicons/react/outline';
import { Dialog } from '@/components/elements/dialog';
import Label from '@/components/elements/Label';

interface SocialFormValues {
    socialButtons: boolean;
    discordBox: boolean;
}

const ICON_MAP = {
    billing: LuCreditCard,
    status: LuRouter,
    support: LuLifeBuoy,
    discord: RxDiscordLogo,
    twitter: LuTwitter,
    instagram: LuInstagram,
    linkedin: LuLinkedin,
    youtube: LuYoutube,
    github: LuGithub,
} as const;

interface ConfigureSocialProps {
    title: string;
    description: string;
    icon: string;
    url: string;
}

const ConfigureSocial = ({
    socialLinks,
    setSocialLinks,
}: {
    socialLinks: ConfigureSocialProps[] | null;
    setSocialLinks: React.Dispatch<React.SetStateAction<ConfigureSocialProps[] | null>>;
}) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [social, setSocial] = useState<ConfigureSocialProps>({
        title: '',
        description: '',
        icon: '',
        url: '',
    });
    const [socialIndex, setSocialIndex] = useState(0);

    const openDialog = (index: number) => {
        if (!socialLinks) return;
        setSocial(socialLinks[index]);
        setSocialIndex(index);
        setIsDialogOpen(true);
    };

    return (
        <React.Fragment>
            <Dialog title='Edit Social Button' open={isDialogOpen} onClose={() => setIsDialogOpen(false)}>
                <Label htmlFor='title'>Icon</Label>
                <div className='grid grid-cols-9 gap-2'>
                    {Object.entries(ICON_MAP).map(([iconName, IconComponent]) => (
                        <Button.Text
                            key={iconName}
                            onClick={() => {
                                setSocial((prev) => ({
                                    ...prev,
                                    icon: iconName,
                                }));
                            }}
                            className={social.icon === iconName ? '!text-arix !bg-secondary-100' : ''}
                        >
                            <IconComponent size={16} />
                        </Button.Text>
                    ))}
                </div>

                <Label htmlFor='title' className='mt-4'>
                    Title
                </Label>
                <Input
                    id='title'
                    value={social.title}
                    onChange={(e) => {
                        setSocial((prev) => ({
                            ...prev,
                            title: e.target.value,
                        }));
                    }}
                    placeholder='Title'
                />

                <Label htmlFor='description' className='mt-4'>
                    Description
                </Label>
                <Input
                    id='description'
                    value={social.description}
                    onChange={(e) => {
                        setSocial((prev) => ({
                            ...prev,
                            description: e.target.value,
                        }));
                    }}
                    placeholder='Description'
                />

                <Label htmlFor='url' className='mt-4'>
                    URL
                </Label>
                <Input
                    id='url'
                    value={social.url}
                    onChange={(e) => {
                        setSocial((prev) => ({
                            ...prev,
                            url: e.target.value,
                        }));
                    }}
                    placeholder='URL'
                />

                <Dialog.Footer>
                    <Button.Danger
                        variant={Button.Variants.Secondary}
                        onClick={() => {
                            if (!socialLinks) return;

                            setSocialLinks(socialLinks.filter((_, index) => index !== socialIndex));
                            setIsDialogOpen(false);
                        }}
                    >
                        Delete
                    </Button.Danger>
                    <Button
                        onClick={() => {
                            if (!socialLinks) return;

                            const updatedLinks = [...socialLinks];
                            updatedLinks[socialIndex] = social;

                            setSocialLinks(updatedLinks);
                            setIsDialogOpen(false);
                        }}
                    >
                        Update
                    </Button>
                </Dialog.Footer>
            </Dialog>
            <div className='space-y-2 pt-4'>
                <div className='flex justify-between'>
                    <p className='text-sm text-gray-300'>Social Buttons</p>
                    <p className='text-sm text-gray-300'>{socialLinks ? socialLinks.length : 0}/5</p>
                </div>
                {socialLinks?.map((social, socialIndex) => (
                    <div key={socialIndex} className='px-5 py-4 rounded-component border border-gray-500'>
                        <div className='flex items-center justify-between'>
                            <div>
                                <a
                                    href={social.url}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='font-medium flex items-center gap-x-1 text-gray-100'
                                >
                                    {social.title}
                                    <ExternalLinkIcon className='w-4' />
                                </a>
                                <p className='text-sm'>{social.description}</p>
                            </div>
                            {social.icon &&
                                React.createElement(ICON_MAP[social.icon as keyof typeof ICON_MAP] || LuRouter, {
                                    size: 32,
                                    className: 'text-arix',
                                })}
                        </div>
                        <Button.Text
                            className='w-full mt-2'
                            size={Button.Sizes.Small}
                            onClick={() => openDialog(socialIndex)}
                        >
                            Edit Button
                        </Button.Text>
                    </div>
                ))}
                <Button.Text
                    variant={Button.Variants.Secondary}
                    size={Button.Sizes.Small}
                    className='flex items-center gap-x-1 w-full'
                    disabled={socialLinks ? socialLinks.length >= 5 : false}
                    onClick={() =>
                        setSocialLinks([
                            ...(socialLinks || []),
                            { title: 'New Link', description: 'Click now!', icon: 'billing', url: '/' },
                        ])
                    }
                >
                    New Social Button
                    <PlusIcon className='w-4' />
                </Button.Text>
                <p className='text-xs text-red-400 font-medium rounded-component flex items-start gap-x-1 mt-2'>
                    <ExclamationCircleIcon className='w-3 shrink-0 mt-0.5' />
                    Updates after saving (not shown in Live Preview)
                </p>
            </div>
        </React.Fragment>
    );
};

export default () => {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<SocialSettings | null>(null);
    const { clearFlashes, addFlash } = useFlash();
    const [previewHash, setPreviewHash] = useState('');
    const [socialLinks, setSocialLinks] = useState<
        | {
              title: string;
              description: string;
              icon: string;
              url: string;
          }[]
        | null
    >(null);

    useEffect(() => {
        clearFlashes();
    }, []);

    useEffect(() => {
        getSocial()
            .then((data) => {
                setData(data);
                setSocialLinks(data.socials);
                setIsLoading(false);
            })
            .catch((error) => {
                clearFlashes();
                addFlash({ type: 'error', message: httpErrorToHuman(error) });
                setIsLoading(false);
            });
    }, []);

    const handleSubmit = (values: SocialFormValues) => {
        clearFlashes();

        const payload: SocialSettings = {
            socials: socialLinks ?? [],
            socialButtons: Boolean(values.socialButtons),
            discordBox: Boolean(values.discordBox),
        };

        return updateSocial(payload)
            .then((updated) => {
                setData(updated ?? payload);
                addFlash({ type: 'success', message: 'Social settings updated successfully.' });
            })
            .catch((error) => {
                addFlash({ type: 'error', message: httpErrorToHuman(error) });
            });
    };

    const initialValues: SocialFormValues = {
        socialButtons: Boolean(data?.socialButtons),
        discordBox: Boolean(data?.discordBox),
    };

    return (
        <EditorWrapper title='Social Settings' previewHash={previewHash}>
            <FlashMessageRender />
            {isLoading || !data ? (
                <Spinner size='large' centered />
            ) : (
                <Formik<SocialFormValues> initialValues={initialValues} enableReinitialize onSubmit={handleSubmit}>
                    {({ isSubmitting, submitForm, values }) => (
                        <React.Fragment>
                            <FormPreviewHashSync
                                prefix={'arix-social'}
                                initialValues={initialValues}
                                onHashChange={setPreviewHash}
                            />
                            <BorderedBox title='Discord Box'>
                                <SwitchField
                                    name='discordBox'
                                    label='Enable Discord Box'
                                    description='Toggle the display of the Discord box on the home page.'
                                />
                            </BorderedBox>
                            <BorderedBox title='Social Buttons'>
                                <div>
                                    <SwitchField
                                        name='socialButtons'
                                        label='Enable Social Buttons'
                                        description='Toggle the display of social media buttons in the footer.'
                                    />
                                    <div
                                        className={`overflow-hidden duration-300 ${
                                            values.socialButtons ? 'max-h-screen' : 'max-h-0'
                                        }`}
                                    >
                                        <ConfigureSocial socialLinks={socialLinks} setSocialLinks={setSocialLinks} />
                                    </div>
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
