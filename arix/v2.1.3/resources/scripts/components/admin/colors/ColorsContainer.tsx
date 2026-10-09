import { Formik } from 'formik';
import React, { useEffect, useState } from 'react';
import EditorWrapper from '../elements/EditorWrapper';
import BorderedBox from '../elements/BorderedBox';
import { Button } from '@/components/elements/button/index';
import Spinner from '@/components/elements/Spinner';
import FlashMessageRender from '@/components/FlashMessageRender';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import getColors, { ColorSettings, updateColors } from '@/api/admin/Colors';
import ColorField from '../elements/ColorField';

type ColorGroup = {
    title: string;
    fields: Array<{ key: string; label: string; description?: string }>;
};

type ColorPreset = {
    dark?: Partial<ColorSettings['dark']>;
    light?: Partial<ColorSettings['light']>;
};

const COLOR_GROUPS: ColorGroup[] = [
    {
        title: 'Primary',
        fields: [{ key: 'primary', label: 'Primary Color' }],
    },
    {
        title: 'Secondary',
        fields: [
            { key: 'secondaryText', label: 'Secondary Text' },
            { key: 'secondaryBorder', label: 'Secondary Border' },
            { key: 'secondaryBackground', label: 'Secondary Background' },
        ],
    },
    {
        title: 'Success',
        fields: [
            { key: 'successText', label: 'Success Text' },
            { key: 'successBorder', label: 'Success Border' },
            { key: 'successBackground', label: 'Success Background' },
        ],
    },
    {
        title: 'Danger',
        fields: [
            { key: 'dangerText', label: 'Danger Text' },
            { key: 'dangerBorder', label: 'Danger Border' },
            { key: 'dangerBackground', label: 'Danger Background' },
        ],
    },
    {
        title: 'Grays',
        fields: [
            { key: 'gray50', label: 'Gray 50' },
            { key: 'gray100', label: 'Gray 100' },
            { key: 'gray200', label: 'Gray 200' },
            { key: 'gray300', label: 'Gray 300' },
            { key: 'gray400', label: 'Gray 400' },
            { key: 'gray500', label: 'Gray 500' },
            { key: 'gray600', label: 'Gray 600' },
            { key: 'gray700', label: 'Gray 700' },
            { key: 'gray800', label: 'Gray 800' },
            { key: 'gray900', label: 'Gray 900' },
        ],
    },
];

const COLOR_KEYS = COLOR_GROUPS.flatMap((group) => group.fields.map((field) => field.key));

