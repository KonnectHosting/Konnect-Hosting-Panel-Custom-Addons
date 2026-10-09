import React from 'react';
import { FaDiscord } from 'react-icons/fa';

const DISCORD_BOX_CLASS =
    'group lg:max-w-[275px] w-full border border-[#6374AC] hover:border-[#97A8E0] rounded-box flex items-center justify-between px-6 py-5 duration-300';
const DISCORD_BOX_STYLE = 'background-image:radial-gradient(circle, rgba(27,43,104,1) 0%, rgba(9,39,78,1) 100%);';

interface DiscordGuildData {
    instant_invite: string;
    presence_count: number;
}

interface DiscordWidgetProps {
    guildData: DiscordGuildData | null;
    t: (key: string) => string;
}

export default ({ guildData, t }: DiscordWidgetProps) => (
    <a
        href={guildData?.instant_invite || '#'}
        target='_blank'
        rel='noopener noreferrer'
        className={DISCORD_BOX_CLASS}
        css={DISCORD_BOX_STYLE}
    >
        <div>
            <span className={'font-light text-sm text-white/70'}>
                {guildData?.presence_count || 0} {t('members-online')}
            </span>
            <p className={'font-medium text-white'}>{t('join-our-discord')}</p>
        </div>
        <FaDiscord className={'text-[2.5rem] text-white/70 group-hover:text-white duration-300'} />
    </a>
);
