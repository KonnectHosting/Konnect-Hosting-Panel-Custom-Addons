import { ApplicationStore } from '@/state';
import { useStoreState } from 'easy-peasy';
import React, { useEffect } from 'react';
import SideBar from './SideBar';
import IconBar from './IconBar';
import NavigationBar from './NavigationBar';
import Announcement from '@/components/elements/Announcement';
import { useFloating } from '@/context/FloatingContext';

export default ({
    type,
    navItems,
    children,
}: {
    type?: boolean;
    navItems?: React.ReactNode;
    children: React.ReactNode;
}) => {
    const layout = useStoreState((state: ApplicationStore) => state.settings.data!.arix.layout.layout);
    const position = useStoreState((state: ApplicationStore) => state.settings.data!.arix.announcement.position);
    const { background, backgroundFaded } = useStoreState(
        (state: ApplicationStore) => state.settings.data!.arix.styling
    );

    const { floating: isFloating, setFloating } = useFloating();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('floating') === 'true') {
            setFloating(true);
        }
    }, [location.search]);

    return isFloating ? (
        <div>{children}</div>
    ) : (
        <>
            <div className={`min-h-screen flex h-full bg-gray-800 relative z-10`}>
                {background && (
                    <div
                        className={`absolute top-0 left-0 w-full h-full bg-center bg-no-repeat bg-cover bg-fixed -z-10 
                    ${backgroundFaded === 'translucent' ? 'opacity-50' : 'opacity-100'}
                    ${
                        backgroundFaded === 'faded'
                            ? `after:content-[''] after:bg-center after:bg-cover after:bg-fixed after:absolute after:inset-0 after:bg-gradient-to-b from-transparent to-gray-800`
                            : ''
                    }
                `}
                        css={`
                            background-image: var(--image);
                        `}
                    />
                )}

                {/* SIDEBARS WILL GO HERE - THIS IS NOT AI */}
                {(layout === 'default' || layout === 'floating') && <SideBar type={type}>{navItems}</SideBar>}
                {layout === 'slim' && <IconBar>{navItems}</IconBar>}

                {/* REST OF THE CONTENT */}
                <div className='w-full'>
                    {position === 'header' && <Announcement />}
                    <NavigationBar>{navItems}</NavigationBar>
                    {children}
                </div>
            </div>
        </>
    );
};