const COLOR_PRESETS: Record<string, ColorPreset> = {
    Default: {
        dark: {
            primary: '#4d35eb',

            secondaryText: '#B2B2C1',
            secondaryBorder: '#31314b',
            secondaryBackground: '#21213b',

            successText: '#E1FFD8',
            successBorder: '#2bab32',
            successBackground: '#1f8f2b',

            dangerText: '#FFD8D8',
            dangerBorder: '#ab2b40',
            dangerBackground: '#8f1f37',

            gray50: '#F4F4F4',
            gray100: '#D5D5DB',
            gray200: '#B2B2C1',
            gray300: '#8282A4',
            gray400: '#5E5E7F',
            gray500: '#3c3c5d',
            gray600: '#2b2b48',
            gray700: '#1a1a2f',
            gray800: '#0c0d21',
            gray900: '#040519',
        },
        light: {
            primary: '#4d35eb',

            secondaryText: '#46464D',
            secondaryBorder: '#C0C0D3',
            secondaryBackground: '#A6A7BD',

            successText: '#E1FFD8',
            successBorder: '#2bab32',
            successBackground: '#1f8f2b',

            dangerText: '#FFD8D8',
            dangerBorder: '#ab2b40',
            dangerBackground: '#8f1f37',

            gray50: '#141415',
            gray100: '#27272C',
            gray200: '#46464D',
            gray300: '#626272',
            gray400: '#757689',
            gray500: '#A6A7BD',
            gray600: '#C0C0D3',
            gray700: '#e7e7ef',
            gray800: '#F0F1F5',
            gray900: '#FFFFFF',
        },
    },
    'Original Arix': {
        dark: {
            primary: '#4A35CF',

            secondaryText: '#B2B2C1',
            secondaryBorder: '#42425B',
            secondaryBackground: '#2B2B40',

            successText: '#E1FFD8',
            successBorder: '#56AA2B',
            successBackground: '#3D8F1F',

            dangerText: '#FFD8D8',
            dangerBorder: '#AA2A2A',
            dangerBackground: '#8F1F20',

            gray50: '#F4F4F4',
            gray100: '#D5D5DB',
            gray200: '#B2B2C1',
            gray300: '#8282A4',
            gray400: '#5E5E7F',
            gray500: '#42425B',
            gray600: '#2B2B40',
            gray700: '#1D1D37',
            gray800: '#0B0D2A',
            gray900: '#040519',
        },
        light: {
            primary: '#4A35CF',

            secondaryText: '#46464D',
            secondaryBorder: '#C0C0D3',
            secondaryBackground: '#A6A7BD',

            successText: '#E1FFD8',
            successBorder: '#56AA2B',
            successBackground: '#3D8F1F',

            dangerText: '#FFD8D8',
            dangerBorder: '#AA2A2A',
            dangerBackground: '#8F1F20',

            gray50: '#141415',
            gray100: '#27272C',
            gray200: '#46464D',
            gray300: '#626272',
            gray400: '#757689',
            gray500: '#A6A7BD',
            gray600: '#C0C0D3',
            gray700: '#e7e7ef',
            gray800: '#F0F1F5',
            gray900: '#FFFFFF',
        },
    },
    Muted: {
        dark: {
            primary: '#b5838d',

            secondaryText: '#bfb6c9',
            secondaryBorder: '#4f4954',
            secondaryBackground: '#37333b',

            gray50: '#e5deec',
            gray100: '#e3dbeb',
            gray200: '#bfb6c9',
            gray300: '#9f93ab',
            gray400: '#71667c',
            gray500: '#4f4954',
            gray600: '#37333b',
            gray700: '#2c292f',
            gray800: '#221f25',
            gray900: '#060506',
        },
        light: {
            primary: '#b5838d',
        },
    },
    Slate: {
        dark: {
            primary: '#03a871',

            secondaryText: '#bcc2c9',
            secondaryBorder: '#4c535c',
            secondaryBackground: '#3e464c',

            gray50: '#ffffff',
            gray100: '#f8f9fa',
            gray200: '#bcc2c9',
            gray300: '#c6ced5',
            gray400: '#98a1ab',
            gray500: '#4c535c',
            gray600: '#333941',
            gray700: '#23262c',
            gray800: '#121417',
            gray900: '#212529',
        },
        light: {
            primary: '#03a871',
        },
    },
    Steel: {
        dark: {
            primary: '#008791',

            secondaryText: '#a3a3b4',
            secondaryBorder: '#52525c',
            secondaryBackground: '#3f3f46',

            gray50: '#F4F4F4',
            gray100: '#c2c2d3',
            gray200: '#a3a3b4',
            gray300: '#a3a3b4',
            gray400: '#9191a0',
            gray500: '#52525c',
            gray600: '#3f3f46',
            gray700: '#242428',
            gray800: '#111113',
            gray900: '#000000',
        },
        light: {
            primary: '#008791',
        },
    },
    Earthy: {
        dark: {
            primary: '#548900',

            secondaryText: '#8a9a9e',
            secondaryBorder: '#495b65',
            secondaryBackground: '#2f3e46',

            gray50: '#f5f5f5',
            gray100: '#c3d3d9',
            gray200: '#8a9a9e',
            gray300: '#93a7b1',
            gray400: '#6d818c',
            gray500: '#495b65',
            gray600: '#2f3e46',
            gray700: '#171f24',
            gray800: '#111517',
            gray900: '#000000',
        },
        light: {
            primary: '#548900',
        },
    },
    Ocean: {
        dark: {
            primary: '#38a3a5',

            secondaryText: '#aab9b3',
            secondaryBorder: '#214b64',
            secondaryBackground: '#113244',

            gray50: '#e4eeea',
            gray100: '#cdded7',
            gray200: '#aab9b3',
            gray300: '#6a7e8d',
            gray400: '#426072',
            gray500: '#214b64',
            gray600: '#113244',
            gray700: '#072130',
            gray800: '#031926',
            gray900: '#000406',
        },
        light: {
            primary: '#38a3a5',
        },
    },
    Forest: {
        dark: {
            primary: '#2b9348',

            secondaryText: '#879f8c',
            secondaryBorder: '#2a402c',
            secondaryBackground: '#1d301f',

            gray50: '#deeae0',
            gray100: '#acc8b1',
            gray200: '#879f8c',
            gray300: '#799b7f',
            gray400: '#628064',
            gray500: '#2a402c',
            gray600: '#1d301f',
            gray700: '#142116',
            gray800: '#0c140d',
            gray900: '#0b130c',
        },
        light: {
            primary: '#2b9348',
        },
    },
    Rocky: {
        dark: {
            primary: '#1775e3',

            secondaryText: '#b2b2c2',
            secondaryBorder: '#3c3e4a',
            secondaryBackground: '#292c33',

            gray50: '#f5f5f5',
            gray100: '#d5d6db',
            gray200: '#b2b2c2',
            gray300: '#a5a9c2',
            gray400: '#6b6b82',
            gray500: '#3c3e4a',
            gray600: '#292c33',
            gray700: '#14141a',
            gray800: '#08090a',
            gray900: '#010102',
        },
        light: {
            primary: '#1775e3',
        },
    },
    Cherry: {
        dark: {
            primary: '#a53860',

            secondaryText: '#d0a6b7',
            secondaryBorder: '#4f2935',
            secondaryBackground: '#361b23',

            gray50: '#f3dce5',
            gray100: '#d7b4c2',
            gray200: '#d0a6b7',
            gray300: '#cd92a4',
            gray400: '#9a5f71',
            gray500: '#4f2935',
            gray600: '#361b23',
            gray700: '#251319',
            gray800: '#1a0c11',
            gray900: '#050203',
        },
        light: {
            primary: '#a53860',
        },
    },
    Strawberry: {
        dark: {
            primary: '#e3174e',

            secondaryText: '#c2b2b2',
            secondaryBorder: '#4b3d3d',
            secondaryBackground: '#322828',

            gray50: '#f5f5f5',
            gray100: '#dbd5d5',
            gray200: '#c2b2b2',
            gray300: '#c2a5a5',
            gray400: '#816a6a',
            gray500: '#4b3d3d',
            gray600: '#322828',
            gray700: '#1a1414',
            gray800: '#0b0909',
            gray900: '#000000',
        },
        light: {
            primary: '#e3174e',
        },
    },
    Catppuccin: {
        dark: {
            primary: '#b06352',

            secondaryText: '#B2B2C1',
            secondaryBorder: '#404058',
            secondaryBackground: '#29293d',

            gray50: '#F4F4F4',
            gray100: '#D5D5DB',
            gray200: '#B2B2C1',
            gray300: '#7e7ea0',
            gray400: '#5d5d7b',
            gray500: '#404058',
            gray600: '#29293d',
            gray700: '#1c1c2b',
            gray800: '#14141f',
            gray900: '#181825',
        },
        light: {
            primary: '#b06352',
        },
    },
    Discord: {
        dark: {
            primary: '#5765f2',

            secondaryText: '#bbbbbb',
            secondaryBorder: '#404149',
            secondaryBackground: '#2e2f35',

            gray50: '#F4F4F4',
            gray100: '#D5D5DB',
            gray200: '#bbbbbb',
            gray300: '#aaaab1',
            gray400: '#78787c',
            gray500: '#404149',
            gray600: '#2e2f35',
            gray700: '#242428',
            gray800: '#1a1a1e',
            gray900: '#121214',
        },
        light: {
            primary: '#5765f2',
        },
    },
    Monokai: {
        dark: {
            primary: '#b48700',

            secondaryText: '#9d9d9d',
            secondaryBorder: '#484649',
            secondaryBackground: '#3a373b',

            gray50: '#eee2da',
            gray100: '#c8c4ca',
            gray200: '#9d9d9d',
            gray300: '#8e8b8f',
            gray400: '#6d6770',
            gray500: '#484649',
            gray600: '#3a373b',
            gray700: '#2c2a2e',
            gray800: '#211f22',
            gray900: '#1b1a1c',
        },
        light: {
            primary: '#b48700',
        },
    },
    Dracula: {
        dark: {
            primary: '#7d00f3',

            secondaryText: '#B2B2C1',
            secondaryBorder: '#3b3e4c',
            secondaryBackground: '#282a36',

            gray50: '#F4F4F4',
            gray100: '#D5D5DB',
            gray200: '#B2B2C1',
            gray300: '#8282A4',
            gray400: '#5E5E7F',
            gray500: '#3b3e4c',
            gray600: '#282a36',
            gray700: '#1c1b21',
            gray800: '#0e0d11',
            gray900: '#050506',
        },
        light: {
            primary: '#7d00f3',
        },
    },
    Solarized: {
        dark: {
            primary: '#009891',

            secondaryText: '#9fb4ba',
            secondaryBorder: '#163e47',
            secondaryBackground: '#042e37',

            gray50: '#d9e5e8',
            gray100: '#c6d5d9',
            gray200: '#9fb4ba',
            gray300: '#90aab2',
            gray400: '#586e75',
            gray500: '#163e47',
            gray600: '#042e37',
            gray700: '#01181e',
            gray800: '#000e12',
            gray900: '#000709',
        },
        light: {
            primary: '#009891',
        },
    },
};

