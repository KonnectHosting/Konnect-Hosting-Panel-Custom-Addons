import { Formik } from 'formik';
import React, { useEffect, useState } from 'react';
import EditorWrapper from '../elements/EditorWrapper';
import BorderedBox from '../elements/BorderedBox';
import { Button } from '@/components/elements/button/index';
import Spinner from '@/components/elements/Spinner';
import FlashMessageRender from '@/components/FlashMessageRender';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import FormPreviewHashSync from '@/plugins/FormPreviewHashSync';
import getComponents, { ComponentsSettings, updateComponents } from '@/api/admin/Components';
import OptionField from '../elements/OptionField';
import ConsoleBuilder from './ConsoleBuilder';
import Label from '@/components/elements/Label';
import { ArrowRightIcon } from '@heroicons/react/outline';
import { Link } from 'react-router-dom';

export default () => {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<ComponentsSettings | null>(null);
    const { clearFlashes, addFlash } = useFlash();
    const [previewHash, setPreviewHash] = useState('');

    useEffect(() => {
        clearFlashes();
    }, []);

    useEffect(() => {
        getComponents()
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

    const handleSubmit = (values: ComponentsSettings) => {
        clearFlashes();

        const payload: ComponentsSettings = {
            ...values,
            statsCards: Number(values.statsCards),
            sideGraphs: Number(values.sideGraphs),
            graphs: Number(values.graphs),
        };

        return updateComponents(payload)
            .then((updated) => {
                setData(updated ?? payload);
                addFlash({ type: 'success', message: 'Components settings updated successfully.' });
            })
            .catch((error) => {
                addFlash({ type: 'error', message: httpErrorToHuman(error) });
            });
    };

    const initialValues: ComponentsSettings = {
        serverRow: data?.serverRow ?? '',
        statsCards: data?.statsCards ?? 1,
        sideGraphs: data?.sideGraphs ?? 1,
        graphs: data?.graphs ?? 1,
        titledBoxStyle: data?.titledBoxStyle ?? 'default',
        statsStyle: data?.statsStyle ?? 'default',
        tableStyle: data?.tableStyle ?? 'default',
    };

    return (
        <EditorWrapper title='Components Settings' previewHash={previewHash} size='large'>
            <FlashMessageRender />
            {isLoading || !data ? (
                <Spinner size='large' centered />
            ) : (
                <Formik<ComponentsSettings> initialValues={initialValues} enableReinitialize onSubmit={handleSubmit}>
                    {({ isSubmitting, submitForm }) => (
                        <React.Fragment>
                            <FormPreviewHashSync
                                prefix={'arix-components'}
                                initialValues={initialValues}
                                onHashChange={setPreviewHash}
                            />
                            <BorderedBox
                                title='Dashboard Widgets'
                                description='Configure the widgets shown on the server Dashboard Page'
                            >
                                <Link
                                    to='/admin/arix/dashboard'
                                    className='block px-4 py-3 bg-gradient-to-br from-arix to-purple-600 rounded-box group'
                                >
                                    <p className='text-white text-xl font-medium'>
                                        Customize dashboard page with drag and drop!
                                    </p>
                                    <p className='text-gray-100 mt-2 flex items-center gap-x-1 group-hover:gap-x-2 duration-300'>
                                        Open Dashboard Editor
                                        <ArrowRightIcon className='w-4' />
                                    </p>
                                </Link>
                            </BorderedBox>
                            <BorderedBox title='General Components'>
                                <div>
                                    <Label className='mb-2'>Server Card (Server list)</Label>
                                    <div className='grid lg:grid-cols-3 gap-2'>
                                        <OptionField
                                            name='serverRow'
                                            value='default'
                                            label='Default Card'
                                            image={
                                                <div className='p-2 w-full'>
                                                    <div className='rounded-md overflow-hidden border border-gray-500 bg-gray-700 w-full'>
                                                        <div className='bg-gradient-to-b from-gray-400 to-transparent p-2'>
                                                            <div className='w-20 h-3 rounded-sm bg-white/50' />
                                                            <div className='mt-2 grid grid-cols-2 gap-1'>
                                                                <div className='w-12 h-2 rounded-sm bg-white/30' />
                                                                <div className='w-10 h-2 rounded-sm bg-white/30' />
                                                                <div className='w-14 h-2 rounded-sm bg-white/30' />
                                                                <div className='w-12 h-2 rounded-sm bg-white/30' />
                                                            </div>
                                                        </div>
                                                        <div className='mx-2 mb-2 mt-1 h-4 rounded bg-secondary-200 border border-secondary-100' />
                                                    </div>
                                                </div>
                                            }
                                        />
                                        <OptionField
                                            name='serverRow'
                                            value='banner'
                                            label='Banner Card'
                                            image={
                                                <div className='p-2 w-full'>
                                                    <div className='rounded-md overflow-hidden border border-gray-500 bg-gray-700 w-full'>
                                                        <div className='border-b border-gray-300 bg-gray-400 p-2'>
                                                            <div className='w-20 h-3 rounded-sm bg-white/50' />
                                                        </div>
                                                        <div className='grid grid-cols-2 gap-1 p-2'>
                                                            <div className='w-12 h-2 rounded-sm bg-white/30' />
                                                            <div className='w-10 h-2 rounded-sm bg-white/30' />
                                                            <div className='w-14 h-2 rounded-sm bg-white/30' />
                                                            <div className='w-12 h-2 rounded-sm bg-white/30' />
                                                        </div>
                                                        <div className='mx-2 mb-2 mt-1 h-4 rounded bg-secondary-200 border border-secondary-100' />
                                                    </div>
                                                </div>
                                            }
                                        />
                                        <OptionField
                                            name='serverRow'
                                            value='flat'
                                            label='Flat Card'
                                            image={
                                                <div className='p-2 w-full'>
                                                    <div className='rounded-md overflow-hidden border border-gray-500 bg-gray-700 w-full'>
                                                        <div className='p-2'>
                                                            <div className='w-20 h-3 rounded-sm bg-white/50' />
                                                        </div>
                                                        <div className='grid grid-cols-2 gap-1 p-2'>
                                                            <div className='w-12 h-2 rounded-sm bg-white/30' />
                                                            <div className='w-10 h-2 rounded-sm bg-white/30' />
                                                            <div className='w-14 h-2 rounded-sm bg-white/30' />
                                                            <div className='w-12 h-2 rounded-sm bg-white/30' />
                                                        </div>
                                                        <div className='mx-2 mb-2 mt-1 h-4 rounded bg-secondary-200 border border-secondary-100' />
                                                    </div>
                                                </div>
                                            }
                                        />
                                        <OptionField
                                            name='serverRow'
                                            value='linear'
                                            label='Linear Card'
                                            image={
                                                <div className='p-2 w-full'>
                                                    <div className='rounded-md overflow-hidden border border-gray-500 bg-gray-700 w-full'>
                                                        <div className='bg-gradient-to-l from-gray-400 to-transparent p-2 flex justify-between gap-4'>
                                                            <div className='w-14 h-3 rounded-sm bg-white/50' />
                                                            <div className='grid grid-cols-2 gap-1'>
                                                                <div className='w-8 h-2 rounded-sm bg-white/30' />
                                                                <div className='w-10 h-2 rounded-sm bg-white/30' />
                                                                <div className='w-12 h-2 rounded-sm bg-white/30' />
                                                                <div className='w-8 h-2 rounded-sm bg-white/30' />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            }
                                        />
                                        <OptionField
                                            name='serverRow'
                                            value='minimal'
                                            label='Minimal Card'
                                            image={
                                                <div className='p-2 w-full'>
                                                    <div className='rounded-md overflow-hidden border border-gray-500 bg-gray-700 w-full'>
                                                        <div className='p-2'>
                                                            <div className='w-14 h-3 rounded-sm bg-white/50' />
                                                            <div className='flex justify-between gap-1 mt-2'>
                                                                <div className='w-8 h-2 rounded-sm bg-white/30' />
                                                                <div className='w-10 h-2 rounded-sm bg-white/30' />
                                                                <div className='w-12 h-2 rounded-sm bg-white/30' />
                                                                <div className='w-8 h-2 rounded-sm bg-white/30' />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            }
                                        />
                                        <OptionField
                                            name='serverRow'
                                            value='compact'
                                            label='Compact Card'
                                            image={
                                                <div className='p-2 w-full'>
                                                    <div className='rounded-md overflow-hidden border border-gray-500 bg-gray-700 w-full'>
                                                        <div className='p-2'>
                                                            <div className='w-14 h-3 rounded-sm bg-white/50' />
                                                            <div className='w-8 h-2 rounded-sm bg-white/30 mt-2' />
                                                        </div>
                                                    </div>
                                                </div>
                                            }
                                        />
                                    </div>
                                </div>
                                <div className='mt-6'>
                                    <Label className='mb-2'>Box Style</Label>
                                    <div className='grid lg:grid-cols-2 gap-2'>
                                        <OptionField
                                            name='titledBoxStyle'
                                            value={'default'}
                                            label='Default'
                                            image={
                                                <div className='p-4 w-full'>
                                                    <div className='w-full bg-gray-700 border border-gray-500 overflow-hidden rounded-lg'>
                                                        <div className='text-xs text-gray-300 font-medium px-3 py-2'>
                                                            Box Title
                                                        </div>
                                                        <div className='text-[0.6125rem] px-3 pb-2'>
                                                            Input Label
                                                            <div className='w-full h-5 mt-1 bg-gray-600 rounded' />
                                                            <div className='w-10 ml-auto h-5 mt-2 bg-arix rounded' />
                                                        </div>
                                                    </div>
                                                </div>
                                            }
                                        />
                                        <OptionField
                                            name='titledBoxStyle'
                                            value={'line'}
                                            label='Line'
                                            image={
                                                <div className='p-4 w-full'>
                                                    <div className='w-full bg-gray-700 border border-gray-500 overflow-hidden rounded-lg'>
                                                        <div className='text-xs text-gray-300 font-medium px-3 py-2 border-b border-gray-500'>
                                                            Box Title
                                                        </div>
                                                        <div className='text-[0.6125rem] px-3 py-2'>
                                                            Input Label
                                                            <div className='w-full h-5 mt-1 bg-gray-600 rounded' />
                                                            <div className='w-10 ml-auto h-5 mt-2 bg-arix rounded' />
                                                        </div>
                                                    </div>
                                                </div>
                                            }
                                        />
                                        <OptionField
                                            name='titledBoxStyle'
                                            value={'fill'}
                                            label='Fill'
                                            image={
                                                <div className='p-4 w-full'>
                                                    <div className='w-full bg-gray-700 border border-gray-500 overflow-hidden rounded-lg'>
                                                        <div className='text-xs text-gray-300 font-medium px-3 py-2 bg-gray-600'>
                                                            Box Title
                                                        </div>
                                                        <div className='text-[0.6125rem] px-3 py-2'>
                                                            Input Label
                                                            <div className='w-full h-5 mt-1 bg-gray-600 rounded' />
                                                            <div className='w-10 ml-auto h-5 mt-2 bg-arix rounded' />
                                                        </div>
                                                    </div>
                                                </div>
                                            }
                                        />
                                        <OptionField
                                            name='titledBoxStyle'
                                            value={'pill'}
                                            label='Pill'
                                            image={
                                                <div className='p-4 w-full'>
                                                    <div className='w-full bg-gray-700 border border-gray-500 rounded-lg'>
                                                        <div className='text-xs text-gray-300 font-medium rounded-md mx-1 mt-1 px-2 py-2 bg-gray-600'>
                                                            Box Title
                                                        </div>
                                                        <div className='text-[0.6125rem] px-3 py-2'>
                                                            Input Label
                                                            <div className='w-full h-5 mt-1 bg-gray-600 rounded' />
                                                            <div className='w-10 ml-auto h-5 mt-2 bg-arix rounded' />
                                                        </div>
                                                    </div>
                                                </div>
                                            }
                                        />
                                    </div>
                                </div>
                            </BorderedBox>
                            <BorderedBox
                                title='Table Style (BETA)'
                                description='Configure the style of tables throughout the panel'
                            >
                                <div className='grid lg:grid-cols-2 gap-2'>
                                    <OptionField
                                        name='tableStyle'
                                        value={'default'}
                                        label='Default'
                                        image={<div className='p-2 w-full text-center'>Table</div>}
                                    />
                                    <OptionField
                                        name='tableStyle'
                                        value={'cards'}
                                        label='Cards'
                                        image={<div className='p-2 w-full text-center'>Cards</div>}
                                    />
                                </div>
                            </BorderedBox>
                            <BorderedBox title='Console Page'>
                                <ConsoleBuilder />
                            </BorderedBox>
                            <BorderedBox title='Graphs & Stats'>
                                <div className='grid lg:grid-cols-2 gap-2'>
                                    <OptionField
                                        name='statsStyle'
                                        value={'default'}
                                        label='Default'
                                        image={
                                            <div className='p-2 w-full'>
                                                <div
                                                    className='rounded-md overflow-hidden border border-gray-500 
                                                bg-gray-700 w-full p-2 flex justify-between items-center'
                                                >
                                                    <div>
                                                        <div className='w-8 h-2 rounded-sm bg-white/20' />
                                                        <div className='w-12 h-4 mt-2 rounded-sm bg-white/50' />
                                                    </div>
                                                    <div className='w-10 h-10 bg-arix rounded-md' />
                                                </div>
                                            </div>
                                        }
                                    />
                                    <OptionField
                                        name='statsStyle'
                                        value={'reversed'}
                                        label='Reversed'
                                        image={
                                            <div className='p-2 w-full'>
                                                <div
                                                    className='rounded-md overflow-hidden border border-gray-500 
                                                bg-gray-700 w-full p-2 flex gap-4 items-center'
                                                >
                                                    <div className='w-10 h-10 bg-arix rounded-md' />
                                                    <div>
                                                        <div className='w-8 h-2 rounded-sm bg-white/20' />
                                                        <div className='w-12 h-4 mt-2 rounded-sm bg-white/50' />
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    />
                                    <OptionField
                                        name='statsStyle'
                                        value={'minimal'}
                                        label='Minimal'
                                        image={
                                            <div className='p-2 w-full'>
                                                <div
                                                    className='rounded-md overflow-hidden border border-gray-500 
                                                bg-gray-700 w-full p-2 flex justify-between'
                                                >
                                                    <div>
                                                        <div className='w-8 h-2 rounded-sm bg-white/20' />
                                                        <div className='w-12 h-4 mt-2 rounded-sm bg-white/50' />
                                                    </div>
                                                    <div className='w-5 h-5 bg-arix rounded-sm' />
                                                </div>
                                            </div>
                                        }
                                    />
                                    <OptionField
                                        name='statsStyle'
                                        value={'minimalReversed'}
                                        label='Minimal Reversed'
                                        image={
                                            <div className='p-2 w-full'>
                                                <div
                                                    className='rounded-md overflow-hidden border border-gray-500 
                                                bg-gray-700 w-full p-2'
                                                >
                                                    <div className='flex gap-2 items-center'>
                                                        <div className='w-5 h-5 bg-arix rounded-sm' />
                                                        <div className='w-8 h-2 rounded-sm bg-white/20' />
                                                    </div>
                                                    <div className='w-12 h-4 mt-2 rounded-sm bg-white/50' />
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
