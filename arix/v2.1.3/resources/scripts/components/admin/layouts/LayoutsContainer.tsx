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
import getLayouts, { LayoutsSettings, updateLayouts } from '@/api/admin/Layouts';
import OptionField from '../elements/OptionField';
import { PhotographIcon, TerminalIcon } from '@heroicons/react/outline';
import Field from '@/components/elements/Field';

export default () => {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<LayoutsSettings | null>(null);
    const { clearFlashes, addFlash } = useFlash();
    const [previewHash, setPreviewHash] = useState('');

    useEffect(() => {
        clearFlashes();
    }, []);

    useEffect(() => {
        getLayouts()
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

    const handleSubmit = (values: LayoutsSettings) => {
        clearFlashes();

        const payload: LayoutsSettings = {
            ...values,
        };

        return updateLayouts(payload)
            .then((updated) => {
                setData(updated ?? payload);
                addFlash({ type: 'success', message: 'Layout settings updated successfully.' });
            })
            .catch((error) => {
                addFlash({ type: 'error', message: httpErrorToHuman(error) });
            });
    };

    const initialValues: LayoutsSettings = {
        layout: data?.layout ?? 'default',
        dock: data?.dock ?? 'sidebar',
        hoverEffect: data?.hoverEffect ?? 'default',
        searchComponent: data?.searchComponent ?? '',
        logoPosition: data?.logoPosition ?? '',
        socialPosition: data?.socialPosition ?? '',
        loginLayout: data?.loginLayout ?? '',
    };

    return (
        <EditorWrapper title='Layout Settings' previewHash={previewHash}>
            <FlashMessageRender />
            {isLoading || !data ? (
                <Spinner size='large' centered />
            ) : (
                <Formik<LayoutsSettings> initialValues={initialValues} enableReinitialize onSubmit={handleSubmit}>
                    {({ isSubmitting, submitForm, values }) => (
                        <React.Fragment>
                            <FormPreviewHashSync
                                prefix={'arix-layout'}
                                initialValues={initialValues}
                                onHashChange={setPreviewHash}
                            />
                            <BorderedBox title='Dashboard Layout' description='Layout for account and server pages'>
                                <div className='grid lg:grid-cols-2 gap-2'>
                                    <p className='lg:col-span-2 text-sm'>Dashboard Layout</p>
                                    <OptionField
                                        name='layout'
                                        value={'default'}
                                        label='Default'
                                        image={
                                            <div className='p-2 w-full'>
                                                <div className='h-20 rounded-md overflow-hidden border border-gray-300 w-full flex'>
                                                    <div className='bg-gray-400 border-r border-gray-300 h-full w-1/4' />
                                                    <div className='flex-1 p-2'>
                                                        <p className='text-[0.5rem] mb-1'>Console</p>
                                                        <div className='w-full h-10 rounded border border-gray-300 flex items-center justify-center'>
                                                            <TerminalIcon className='w-4' />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    />
                                    <OptionField
                                        name='layout'
                                        value={'floating'}
                                        label='Floating'
                                        image={
                                            <div className='p-2 w-full'>
                                                <div className='h-20 rounded-md overflow-hidden border border-gray-300 w-full flex'>
                                                    <div className='bg-gray-400 border border-gray-300 rounded h-auto w-1/4 my-1 ml-1' />
                                                    <div className='flex-1 p-2'>
                                                        <p className='text-[0.5rem] mb-1'>Console</p>
                                                        <div className='w-full h-10 rounded border border-gray-300 flex items-center justify-center'>
                                                            <TerminalIcon className='w-4' />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    />
                                    <OptionField
                                        name='layout'
                                        value={'pill'}
                                        label='Pill'
                                        image={
                                            <div className='p-2 w-full'>
                                                <div className='h-20 rounded-md overflow-hidden border border-gray-300 w-full'>
                                                    <div className='w-full h-4 bg-gray-400 border-b border-gray-300' />
                                                    <div className='flex gap-2 p-2'>
                                                        <div className='bg-gray-400 border border-gray-300 rounded h-auto w-1/5' />
                                                        <div className='flex-1'>
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
                                        name='layout'
                                        value={'slim'}
                                        label='Slim'
                                        image={
                                            <div className='p-2 w-full'>
                                                <div className='h-20 rounded-md overflow-hidden border border-gray-300 w-full flex'>
                                                    <div className='bg-gray-400 border-r border-gray-300 h-full w-4' />
                                                    <div className='flex-1 p-2'>
                                                        <p className='text-[0.5rem] mb-1'>Console</p>
                                                        <div className='w-full h-10 rounded border border-gray-300 flex items-center justify-center'>
                                                            <TerminalIcon className='w-4' />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    />
                                    <OptionField
                                        name='layout'
                                        value={'horizontal'}
                                        label='Horizontal'
                                        image={
                                            <div className='p-2 w-full'>
                                                <div className='h-20 rounded-md overflow-hidden border border-gray-300 w-full'>
                                                    <div className='bg-gray-400 border-b border-gray-300 w-full h-8' />
                                                    <div className='flex-1 p-2'>
                                                        <p className='text-[0.5rem] mb-1'>Console</p>
                                                        <div className='w-full h-10 rounded border border-gray-300 flex items-center justify-center'>
                                                            <TerminalIcon className='w-4' />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    />
                                </div>
                                <div
                                    className={`grid lg:grid-cols-2 gap-2 overflow-hidden duration-300
                                    ${
                                        values.layout === 'default' ||
                                        values.layout === 'slim' ||
                                        values.layout === 'floating'
                                            ? 'max-h-screen'
                                            : 'max-h-0'
                                    }`}
                                >
                                    <p className='lg:col-span-2 text-sm'>Dock position</p>
                                    {(values.layout === 'default' || values.layout === 'floating') && (
                                        <OptionField
                                            name='dock'
                                            value={'sidebar'}
                                            label='Sidebar'
                                            image={
                                                <div className='p-2 w-full'>
                                                    <div className='h-20 rounded-md overflow-hidden border border-gray-300 w-full flex'>
                                                        <div className='border-r border-gray-300 h-full w-1/4'>
                                                            <div className='mt-3 w-full px-1 py-2 flex items-center gap-1 border-y border-gray-300 bg-gray-400'></div>
                                                        </div>
                                                        <div className='flex-1 p-2'>
                                                            <p className='text-[0.5rem] mb-1'>Console</p>
                                                            <div className='w-full h-10 rounded border border-gray-300 flex items-center justify-center'>
                                                                <TerminalIcon className='w-4' />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            }
                                        />
                                    )}
                                    {values.layout !== 'floating' && (
                                        <OptionField
                                            name='dock'
                                            value={'header'}
                                            label='Header'
                                            image={
                                                <div className='p-2 w-full'>
                                                    <div className='h-20 rounded-md overflow-hidden border border-gray-300 w-full flex'>
                                                        <div className='border-r border-gray-300 h-full w-1/4'></div>
                                                        <div className='flex-1'>
                                                            <div className='border-b border-gray-300 w-full p-2 flex items-center justify-end gap-1 bg-gray-400'></div>
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
                                    )}
                                    <OptionField
                                        name='dock'
                                        value={'top'}
                                        label='Top'
                                        image={
                                            <div className='p-2 w-full'>
                                                <div className='h-20 rounded-md overflow-hidden border border-gray-300 w-full flex'>
                                                    <div className='border-r border-gray-300 h-full w-1/4'></div>
                                                    <div className='flex-1 p-2'>
                                                        <div className='mb-1 rounded border border-gray-300 w-full p-2 flex items-center justify-end gap-1 bg-gray-400'></div>
                                                        <p className='text-[0.5rem] mb-1'>Console</p>
                                                        <div className='w-full h-10 rounded border border-gray-300 flex items-center justify-center'>
                                                            <TerminalIcon className='w-4' />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    />
                                </div>
                                <div className='space-y-2'>
                                    <p className='text-sm'>Hover Effect</p>
                                    <div className='grid lg:grid-cols-2 gap-2'>
                                        <OptionField
                                            name='hoverEffect'
                                            value={'default'}
                                            label='Default'
                                            image={
                                                <div className='py-4 px-1 w-full bg-gray-600'>
                                                    <div className='flex items-center gap-x-2 text-sm bg-gradient-to-r from-transparent to-arix/30 py-2 px-3 border-r border-arix text-gray-100'>
                                                        <TerminalIcon className='w-4 text-arix' />
                                                        Console
                                                    </div>
                                                </div>
                                            }
                                        />
                                        <OptionField
                                            name='hoverEffect'
                                            value={'filled'}
                                            label='Filled'
                                            image={
                                                <div className='py-4 w-full bg-gray-600'>
                                                    <div className='flex items-center gap-x-2 text-sm bg-arix py-2 px-3 text-gray-100'>
                                                        <TerminalIcon className='w-4' />
                                                        Console
                                                    </div>
                                                </div>
                                            }
                                        />
                                        <OptionField
                                            name='hoverEffect'
                                            value={'filled secondary'}
                                            label='Filled Secondary'
                                            image={
                                                <div className='py-4 h-full w-full bg-gray-600'>
                                                    <div className='flex items-center gap-x-2 text-sm bg-gray-500 py-2 px-3 text-gray-100'>
                                                        <TerminalIcon className='w-4' />
                                                        Console
                                                    </div>
                                                </div>
                                            }
                                        />
                                        <OptionField
                                            name='hoverEffect'
                                            value={'icon pill'}
                                            label='Icon Pill'
                                            image={
                                                <div className='py-2 h-full w-full bg-gray-600'>
                                                    <div className='flex items-center gap-x-2 text-sm py-2 px-3 text-gray-100'>
                                                        <div className='p-2 bg-arix rounded-component'>
                                                            <TerminalIcon className={`w-4 text-white`} />
                                                        </div>
                                                        Console
                                                    </div>
                                                </div>
                                            }
                                        />
                                        <OptionField
                                            name='hoverEffect'
                                            value={'pill'}
                                            label='Pill'
                                            image={
                                                <div className='py-4 px-2 w-full bg-gray-600'>
                                                    <div className='flex items-center gap-x-2 text-sm bg-arix py-2 px-3 rounded-component text-gray-100'>
                                                        <TerminalIcon className='w-4' />
                                                        Console
                                                    </div>
                                                </div>
                                            }
                                        />
                                        <OptionField
                                            name='hoverEffect'
                                            value={'pill secondary'}
                                            label='Pill Secondary'
                                            image={
                                                <div className='py-4 px-2 w-full bg-gray-600'>
                                                    <div className='flex items-center gap-x-2 text-sm bg-gray-500 py-2 px-3 rounded-component text-gray-100'>
                                                        <TerminalIcon className='w-4' />
                                                        Console
                                                    </div>
                                                </div>
                                            }
                                        />
                                    </div>
                                </div>
                                <div className='space-y-2'>
                                    <p className='text-sm'>Search Component</p>
                                    <label className='flex items-start gap-x-2 cursor-pointer'>
                                        <Field
                                            type='radio'
                                            name='searchComponent'
                                            defaultChecked={data.searchComponent === 'Command Palette'}
                                            value='Command Palette'
                                            className='mt-1'
                                        />
                                        <div>
                                            <p className='text-sm font-medium'>Command Palette</p>
                                            <p className='text-xs'>
                                                Quicly navigate to any page or action by using a simple command
                                                interface.
                                            </p>
                                        </div>
                                    </label>
                                    <label className='flex items-start gap-x-2 cursor-pointer'>
                                        <Field
                                            type='radio'
                                            name='searchComponent'
                                            value='Server Selector'
                                            defaultChecked={data.searchComponent === 'Server Selector'}
                                            className='mt-1'
                                        />
                                        <div>
                                            <p className='text-sm font-medium'>Server Selector</p>
                                            <p className='text-xs'>
                                                Provides a dropdown in the navigation bar to quickly switch between
                                                servers.
                                            </p>
                                        </div>
                                    </label>
                                    <label className='flex items-start gap-x-2 cursor-pointer'>
                                        <Field
                                            type='radio'
                                            name='searchComponent'
                                            value='Search Bar'
                                            defaultChecked={data.searchComponent === 'Search Bar'}
                                            className='mt-1'
                                        />
                                        <div>
                                            <p className='text-sm font-medium'>Search Bar</p>
                                            <p className='text-xs'>
                                                Adds a search bar to the navigation for quickly finding servers, users,
                                                and more.
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            </BorderedBox>
                            <BorderedBox
                                title='Authentication layout'
                                description='Layout for login, signup and other auth pages.'
                            >
                                <div className='grid lg:grid-cols-2 gap-2'>
                                    <p className='lg:col-span-2 text-sm'>Login Layout</p>
                                    <OptionField
                                        name='loginLayout'
                                        value={'default'}
                                        label='Default'
                                        image={
                                            <div className='p-2 w-full'>
                                                <div className='h-20 rounded-md overflow-hidden border border-gray-300 w-full flex items-center justify-center'>
                                                    <div className='w-14 rounded border border-gray-300 bg-gray-500 p-2 space-y-1'>
                                                        <p className='text-[0.5rem]'>Login</p>
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    />
                                    <OptionField
                                        name='loginLayout'
                                        value={'flat'}
                                        label='Flat'
                                        image={
                                            <div className='p-2 w-full'>
                                                <div className='h-20 rounded-md overflow-hidden border border-gray-300 w-full flex items-center justify-center'>
                                                    <div className='w-12 space-y-1'>
                                                        <p className='text-[0.5rem]'>Login</p>
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    />
                                    <OptionField
                                        name='loginLayout'
                                        value={'side'}
                                        label='Side Banner'
                                        image={
                                            <div className='p-2 w-full'>
                                                <div className='h-20 rounded-md overflow-hidden border border-gray-300 w-full flex'>
                                                    <div className='w-12 space-y-1 m-auto'>
                                                        <p className='text-[0.5rem]'>Login</p>
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                    </div>
                                                    <div className='h-full bg-gray-400 border-l border-gray-300 w-1/2 flex items-center justify-center'>
                                                        <PhotographIcon className='w-4 text-gray-100' />
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    />
                                    <OptionField
                                        name='loginLayout'
                                        value={'floating'}
                                        label='Floating Banner'
                                        image={
                                            <div className='p-2 w-full'>
                                                <div className='h-20 rounded-md overflow-hidden border border-gray-300 w-full flex'>
                                                    <div className='w-12 space-y-1 m-auto'>
                                                        <p className='text-[0.5rem]'>Login</p>
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                    </div>
                                                    <div className='bg-gray-400 my-1 mr-1 rounded border border-gray-300 w-1/2 flex items-center justify-center'>
                                                        <PhotographIcon className='w-4 text-gray-100' />
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    />
                                    <OptionField
                                        name='loginLayout'
                                        value={'panels'}
                                        label='Panels'
                                        image={
                                            <div className='p-2 w-full'>
                                                <div className='h-20 rounded-md overflow-hidden border border-gray-300 w-full flex items-center justify-center'>
                                                    <div className='flex w-2/3 border border-gray-300 rounded overflow-hidden'>
                                                        <div className='w-12 space-y-1 m-auto p-2'>
                                                            <p className='text-[0.5rem]'>Login</p>
                                                            <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                            <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                            <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                        </div>
                                                        <div className='bg-gray-400 border-l border-gray-300 w-1/2 flex items-center justify-center'>
                                                            <PhotographIcon className='w-4 text-gray-100' />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    />
                                </div>
                                <div className='grid lg:grid-cols-2 gap-2'>
                                    <p className='lg:col-span-2 text-sm'>Logo position</p>
                                    <OptionField
                                        name='logoPosition'
                                        value={'top'}
                                        label='Header'
                                        image={
                                            <div className='p-2 w-full'>
                                                <div className='h-20 rounded-md overflow-hidden border border-gray-300 w-full flex flex-col'>
                                                    <p className='text-[0.5rem] p-2 flex items-center gap-x-1 text-white'>
                                                        <div className='w-3 h-3 bg-arix rounded-sm' />
                                                        Logo
                                                    </p>
                                                    <div className='w-12 space-y-1 mx-auto'>
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    />
                                    <OptionField
                                        name='logoPosition'
                                        value={'bottom'}
                                        label='Above Form'
                                        image={
                                            <div className='p-2 w-full'>
                                                <div className='h-20 rounded-md overflow-hidden border border-gray-300 w-full flex items-center justify-center'>
                                                    <div className='w-12 space-y-1'>
                                                        <p className='text-[0.5rem] flex items-center gap-x-1 text-white'>
                                                            <div className='w-3 h-3 bg-arix rounded-sm' />
                                                            Logo
                                                        </p>
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    />
                                </div>
                                <div className='grid lg:grid-cols-2 gap-2'>
                                    <p className='lg:col-span-2 text-sm'>Support links position</p>
                                    <OptionField
                                        name='socialPosition'
                                        value={'top'}
                                        label='Header'
                                        image={
                                            <div className='p-2 w-full'>
                                                <div className='h-20 rounded-md overflow-hidden border border-gray-300 w-full flex flex-col'>
                                                    <p className='text-[0.5rem] p-2 ml-auto text-white'>Discord</p>
                                                    <div className='w-12 space-y-1 mx-auto'>
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    />
                                    <OptionField
                                        name='socialPosition'
                                        value={'bottom'}
                                        label='Above Form'
                                        image={
                                            <div className='p-2 w-full'>
                                                <div className='h-20 rounded-md overflow-hidden border border-gray-300 w-full flex items-center justify-center'>
                                                    <div className='w-12 space-y-1'>
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                        <div className='h-2 w-full rounded-sm border border-gray-300' />
                                                        <p className='text-[0.5rem] text-center text-white'>Discord</p>
                                                    </div>
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
