import React from 'react';
import { NavLink, Route, Switch } from 'react-router-dom';
import { NotFound } from '@/components/elements/ScreenBlock';
import TransitionRouter from '@/TransitionRouter';
import { useLocation } from 'react-router';
import Spinner from '@/components/elements/Spinner';
import UserAvatar from '@/components/UserAvatar';
import { FaDiscord } from 'react-icons/fa';
import { HiOutlineInboxIn, HiOutlineSupport } from 'react-icons/hi';
import tw, { styled } from 'twin.macro';
import {
    LuCog,
    LuCornerDownLeft,
    LuLayoutGrid,
    LuLayoutPanelLeft,
    LuListPlus,
    LuMailbox,
    LuMegaphone,
    LuPaintBucket,
    LuPuzzle,
    LuShare2,
    LuSparkles,
    LuTags,
    LuWandSparkles,
} from 'react-icons/lu';
import GeneralContainer from '@/components/admin/general/GeneralContainer';
import AnnouncementContainer from '@/components/admin/announcement/AnnouncementContainer';
import StylingContainer from '@/components/admin/styling/StylingContainer';
import LinksContainer from '@/components/admin/link/LinkContainer';
import LayoutsContainer from '@/components/admin/layouts/LayoutsContainer';
import ComponentsContainer from '@/components/admin/components/ComponentsContainer';
import DashboardContainer from '@/components/admin/dashboard/DashboardContainer';
import AddonsContainer from '@/components/admin/addons/AddonsContainer';
import ColorsContainer from '@/components/admin/colors/ColorsContainer';
import SeoContainer from '@/components/admin/seo/SeoContainer';
import MailContainer from '@/components/admin/mail/MailContainer';
import SocialContainer from '@/components/admin/social/SocialContainer';
import AdvancedContainer from '@/components/admin/advanced/AdvancedContainer';
import PresetContainer from '@/components/admin/preset/PresetContainer';

const Link = styled(NavLink)`
    ${tw`relative flex items-center p-2 duration-300 border border-transparent hover:bg-gray-700 rounded-component`}

    & > span {
        ${tw`absolute text-sm z-30 left-full whitespace-nowrap text-gray-50 bg-gray-500 rounded-component px-2 py-1 pointer-events-none opacity-0 duration-300`}
    }

    & > svg {
        ${tw`w-6 h-6`}
    }

    &.active {
        ${tw`text-secondary-50 bg-secondary-200 border-secondary-100`}
    }

    &:hover {
        & > span {
            ${tw`opacity-100 ml-2`}
        }
    }
`;

const AnchorLink = styled.a`
    ${tw`relative flex items-center p-2 duration-300 border border-transparent hover:bg-gray-700 rounded-component`}

    & > span {
        ${tw`absolute text-sm z-30 left-full whitespace-nowrap text-gray-50 bg-gray-500 rounded-component px-2 py-1 pointer-events-none opacity-0 duration-300`}
    }

    & > svg {
        ${tw`w-6 h-6`}
    }

    &.active {
        ${tw`text-secondary-50 bg-secondary-200 border-secondary-100`}
    }

    &:hover {
        & > span {
            ${tw`opacity-100 ml-2`}
        }
    }
`;

