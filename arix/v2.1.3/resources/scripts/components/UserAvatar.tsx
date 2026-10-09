import * as React from 'react';
import { useStoreState } from 'easy-peasy';
import Md5 from 'md5';
import { ApplicationStore } from '@/state';
import Avatar from '@/components/Avatar';

interface Props {
    email?: string;
    user?: string;
    uuid?: string;
    width?: string;
    rounded?: string;
}

export default ({ email, user, uuid, width, rounded }: Props) => {
    const profileType = useStoreState((state: ApplicationStore) => state.settings.data!.arix.advanced.profileType);
    const username = useStoreState((state) => state.user.data?.username);
    const useremail = useStoreState((state) => state.user.data?.email);

    return profileType === 'boring' ? (
        <div
            className={`${rounded ? rounded : 'rounded-full'} overflow-hidden flex items-center`}
            css={`
                width: ${width ? width : '32px'};
            `}
        >
            {uuid ? <Avatar name={uuid} size={width} /> : <Avatar.User size={width} />}
        </div>
    ) : profileType === 'gravatar' ? (
        <img
            src={`https://www.gravatar.com/avatar/${Md5(String(email ? email : useremail))}`}
            width={width ? width : '32px'}
            className={rounded ? rounded : 'rounded-full'}
            alt='Gravatar'
        />
    ) : profileType === 'avataaars' ? (
        <img
            src={`https://api.dicebear.com/9.x/big-ears-neutral/svg?seed=${user ? user : username}`}
            width={width ? width : '32px'}
            className={rounded ? rounded : 'rounded-full'}
            alt='Dicebear Avatar'
        />
    ) : profileType === 'bottts' ? (
        <img
            src={`https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${user ? user : username}`}
            width={width ? width : '32px'}
            className={rounded ? rounded : 'rounded-full'}
            alt='Dicebear Avatar'
        />
    ) : profileType === 'identicon' ? (
        <img
            src={`https://api.dicebear.com/9.x/identicon/svg?seed=${user ? user : username}`}
            width={width ? width : '32px'}
            className={rounded ? rounded : 'rounded-full'}
            alt='Dicebear Avatar'
        />
    ) : profileType === 'initials' ? (
        <img
            src={`https://api.dicebear.com/9.x/initials/svg?seed=${user ? user : username}`}
            width={width ? width : '32px'}
            className={rounded ? rounded : 'rounded-full'}
            alt='Dicebear Avatar'
        />
    ) : profileType === 'thumbs' ? (
        <img
            src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${user ? user : username}`}
            width={width ? width : '32px'}
            className={rounded ? rounded : 'rounded-full'}
            alt='Dicebear Avatar'
        />
    ) : profileType === 'glass' ? (
        <img
            src={`https://api.dicebear.com/9.x/glass/svg?seed=${user ? user : username}`}
            width={width ? width : '32px'}
            className={rounded ? rounded : 'rounded-full'}
            alt='Dicebear Avatar'
        />
    ) : profileType === 'toon-head' ? (
        <img
            src={`https://api.dicebear.com/9.x/toon-head/svg?seed=${user ? user : username}`}
            width={width ? width : '32px'}
            className={rounded ? rounded : 'rounded-full'}
            alt='Dicebear Avatar'
        />
    ) : profileType === 'dylan' ? (
        <img
            src={`https://api.dicebear.com/9.x/dylan/svg?seed=${user ? user : username}`}
            width={width ? width : '32px'}
            className={rounded ? rounded : 'rounded-full'}
            alt='Dicebear Avatar'
        />
    ) : profileType === 'big-smile' ? (
        <img
            src={`https://api.dicebear.com/9.x/big-smile/svg?seed=${user ? user : username}`}
            width={width ? width : '32px'}
            className={rounded ? rounded : 'rounded-full'}
            alt='Dicebear Avatar'
        />
    ) : (
        <></>
    );
};
