import React from 'react';
import tw from 'twin.macro';
import styled from 'styled-components/macro';
import { ApplicationStore } from '@/state';
import { useStoreState } from 'easy-peasy';
import {
    CheckCircleIcon,
    InformationCircleIcon,
    ExclamationCircleIcon,
    ExclamationIcon,
} from '@heroicons/react/outline';

export type FlashMessageType = 'success' | 'info' | 'warning' | 'error';

const Message = styled.div`
    ${tw`relative max-w-[320px] w-full px-4 pt-3 pb-4 rounded-component pointer-events-auto flex gap-4 shadow-lg overflow-hidden`};
    animation: fadeOut 0.5s ease-in-out 5.5s forwards;

    &::after {
        ${tw`absolute bottom-0 left-0 w-full h-1`};
        content: '';
        animation: flashAnimation 6s linear forwards;
    }
    @keyframes flashAnimation {
        0% {
            width: 100%;
        }
        100% {
            width: 0%;
        }
    }

    @keyframes fadeOut {
        0% {
            opacity: 1;
        }
        100% {
            opacity: 0;
        }
    }
`;

interface Props {
    title?: string;
    children: string;
    type?: FlashMessageType;
}
const MessageBox = ({ title, children, type }: Props) => {
    const flashMessage = useStoreState((state: ApplicationStore) => state.settings.data!.arix.styling.flashMessage);

    return String(flashMessage) === '0' ? (
        <Message
            className={`bg-gray-600 text-gray-200 items-start !gap-x-2
            ${
                type === 'success'
                    ? 'after:bg-green-600'
                    : type === 'info'
                    ? 'after:bg-blue-600'
                    : type === 'error'
                    ? 'after:bg-red-600'
                    : type === 'warning'
                    ? 'after:bg-yellow-600'
                    : ''
            }
        `}
        >
            {type === 'success' ? (
                <CheckCircleIcon className={'shrink-0 w-5 text-green-600 mt-1'} />
            ) : type === 'info' ? (
                <InformationCircleIcon className={'shrink-0 w-5 text-blue-600 mt-1'} />
            ) : type === 'error' ? (
                <ExclamationCircleIcon className={'shrink-0 w-5 text-red-600 mt-1'} />
            ) : type === 'warning' ? (
                <ExclamationIcon className={'shrink-0 w-5 text-yellow-600 mt-1'} />
            ) : (
                ''
            )}
            <div>
                {title && <p className={'font-semibold text-lg'}>{title}</p>}
                <p>{children}</p>
            </div>
        </Message>
    ) : (
        <Message
            className={`backdrop-blur-sm text-gray-200 items-center
                ${
                    type === 'success'
                        ? 'border border-green-600/40 bg-green-600/20 after:bg-green-600'
                        : type === 'info'
                        ? 'border border-blue-600/40 bg-blue-600/20 after:bg-blue-600'
                        : type === 'error'
                        ? 'border border-red-600/40 bg-red-600/20 after:bg-red-600'
                        : type === 'warning'
                        ? 'border border-yellow-600/40 bg-yellow-600/20 after:bg-yellow-600'
                        : ''
                }
        `}
        >
            {type === 'success' ? (
                <div className={'icon bg-green-600 p-2 rounded-md'}>
                    <CheckCircleIcon className={'w-6 text-green-200'} />
                </div>
            ) : type === 'info' ? (
                <div className={'icon bg-blue-600 p-2 rounded-md'}>
                    <InformationCircleIcon className={'w-6 text-blue-200'} />
                </div>
            ) : type === 'error' ? (
                <div className={'icon bg-red-600 p-2 rounded-md'}>
                    <ExclamationCircleIcon className={'w-6 text-red-200'} />
                </div>
            ) : type === 'warning' ? (
                <div className={'icon bg-yellow-600 p-2 rounded-md'}>
                    <ExclamationIcon className={'w-6 text-yellow-200'} />
                </div>
            ) : (
                ''
            )}
            <div>
                {title && <p className={'font-semibold text-lg'}>{title}</p>}
                <p>{children}</p>
            </div>
        </Message>
    );
};

MessageBox.displayName = 'MessageBox';

export default MessageBox;
