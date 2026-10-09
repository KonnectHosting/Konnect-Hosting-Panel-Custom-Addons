import React, { useEffect, useState } from 'react';
import useFlash from '@/plugins/useFlash';
import FlashMessageRender from '@/components/FlashMessageRender';
import ImportDialog from './ImportDialog';
import ExportDialog from './ExportDialog';
import ContentContainer from '@/components/elements/ContentContainer';
import { getPresets, Presets } from '@/api/admin/Preset';
import { DownloadIcon, ExternalLinkIcon } from '@heroicons/react/outline';
import { Button } from '../../elements/button/index';

export default () => {
    const { clearFlashes, addFlash } = useFlash();
    const [presets, setPresets] = useState<Presets[]>([]);
    const [isLoading, setIsloading] = useState(true);

    useEffect(() => {
        clearFlashes();
    }, []);

    useEffect(() => {
        getPresets()
            .then(setPresets)
            .catch((error) => {
                console.error(error);
                addFlash({ type: 'error', message: 'Failed to load presets.' });
            })
            .finally(() => setIsloading(false));
    }, []);

    return (
        <div className='h-[calc(100dvh-57px)] overflow-y-auto'>
            <FlashMessageRender />
            <div
                className={`relative w-full py-24 bg-cover bg-center z-10
                    after:content-[""] after:-z-10 after:absolute after:inset-0 after:bg-gradient-to-b after:from-arix/20 after:to-gray-800`}
                style={{ backgroundImage: `url('/arix/background-login.png')` }}
            >
                <ContentContainer className='px-4'>
                    <h1 className='text-4xl text-gray-50 font-bold mb-1'>Arix Theme Preset</h1>
                    <p className='text-gray-100 text-lg mb-4'>Import or export a preset for the Arix theme.</p>
                    <div className='flex flex-col sm:flex-row gap-2'>
                        <ImportDialog />
                        <ExportDialog />
                    </div>
                </ContentContainer>
            </div>

            <ContentContainer className='px-4'>
                {isLoading ? (
                    <div className='grid grid-cols-3 gap-4 pb-4'>
                        <div className='h-64 rounded-box bg-gray-700 animate-pulse' />
                        <div className='h-64 rounded-box bg-gray-700 animate-pulse' />
                        <div className='h-64 rounded-box bg-gray-700 animate-pulse' />
                        <div className='h-64 rounded-box bg-gray-700 animate-pulse' />
                        <div className='h-64 rounded-box bg-gray-700 animate-pulse' />
                    </div>
                ) : presets.length === 0 ? (
                    <div className='text-center text-gray-300 py-8'>
                        No presets found. Try refreshing or check back later!
                    </div>
                ) : (
                    <div className='grid grid-cols-3 gap-4 pb-4'>
                        {Object.values(presets).map((preset) => (
                            <div
                                key={preset.resource_id}
                                className='border border-gray-500 rounded-box overflow-hidden'
                            >
                                <a
                                    className='block relative'
                                    href={`https://builtbybit.com/r/${preset.resource_id}/?ref=305532&export=1662def8516f7d28b0d87401f19e08db54bbab74988d39125dd5308a0cd19328`}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                >
                                    <div className='absolute bottom-3 flex items-center gap-1 right-3 rounded bg-gray-500 px-2 py-1 font-medium'>
                                        <DownloadIcon className='w-4' />
                                        {preset.download_count}
                                    </div>
                                    <img
                                        src={preset.cover_image_url}
                                        alt={preset.title}
                                        className='w-full h-48 object-cover'
                                    />
                                    <div className='absolute -z-10 inset-0 bg-gray-500 animate-pulse' />
                                </a>
                                <div className='p-4'>
                                    <a
                                        href={`https://builtbybit.com/r/${preset.resource_id}/?ref=305532`}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='text-lg text-gray-50 font-bold pb-1'
                                    >
                                        {preset.title}
                                    </a>
                                    <p className='text-sm text-gray-300 flex items-center gap-1'>
                                        By
                                        <a
                                            href={preset.creator.url}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            className='underline whitespace-nowrap flex items-center gap-1'
                                        >
                                            {preset.creator.name}
                                            <ExternalLinkIcon className='w-4' />
                                        </a>
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <div className='text-sm text-gray-300 text-center mb-8'>
                    You want to submit your own preset? Upload it to BuiltByBit and let us know so we can feature it
                    here!
                </div>
            </ContentContainer>
        </div>
    );
};
