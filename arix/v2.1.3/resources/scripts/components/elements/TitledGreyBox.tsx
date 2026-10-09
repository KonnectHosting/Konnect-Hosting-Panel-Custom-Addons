import React, { memo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import tw from 'twin.macro';
import isEqual from 'react-fast-compare';
import { ApplicationStore } from '@/state';
import { useStoreState } from 'easy-peasy';

interface Props {
    icon?: IconProp;
    title: string | React.ReactNode;
    footer?: string | React.ReactNode;
    className?: string;
    children: React.ReactNode;
}

const TitledGreyBox = ({ icon, title, footer, children, className }: Props) => {
    const titledBoxStyle = useStoreState(
        (state: ApplicationStore) => state.settings.data!.arix.components.titledBoxStyle
    );

    return (
        <div className={`rounded-box bg-neutral-700 overflow-hidden backdrop boxBorder ${className ? className : ''}`}>
            <div
                className={`font-medium text-gray-300 
                    ${
                        titledBoxStyle === 'fill'
                            ? 'bg-gray-600 py-4 px-6 compact:py-2 compact:px-3'
                            : titledBoxStyle === 'pill'
                            ? 'bg-gray-600 py-4 px-5 compact:py-2 compact:px-2 mx-1 mt-1 rounded-box'
                            : titledBoxStyle === 'line'
                            ? 'border-b border-gray-500 py-4 px-6 compact:py-2 compact:px-3'
                            : 'px-6 pt-5 compact:pt-3 compact:px-3'
                    }
                `}
            >
                {typeof title === 'string' ? (
                    <p className={'font-medium text-gray-300'}>
                        {icon && <FontAwesomeIcon icon={icon} css={tw`mr-2 text-neutral-300`} />}
                        {title}
                    </p>
                ) : (
                    title
                )}
            </div>
            <div className={`px-6 py-5 compact:py-3 compact:px-3`}>{children}</div>
            {footer && (
                <div className={`px-6 py-4 compact:py-2 compact:px-3 border-t border-gray-600 bg-white/5`}>
                    {footer}
                </div>
            )}
        </div>
    );
};

export default memo(TitledGreyBox, isEqual);