const normalizeHexColor = (hex: string): string => {
    const cleanHex = hex.trim().replace('#', '');
    const normalized =
        cleanHex.length === 3
            ? cleanHex
                  .split('')
                  .map((char) => `${char}${char}`)
                  .join('')
            : cleanHex;

    if (!/^[\da-fA-F]{6}$/.test(normalized)) {
        return hex;
    }

    return `#${normalized.toLowerCase()}`;
};

const hexToRgbTriplet = (hex: string): string => {
    const normalizedHex = normalizeHexColor(hex);
    const cleanHex = normalizedHex.replace('#', '');

    if (!/^[\da-fA-F]{6}$/.test(cleanHex)) {
        return hex;
    }

    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);

    return `${r} ${g} ${b}`;
};

const previewColorValue = (key: string, value: string): string =>
    key === 'gray700' ? normalizeHexColor(value) : hexToRgbTriplet(value);

const buildModeCss = (selector: string, palette: ColorSettings['dark']): string => {
    const variables = COLOR_KEYS.map((key) => {
        const value = previewColorValue(key, palette[key as keyof ColorSettings['dark']]);
        return `--${key}: ${value};`;
    }).join('\n');

    return `${selector} {\n${variables}\n}`;
};

const applyPreviewStyles = (iframe: HTMLIFrameElement, values: ColorSettings) => {
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) {
        return;
    }

    let styleTag = iframeDoc.getElementById('arix-live-colors-preview') as HTMLStyleElement | null;
    if (!styleTag) {
        styleTag = iframeDoc.createElement('style');
        styleTag.id = 'arix-live-colors-preview';
        iframeDoc.head.appendChild(styleTag);
    }

    styleTag.textContent = [buildModeCss(':root', values.dark), buildModeCss('.lightmode', values.light)].join('\n\n');
};

