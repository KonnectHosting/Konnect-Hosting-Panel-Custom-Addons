import React from 'react';
import { ServerContext } from '@/state/server';
import { ChipIcon, CloudIcon } from '@heroicons/react/outline';
import { LuMemoryStick } from 'react-icons/lu';
import { useTranslation } from 'react-i18next';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';

interface ChartBlockProps {
    type: string;
    title: string;
    legend?: React.ReactNode;
    children: React.ReactNode;
    usage?: string;
    limit?: string;
    inbound?: string;
    outbound?: string;
}

const Icon = ({ type, className, size }: { type: string; className?: string; size?: string }) => {
    return (
        <div className={`${className} text-white bg-arix flex items-center justify-center`}>
            {type == 'cpu' ? (
                <ChipIcon className={size === 'large' ? 'w-10' : 'w-5'} />
            ) : type == 'network' ? (
                <CloudIcon className={size === 'large' ? 'w-10' : 'w-5'} />
            ) : (
                <LuMemoryStick className={size === 'large' ? 'text-[2.5rem]' : 'text-[1.25rem]'} />
            )}
        </div>
    );
};

export default ({ type, title, legend, usage, limit, inbound, outbound, children }: ChartBlockProps) => {
    const status = ServerContext.useStoreState((state) => state.status.value);
    const { statsStyle } = useStoreState((state: ApplicationStore) => state.settings.data!.arix.components);
    const { t } = useTranslation('arix/utilities');

    return (
        <>
            <div className={'bg-gray-700 backdrop boxBorder overflow-hidden rounded-box'}>
                <div className={`px-6 pt-5 flex ${statsStyle.includes('minimal') ? '' : 'items-center'}`}>
                    {statsStyle === 'reversed' && (
                        <Icon type={type} className={'mr-4 w-16 h-16 rounded-component'} size={'large'} />
                    )}
                    <div>
                        <div className={'text-gray-300 flex items-center'}>
                            {statsStyle === 'minimalReversed' && (
                                <Icon type={type} className={'mr-2 w-8 h-8 rounded-md'} size={'small'} />
                            )}
                            {title}:
                        </div>
                        <div className={'flex items-center gap-x-1'}>
                            {status === 'offline' ? (
                                <p>{t('offline')}</p>
                            ) : (
                                <p className={'text-lg font-medium'}>
                                    {usage && usage}
                                    {inbound && outbound && `${inbound} / ${outbound}`}
                                </p>
                            )}
                            <span className={'text-gray-300 font-medium'}>{limit && '/ ' + limit}</span>
                        </div>
                    </div>
                    {statsStyle === 'default' && (
                        <Icon type={type} className={'ml-auto w-16 h-16 rounded-component'} size={'large'} />
                    )}
                    {statsStyle === 'minimal' && (
                        <Icon type={type} className={'ml-auto w-8 h-8 rounded-md'} size={'small'} />
                    )}
                </div>
                <div css={'left:-11px;bottom:-11px;width:calc(100% + 17px);position:relative;'}>{children}</div>
            </div>
        </>
    );
};
