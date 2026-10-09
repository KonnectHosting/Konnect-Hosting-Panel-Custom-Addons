import React, { useState, useEffect } from 'react';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import {
    LuPartyPopper,
    LuMegaphone,
    LuInfo,
    LuCircleAlert,
    LuTriangleAlert,
    LuCircleCheck,
    LuCircleX,
    LuLifeBuoy,
    LuFlame,
} from 'react-icons/lu';
import Markdown from 'markdown-to-jsx';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import ContentContainer from './ContentContainer';

const MyAlert = styled.div<{ $color: string }>`
    ${tw`mx-auto w-full flex items-center gap-x-2 px-4 text-gray-100`};
    border-left: var(--radiusInput) solid;
    background-color: ${({ $color }) => `${$color}`};

    & > svg {
        font-size: 1.2rem;
    }
`;

const Announcement = () => {
    const [isOpen, setIsOpen] = useState(true);

    const { enabled, position, color, icon, message, cta, ctaTitle, ctaLink, dismissable } = useStoreState(
        (state: ApplicationStore) => state.settings.data!.arix.announcement
    );

    useEffect(() => {
        const announcementKey = `${message?.slice(0, 5)}-${message?.slice(-5)}`;
        const closedKey = localStorage.getItem('closedAnnouncementKey');

        if (closedKey && closedKey === announcementKey) {
            setIsOpen(false);
        } else {
            setIsOpen(true);
            if (String(enabled) === 'false' || closedKey !== announcementKey) {
                localStorage.removeItem('closedAnnouncementKey');
            }
        }
    }, [message, enabled]);

    const handleClose = () => {
        setIsOpen(false);
        const announcementKey = `${message?.slice(0, 5)}-${message?.slice(-5)}`;
        localStorage.setItem('closedAnnouncementKey', announcementKey);
    };

    return (
        <div className={position === 'header' ? '' : 'px-4'}>
            <ContentContainer className={position === 'header' ? '!max-w-full' : ''}>
                {String(enabled) === 'true' && isOpen && (
                    <MyAlert
                        className={`backdrop ${
                            position === 'header'
                                ? '!border-l-0 border-b-1 py-2 justify-center text-sm'
                                : 'py-3 mt-4 rounded-component'
                        }`}
                        $color={`${color}${position === 'header' ? '66' : '33'}`}
                        style={{
                            borderColor: color,
                            borderBottom: position === 'header' ? `1px solid ${color}66` : 'none',
                        }}
                    >
                        {icon === 'party-popper' ? (
                            <LuPartyPopper />
                        ) : icon === 'megaphone' ? (
                            <LuMegaphone />
                        ) : icon === 'info' ? (
                            <LuInfo />
                        ) : icon === 'circle-check' ? (
                            <LuCircleCheck />
                        ) : icon === 'circle-alert' ? (
                            <LuCircleAlert />
                        ) : icon === 'triangle-alert' ? (
                            <LuTriangleAlert />
                        ) : icon === 'life-buoy' ? (
                            <LuLifeBuoy />
                        ) : icon === 'flame' ? (
                            <LuFlame />
                        ) : (
                            ''
                        )}

                        <div>
                            <Markdown>{message}</Markdown>
                        </div>

                        <div className={`flex items-center gap-x-4 ${position === 'header' ? 'ml-4' : 'ml-auto'}`}>
                            {cta && (
                                <>
                                    <a
                                        href={ctaLink}
                                        className={`rounded-full border border-white/40 px-4 hover:bg-white/20 duration-300 ${
                                            position === 'header' ? 'py-1' : 'py-2'
                                        }`}
                                    >
                                        {ctaTitle}
                                    </a>

                                    {dismissable && <hr className='w-[1px] h-8 bg-white/20' />}
                                </>
                            )}
                            {dismissable && (
                                <button className={'p-2 hover:bg-white/20 duration-300 rounded'} onClick={handleClose}>
                                    <LuCircleX />
                                </button>
                            )}
                        </div>
                    </MyAlert>
                )}
            </ContentContainer>
        </div>
    );
};

export default Announcement;