const IframeColorSync = ({ values, iframe }: { values: ColorSettings; iframe: HTMLIFrameElement | null }) => {
    useEffect(() => {
        if (!iframe) {
            return;
        }

        applyPreviewStyles(iframe, values);
    }, [iframe, values]);

    return null;
};

const applyColorPreset = (values: ColorSettings, preset: ColorPreset): ColorSettings => ({
    dark: {
        ...values.dark,
        ...(preset.dark ?? {}),
    },
    light: {
        ...values.light,
        ...(preset.light ?? {}),
    },
});

export default () => {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<ColorSettings | null>(null);
    const [previewIframe, setPreviewIframe] = useState<HTMLIFrameElement | null>(null);
    const { clearFlashes, addFlash } = useFlash();

    useEffect(() => {
        clearFlashes();
    }, []);

    useEffect(() => {
        getColors()
            .then((response) => {
                setData(response);
                setIsLoading(false);
            })
            .catch((error) => {
                clearFlashes();
                addFlash({ type: 'error', message: httpErrorToHuman(error) });
                setIsLoading(false);
            });
    }, []);

    const handleSubmit = (values: ColorSettings) => {
        clearFlashes();

        return updateColors(values)
            .then((updated) => {
                setData(updated ?? values);
                addFlash({ type: 'success', message: 'Color settings updated successfully.' });
            })
            .catch((error) => {
                addFlash({ type: 'error', message: httpErrorToHuman(error) });
            });
    };

    const initialValues: ColorSettings = {
        dark: {
            primary: data?.dark.primary ?? '',
            successText: data?.dark.successText ?? '',
            successBorder: data?.dark.successBorder ?? '',
            successBackground: data?.dark.successBackground ?? '',
            dangerText: data?.dark.dangerText ?? '',
            dangerBorder: data?.dark.dangerBorder ?? '',
            dangerBackground: data?.dark.dangerBackground ?? '',
            secondaryText: data?.dark.secondaryText ?? '',
            secondaryBorder: data?.dark.secondaryBorder ?? '',
            secondaryBackground: data?.dark.secondaryBackground ?? '',
            gray50: data?.dark.gray50 ?? '',
            gray100: data?.dark.gray100 ?? '',
            gray200: data?.dark.gray200 ?? '',
            gray300: data?.dark.gray300 ?? '',
            gray400: data?.dark.gray400 ?? '',
            gray500: data?.dark.gray500 ?? '',
            gray600: data?.dark.gray600 ?? '',
            gray700: data?.dark.gray700 ?? '',
            gray800: data?.dark.gray800 ?? '',
            gray900: data?.dark.gray900 ?? '',
        },
        light: {
            primary: data?.light.primary ?? '',
            successText: data?.light.successText ?? '',
            successBorder: data?.light.successBorder ?? '',
            successBackground: data?.light.successBackground ?? '',
            dangerText: data?.light.dangerText ?? '',
            dangerBorder: data?.light.dangerBorder ?? '',
            dangerBackground: data?.light.dangerBackground ?? '',
            secondaryText: data?.light.secondaryText ?? '',
            secondaryBorder: data?.light.secondaryBorder ?? '',
            secondaryBackground: data?.light.secondaryBackground ?? '',
            gray50: data?.light.gray50 ?? '',
            gray100: data?.light.gray100 ?? '',
            gray200: data?.light.gray200 ?? '',
            gray300: data?.light.gray300 ?? '',
            gray400: data?.light.gray400 ?? '',
            gray500: data?.light.gray500 ?? '',
            gray600: data?.light.gray600 ?? '',
            gray700: data?.light.gray700 ?? '',
            gray800: data?.light.gray800 ?? '',
            gray900: data?.light.gray900 ?? '',
        },
    };

    const renderModeGroups = (mode: 'dark' | 'light') => (
        <div className='space-y-5'>
            {COLOR_GROUPS.map((group) => (
                <div key={`${mode}-${group.title}`}>
                    <h3 className='text-gray-200 font-medium mb-2'>{group.title}</h3>
                    <div className='grid lg:grid-cols-3 gap-2'>
                        {group.fields.map((field) => (
                            <ColorField
                                key={`${mode}-${field.key}`}
                                name={`${mode}.${field.key}`}
                                label={field.label}
                                description={field?.description}
                                position={
                                    field.label.includes('Primary') || field.label.includes('Secondary')
                                        ? 'bottom'
                                        : 'top'
                                }
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <EditorWrapper title='Color Settings' size='large' onPreviewLoad={setPreviewIframe}>
            <FlashMessageRender />
            {isLoading || !data ? (
                <Spinner size='large' centered />
            ) : (
                <Formik<ColorSettings> initialValues={initialValues} enableReinitialize onSubmit={handleSubmit}>
                    {({ isSubmitting, submitForm, values, setValues }) => (
                        <React.Fragment>
                            <IframeColorSync values={values} iframe={previewIframe} />
                            <BorderedBox
                                title='Color Presets'
                                description='Color Presets to easily customize your theme.'
                            >
                                <div className='grid grid-cols-2 lg:grid-cols-3 gap-2'>
                                    {Object.entries(COLOR_PRESETS).map(([name, preset]) => (
                                        <Button.Text
                                            key={name}
                                            type='button'
                                            className='flex items-center !justify-between'
                                            onClick={() => setValues(applyColorPreset(values, preset))}
                                        >
                                            {name}
                                            <div className='flex items-center h-7 rounded overflow-hidden'>
                                                {!name.toLowerCase().includes('light') ? (
                                                    <React.Fragment>
                                                        {preset.dark?.primary && (
                                                            <div
                                                                className='w-3 h-full'
                                                                style={{ backgroundColor: preset.dark?.primary }}
                                                            />
                                                        )}
                                                        {preset.dark?.gray700 && (
                                                            <div
                                                                className='w-3 h-full'
                                                                style={{ backgroundColor: preset.dark?.gray700 }}
                                                            />
                                                        )}
                                                        {preset.dark?.gray400 && (
                                                            <div
                                                                className='w-3 h-full'
                                                                style={{ backgroundColor: preset.dark?.gray400 }}
                                                            />
                                                        )}
                                                        {preset.dark?.gray100 && (
                                                            <div
                                                                className='w-3 h-full'
                                                                style={{ backgroundColor: preset.dark?.gray100 }}
                                                            />
                                                        )}
                                                    </React.Fragment>
                                                ) : (
                                                    <React.Fragment>
                                                        {preset.light?.primary && (
                                                            <div
                                                                className='w-3 h-full'
                                                                style={{ backgroundColor: preset.light?.primary }}
                                                            />
                                                        )}
                                                        {preset.light?.gray700 && (
                                                            <div
                                                                className='w-3 h-full'
                                                                style={{ backgroundColor: preset.light?.gray700 }}
                                                            />
                                                        )}
                                                        {preset.light?.gray400 && (
                                                            <div
                                                                className='w-3 h-full'
                                                                style={{ backgroundColor: preset.light?.gray400 }}
                                                            />
                                                        )}
                                                        {preset.light?.gray100 && (
                                                            <div
                                                                className='w-3 h-full'
                                                                style={{ backgroundColor: preset.light?.gray100 }}
                                                            />
                                                        )}
                                                    </React.Fragment>
                                                )}
                                            </div>
                                        </Button.Text>
                                    ))}
                                </div>
                            </BorderedBox>
                            <BorderedBox title='Dark mode' description='Configure the colors used in darkmode.'>
                                {renderModeGroups('dark')}
                            </BorderedBox>
                            <BorderedBox title='Light mode' description='Configure the colors used in lightmode.'>
                                {renderModeGroups('light')}
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
