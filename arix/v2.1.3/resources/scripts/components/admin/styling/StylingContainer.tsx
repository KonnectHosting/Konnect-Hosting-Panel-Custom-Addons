import Field from '@/components/elements/Field';
import { Formik } from 'formik';
import React, { useEffect, useState } from 'react';
import EditorWrapper from '../elements/EditorWrapper';
import BorderedBox from '../elements/BorderedBox';
import SwitchField from '@/components/elements/SwitchField';
import { Button } from '@/components/elements/button/index';
import Spinner from '@/components/elements/Spinner';
import FlashMessageRender from '@/components/FlashMessageRender';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import FormPreviewHashSync from '@/plugins/FormPreviewHashSync';
import getStyling, { StylingSettings, updateStyling } from '@/api/admin/Styling';
import OptionField from '../elements/OptionField';
import Label from '@/components/elements/Label';
import SliderField from '../elements/SliderField';
import { ExclamationCircleIcon, InformationCircleIcon, TerminalIcon } from '@heroicons/react/outline';
import SelectField from '../elements/SelectField';
import Input from '@/components/elements/Input';
import tw, { styled } from 'twin.macro';

const DropAnimation = styled.div`
    animation: dropAnimation 2s infinite;

    @keyframes dropAnimation {
        0% {
            transform: translateY(0px);
        }
        25% {
            transform: translateY(5px);
        }
        40% {
            transform: translateY(5px);
        }
        60% {
            transform: translateY(0px);
        }
    }
`;
const ShrinkAnimation = styled.div`
    animation: shrinkAnimation 2s infinite;

    @keyframes shrinkAnimation {
        0% {
            transform: scale(1);
        }
        25% {
            transform: scale(0.9);
        }
        40% {
            transform: scale(0.9);
        }
        60% {
            transform: scale(1);
        }
    }
`;
const OutlineAnimation = styled.div`
    ${tw`rounded-component`}
    animation: outlineAnimation 2s infinite;

    @keyframes outlineAnimation {
        0% {
            ${tw`ring-[0px] ring-offset-2 ring-offset-gray-600 ring-secondary-100`};
        }
        25% {
            ${tw`ring-[2px] ring-offset-2 ring-offset-gray-600 ring-secondary-100`};
        }
        40% {
            ${tw`ring-[2px] ring-offset-2 ring-offset-gray-600 ring-secondary-100`};
        }
        60% {
            ${tw`ring-[0px] ring-offset-2 ring-offset-gray-600 ring-secondary-100`};
        }
    }
`;
const FadeUp = styled.div`
    ${tw`relative bg-gray-400 border flex items-center justify-center border-gray-300 rounded h-16 w-full`};
    animation: fadeUp 2s infinite;

    @keyframes fadeUp {
        0% {
            transform: translateY(0px);
            opacity: 1;
        }
        25% {
            transform: translateY(6px);
            opacity: 0;
        }
        50% {
            transform: translateY(0px);
            opacity: 1;
        }
    }
`;
const FadeIn = styled.div`
    ${tw`relative bg-gray-400 border flex items-center justify-center border-gray-300 rounded h-16 w-full`};
    animation: fadeIn 2s infinite;

    @keyframes fadeIn {
        0% {
            opacity: 1;
        }
        25% {
            opacity: 0;
        }
        50% {
            opacity: 1;
        }
    }
`;
const FadeScale = styled.div`
    ${tw`relative bg-gray-400 border flex items-center justify-center border-gray-300 rounded h-16 w-full`};
    animation: fadeScale 2s infinite;

    @keyframes fadeScale {
        0% {
            transform: scale(1);
            opacity: 1;
        }
        25% {
            transform: scale(0.9);
            opacity: 0;
        }
        50% {
            transform: scale(1);
            opacity: 1;
        }
    }
`;