export default () => {
    const location = useLocation();

    return (
        <>
            <div className='flex justify-between items-center border-b border-gray-500 !border-x-0 !border-t-0 px-3 py-2'>
                <a href='/' className='flex items-center gap-x-2 text-lg font-semibold text-gray-50 py-1'>
                    <img src='/arix/Arix.png' width={32} height={32} />
                    Arix Editor
                </a>
                <div className='flex items-center gap-x-8'>
                    <NavLink
                        to='/admin/arix/preset'
                        className='flex items-center gap-x-1 font-medium bg-clip-text text-transparent bg-gradient-to-r from-gray-50 via-gray-200 to-arix duration-300'
                    >
                        <HiOutlineInboxIn className='w-5 h-5 text-gray-50' />
                        Community Templates
                    </NavLink>
                    <a
                        href='https://arix.gg/community'
                        target='_blank'
                        rel='noreferrer'
                        className='flex items-center gap-x-1 font-medium hover:text-gray-50 duration-300'
                    >
                        <FaDiscord className='w-5 h-5' />
                        Discord
                    </a>
                    <a
                        href='https://arix.gg/docs'
                        target='_blank'
                        rel='noreferrer'
                        className='flex items-center gap-x-1 font-medium hover:text-gray-50 duration-300'
                    >
                        <HiOutlineSupport className='w-5 h-5' />
                        Support
                    </a>
                    <a href='/account'>
                        <UserAvatar width={'32px'} />
                    </a>
                </div>
            </div>
            <div className='flex h-[calc(100dvh-57px)]'>
                <div className='flex flex-col h-full border-r border-gray-500 p-3 gap-2'>
                    <Link to='/admin/arix' exact>
                        <LuWandSparkles />
                        <span>General</span>
                    </Link>
                    <Link to='/admin/arix/announcement'>
                        <LuMegaphone />
                        <span>Announcement</span>
                    </Link>
                    <Link to='/admin/arix/styling'>
                        <LuSparkles />
                        <span>Styling</span>
                    </Link>
                    <Link to='/admin/arix/links'>
                        <LuListPlus />
                        <span>Links</span>
                    </Link>
                    <Link to='/admin/arix/layouts'>
                        <LuLayoutPanelLeft />
                        <span>Layouts</span>
                    </Link>
                    <Link to='/admin/arix/components'>
                        <LuLayoutGrid />
                        <span>Components</span>
                    </Link>
                    <Link to='/admin/arix/colors'>
                        <LuPaintBucket />
                        <span>Colors</span>
                    </Link>
                    <Link to='/admin/arix/seo'>
                        <LuTags />
                        <span>SEO</span>
                    </Link>
                    <Link to='/admin/arix/mail'>
                        <LuMailbox />
                        <span>Mail Template</span>
                    </Link>
                    <Link to='/admin/arix/social'>
                        <LuShare2 />
                        <span>Social Links</span>
                    </Link>
                    <Link to='/admin/arix/addons'>
                        <LuPuzzle />
                        <span>Addons</span>
                    </Link>
                    <Link to='/admin/arix/advanced'>
                        <LuCog />
                        <span>Advanced</span>
                    </Link>
                    <AnchorLink className='mt-auto' href='/admin'>
                        <LuCornerDownLeft />
                        <span>Admin</span>
                    </AnchorLink>
                </div>
                <div className='flex-1 h-full'>
                    <TransitionRouter>
                        <React.Suspense fallback={<Spinner centered />}>
                            <Switch location={location}>
                                <Route path={'/admin/arix'} exact>
                                    <GeneralContainer />
                                </Route>
                                <Route path={'/admin/arix/announcement'} exact>
                                    <AnnouncementContainer />
                                </Route>
                                <Route path={'/admin/arix/styling'} exact>
                                    <StylingContainer />
                                </Route>
                                <Route path={'/admin/arix/links'} exact>
                                    <LinksContainer />
                                </Route>
                                <Route path={'/admin/arix/layouts'} exact>
                                    <LayoutsContainer />
                                </Route>
                                <Route path={'/admin/arix/components'} exact>
                                    <ComponentsContainer />
                                </Route>
                                <Route path={'/admin/arix/dashboard'} exact>
                                    <DashboardContainer />
                                </Route>
                                <Route path={'/admin/arix/colors'} exact>
                                    <ColorsContainer />
                                </Route>
                                <Route path={'/admin/arix/seo'} exact>
                                    <SeoContainer />
                                </Route>
                                <Route path={'/admin/arix/mail'} exact>
                                    <MailContainer />
                                </Route>
                                <Route path={'/admin/arix/social'} exact>
                                    <SocialContainer />
                                </Route>
                                <Route path={'/admin/arix/addons'} exact>
                                    <AddonsContainer />
                                </Route>
                                <Route path={'/admin/arix/advanced'} exact>
                                    <AdvancedContainer />
                                </Route>
                                <Route path={'/admin/arix/preset'} exact>
                                    <PresetContainer />
                                </Route>
                                <Route path={'*'}>
                                    <NotFound />
                                </Route>
                            </Switch>
                        </React.Suspense>
                    </TransitionRouter>
                </div>
            </div>
        </>
    );
};
