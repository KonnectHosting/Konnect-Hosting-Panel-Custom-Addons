import React from 'react';
import {
    LuChevronRight,
    LuCreditCard,
    LuLifeBuoy,
    LuRouter,
    LuTwitter,
    LuInstagram,
    LuLinkedin,
    LuYoutube,
    LuGithub,
} from 'react-icons/lu';
import { RxDiscordLogo } from 'react-icons/rx';

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

const SOCIAL_BUTTON_CLASS =
    'group w-full bg-gray-700 backdrop boxBorder rounded-box flex items-center justify-between px-6 py-5';

interface SocialButtonProps {
    social: {
        icon: keyof typeof ICON_MAP;
        title: string;
        description: string;
        url: string;
    };
    index: number;
}

export default ({ social, index }: SocialButtonProps) => {
    const IconComponent = ICON_MAP[social.icon];

    if (!IconComponent) return null;

    return (
        <a key={index} href={social.url} target='_blank' rel='noopener noreferrer' className={SOCIAL_BUTTON_CLASS}>
            <div>
                <p className={'font-medium text-gray-100 flex items-center'}>
                    {social.title}
                    <LuChevronRight className={'opacity-0 ml-0 group-hover:opacity-75 group-hover:ml-2 duration-300'} />
                </p>
                <span className={'font-light text-sm text-gray-200'}>{social.description}</span>
            </div>
            <IconComponent className={'text-[2.5rem] text-arix'} />
        </a>
    );
};