export default () => {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<StylingSettings | null>(null);
    const { clearFlashes, addFlash } = useFlash();
    const [previewHash, setPreviewHash] = useState('');

    useEffect(() => {
        clearFlashes();
    }, []);

    useEffect(() => {
        getStyling()
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

    const handleSubmit = (values: StylingSettings) => {
        clearFlashes();

        const payload: StylingSettings = {
            ...values,
            pageTitle: Boolean(values.pageTitle),
            background: Boolean(values.background),
            backdrop: Boolean(values.backdrop),
            backdropPercentage: Number(values.backdropPercentage),
            radiusInput: Number(values.radiusInput),
            radiusBox: Number(values.radiusBox),
            borderInput: Boolean(values.borderInput),
            borderBox: Boolean(values.borderBox),
            flashMessage: Number(values.flashMessage),
        };

        return updateStyling(payload)
            .then((updated) => {
                setData(updated ?? payload);
                addFlash({ type: 'success', message: 'Styling settings updated successfully.' });
            })
            .catch((error) => {
                addFlash({ type: 'error', message: httpErrorToHuman(error) });
            });
    };

    const initialValues: StylingSettings = {
        pageTitle: Boolean(data?.pageTitle),
        background: Boolean(data?.background),
        backgroundImage: data?.backgroundImage,
        backgroundImageLight: data?.backgroundImageLight,
        backgroundFaded: data?.backgroundFaded ?? 'default',
        loginBackground: data?.loginBackground,
        backdrop: Boolean(data?.backdrop),
        backdropPercentage: Number(data?.backdropPercentage),
        radiusInput: Number(data?.radiusInput),
        radiusBox: Number(data?.radiusBox),
        borderInput: Boolean(data?.borderInput),
        borderBox: Boolean(data?.borderBox),
        clickEffect: data?.clickEffect ?? 'drop',
        pageTransition: data?.pageTransition ?? 'fadeUp',
        flashMessage: Number(data?.flashMessage),
        font: data?.font ?? '',
    };

    return (
        <EditorWrapper title='Styling Settings' previewHash={previewHash} size='large'>
            <FlashMessageRender />
            {isLoading || !data ? (
                <Spinner size='large' centered />
            ) : (
                <Formik<StylingSettings> initialValues={initialValues} enableReinitialize onSubmit={handleSubmit}>
                    {({ isSubmitting, submitForm, values }) => (
                        <React.Fragment>
                            <FormPreviewHashSync
                                prefix={'arix-styling'}
                                initialValues={initialValues}
                                onHashChange={setPreviewHash}
                            />
                            <BorderedBox title={'General'}>
                                <SwitchField
                                    name='pageTitle'
                                    label='Page titles'
                                    description='Show page titles on the server pages.'
                                />
                                <div>
                                    <Label className='mb-2'>Flash Message Style</Label>
                                    <div className='flex gap-2'>
                                        <OptionField
                                            name='flashMessage'
                                            value={0}
                                            label='Default'
                                            image={
                                                <div className='p-4 w-full'>
                                                    <img
                                                        src='/arix/v2/styling/FlashMessageDefault.png'
                                                        alt='Default flash message style'
                                                        className='rounded-lg border border-gray-500'
                                                    />
                                                </div>
                                            }
                                        />
                                        <OptionField
                                            name='flashMessage'
                                            value={1}
                                            label='Glassy'
                                            image={
                                                <div className='p-4 w-full'>
                                                    <img
                                                        src='/arix/v2/styling/FlashMessageGlassy.png'
                                                        alt='Glassy flash message style'
                                                    />
                                                </div>
                                            }
                                        />
                                    </div>
                                </div>
                                <div>
                                    <SelectField
                                        name='font'
                                        label='Font Family'
                                        description='Select the font used in the panel.'
                                        options={[
                                            { label: 'Default', value: 'default' },
                                            { label: 'Poppins', value: 'poppins' },
                                            { label: 'DM Sans', value: 'dm_sans' },
                                            { label: 'Roboto', value: 'roboto' },
                                            { label: 'Science Gothic', value: 'sciencegothic' },
                                            { label: 'Inter', value: 'inter' },
                                            { label: 'Montserrat', value: 'montserrat' },
                                            { label: 'Open Sans', value: 'open_sans' },
                                            { label: 'Lato', value: 'lato' },
                                            { label: 'Nunito', value: 'nunito' },
                                            { label: 'Oswald', value: 'oswald' },
                                            { label: 'Playfair Display', value: 'playfair' },
                                            { label: 'Source Sans Pro', value: 'source_sans' },
                                            { label: 'Quicksand', value: 'quicksand' },
                                            { label: 'Manrope', value: 'manrope' },
                                            { label: 'Space Grotesk', value: 'space_grotesk' },
                                        ]}
                                    />
                                    <p className='text-xs text-red-400 font-medium rounded-component flex items-start gap-x-1 mt-2'>
                                        <ExclamationCircleIcon className='w-3 shrink-0 mt-0.5' />
                                        Updates after saving (not shown in Live Preview)
                                    </p>
                                </div>
                            </BorderedBox>
                            <BorderedBox
                                title='Background'
                                description='Customize the background images used in the panel.'
                            >
                                <div>
                                    <SwitchField
                                        name='background'
                                        label='Enable custom background'
                                        description='When enabled, a custom background image can be set for the panel.'
                                    />
                                    <div
                                        className={`overflow-hidden mb-6 duration-300 ${
                                            values.background ? 'max-h-screen' : 'max-h-0'
                                        }`}
                                    >
                                        <div className='pt-6 space-y-6'>
                                            <Field
                                                name='backgroundImage'
                                                label='Background image URL (Dark Theme)'
                                                description='The URL of the background image to use in darkmode.'
                                                placeholder='https://example.com/image.jpg'
                                            />
                                            <Field
                                                name='backgroundImageLight'
                                                label='Background image URL (Light Theme)'
                                                description='The URL of the background image to use in lightmode.'
                                                placeholder='https://example.com/image.jpg'
                                            />
                                            <div>
                                                <Label className='mb-2'>Background Style</Label>
                                                <div className='flex gap-2'>
                                                    <OptionField
                                                        name='backgroundFaded'
                                                        value={'default'}
                                                        label='Default'
                                                        image={
                                                            <img
                                                                src='/arix/v2/styling/backgroundDefault.png'
                                                                alt='Default background style'
                                                            />
                                                        }
                                                    />
                                                    <OptionField
                                                        name='backgroundFaded'
                                                        value={'translucent'}
                                                        label='Translucent'
                                                        image={
                                                            <img
                                                                src='/arix/v2/styling/backgroundTranslucent.png'
                                                                alt='Translucent background style'
                                                            />
                                                        }
                                                    />
                                                    <OptionField
                                                        name='backgroundFaded'
                                                        value={'faded'}
                                                        label='Faded'
                                                        image={
                                                            <img
                                                                src='/arix/v2/styling/backgroundFaded.png'
                                                                alt='Faded background style'
                                                            />
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <Field
                                        name='loginBackground'
                                        label='Login background image URL'
                                        description='Leave empty to disable background image on the login page.'
                                        placeholder='https://example.com/image.jpg'
                                    />
                                </div>
                            </BorderedBox>
                            <BorderedBox
                                title={'Blocks Styling'}
                                description={'Customize the appearance of the blocks.'}
                            >
                                <SliderField
                                    name='radiusBox'
                                    label='Border Radius'
                                    min={0}
                                    max={32}
                                    indicators={['0px', '4px', '8px', '12px', '16px', '20px', '24px', '28px', '32px']}
                                />
                                <div className='bg-arix/20 border border-arix text-gray-100 px-5 py-4 flex gap-x-1 items-start rounded-component'>
                                    <InformationCircleIcon className='w-5 shrink-0 text-white' />
                                    <div>
                                        <p className='text-sm font-medium text-white'>Glassy Effect</p>
                                        <p className='text-sm'>
                                            To get Glassy Effect on your panel we recommend setting the "block
                                            transparancy" to 80%, enable "Glassy Effect" and enable "Block Border"
                                        </p>
                                    </div>
                                </div>
                                <SliderField
                                    name='backdropPercentage'
                                    label='Block Transparency'
                                    min={0}
                                    max={100}
                                    indicators={['0%', '20%', '40%', '60%', '80%', '100%']}
                                />
                                <div>
                                    <Label className='mb-2'>Glassy Effect</Label>
                                    <div className='flex gap-2'>
                                        <OptionField
                                            name='backdrop'
                                            value={false}
                                            label='Disabled'
                                            image={
                                                <img
                                                    src='/arix/v2/styling/blurFalse.png'
                                                    alt='Glassy effect disabled'
                                                    className='rounded-lg border border-gray-500'
                                                />
                                            }
                                        />
                                        <OptionField
                                            name='backdrop'
                                            value={true}
                                            label='Enabled'
                                            image={
                                                <img
                                                    src='/arix/v2/styling/blurTrue.png'
                                                    alt='Glassy effect enabled'
                                                    className='rounded-lg border border-gray-500'
                                                />
                                            }
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label className='mb-2'>Block Border</Label>
                                    <div className='flex gap-2'>
                                        <OptionField
                                            name='borderBox'
                                            value={true}
                                            label='Enabled'
                                            image={
                                                <div className='h-28 pl-6 pt-6 w-full bg-gray-800'>
                                                    <div className='w-full h-full border border-gray-600 bg-gray-700 rounded-box !rounded-r-none !rounded-b-none px-6 py-5'>
                                                        <p className='text-lg font-medium text-gray-300'>With Border</p>
                                                    </div>
                                                </div>
                                            }
                                        />
                                        <OptionField
                                            name='borderBox'
                                            value={false}
                                            label='Disabled'
                                            image={
                                                <div className='h-28 pl-6 pt-6 w-full bg-gray-800'>
                                                    <div className='w-full h-full bg-gray-700 rounded-box !rounded-r-none !rounded-b-none px-6 py-5'>
                                                        <p className='text-lg font-medium text-gray-300'>
                                                            Without Border
                                                        </p>
                                                    </div>
                                                </div>
                                            }
                                        />
                                    </div>
                                </div>
                            </BorderedBox>
                            <BorderedBox
                                title={'Elements Styling'}
                                description={
                                    'Customize the appearance of the input, buttons, and other interactive elements.'
                                }
                            >
                                <SliderField
                                    name='radiusInput'
                                    label='Border Radius'
                                    min={0}
                                    max={16}
                                    indicators={['0px', '2px', '4px', '6px', '8px', '10px', '12px', '14px', '16px']}
                                />
                                <div>
                                    <Label className='mb-2'>Input Border</Label>
                                    <div className='flex gap-2'>
                                        <OptionField
                                            name='borderInput'
                                            value={true}
                                            label='Enabled'
                                            image={
                                                <div className='h-28 pl-6 py-5 w-full bg-gray-700 pointer-events-none'>
                                                    <Label>With Border</Label>
                                                    <Input
                                                        placeholder='With border'
                                                        style={{ border: '1px solid', borderRight: '0px solid' }}
                                                        className='!rounded-r-none'
                                                    />
                                                </div>
                                            }
                                        />
                                        <OptionField
                                            name='borderInput'
                                            value={false}
                                            label='Disabled'
                                            image={
                                                <div className='h-28 pl-6 py-5 w-full bg-gray-700 pointer-events-none'>
                                                    <Label>Without Border</Label>
                                                    <Input
                                                        placeholder='Without border'
                                                        style={{ border: '0px solid' }}
                                                        className='!rounded-r-none'
                                                    />
                                                </div>
                                            }
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label className='mb-2'>Button Click Effect</Label>
                                    <div className='flex gap-2'>
                                        <OptionField
                                            name='clickEffect'
                                            value={'drop'}
                                            label='Drop'
                                            image={
                                                <div className='py-4 pointer-events-none'>
                                                    <DropAnimation className='relative'>
                                                        <Button.Text>Create</Button.Text>
                                                    </DropAnimation>
                                                </div>
                                            }
                                        />
                                        <OptionField
                                            name='clickEffect'
                                            value={'shrink'}
                                            label='Shrink'
                                            image={
                                                <div className='py-4 pointer-events-none'>
                                                    <ShrinkAnimation className='relative'>
                                                        <Button.Text>Create</Button.Text>
                                                    </ShrinkAnimation>
                                                </div>
                                            }
                                        />
                                        <OptionField
                                            name='clickEffect'
                                            value={'outline'}
                                            label='Outline'
                                            image={
                                                <div className='py-4 pointer-events-none'>
                                                    <OutlineAnimation className='relative'>
                                                        <Button.Text>Create</Button.Text>
                                                    </OutlineAnimation>
                                                </div>
                                            }
                                        />
                                    </div>
                                </div>
                            </BorderedBox>
                            <BorderedBox
                                title='Page Transition'
                                description='Customize the page animation when switching between pages.'
                            >
                                <div className='flex gap-2'>
                                    <OptionField
                                        name='pageTransition'
                                        value={'fadeScale'}
                                        label='Fade Scale'
                                        image={
                                            <div className='p-4 w-full'>
                                                <div className='flex rounded gap-2 border border-gray-300 overflow-hidden pr-2 items-center'>
                                                    <div className='h-20 w-10 border-r border-gray-300' />
                                                    <FadeScale>
                                                        <TerminalIcon className='w-6' />
                                                    </FadeScale>
                                                </div>
                                            </div>
                                        }
                                    />
                                    <OptionField
                                        name='pageTransition'
                                        value={'fadeUp'}
                                        label='Fade Up'
                                        image={
                                            <div className='p-4 w-full'>
                                                <div className='flex rounded gap-2 border border-gray-300 overflow-hidden pr-2 items-center'>
                                                    <div className='h-20 w-10 border-r border-gray-300' />
                                                    <FadeUp>
                                                        <TerminalIcon className='w-6' />
                                                    </FadeUp>
                                                </div>
                                            </div>
                                        }
                                    />
                                    <OptionField
                                        name='pageTransition'
                                        value={'fadeIn'}
                                        label='Fade In'
                                        image={
                                            <div className='p-4 w-full'>
                                                <div className='flex rounded gap-2 border border-gray-300 overflow-hidden pr-2 items-center'>
                                                    <div className='h-20 w-10 border-r border-gray-300' />
                                                    <FadeIn>
                                                        <TerminalIcon className='w-6' />
                                                    </FadeIn>
                                                </div>
                                            </div>
                                        }
                                    />
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
