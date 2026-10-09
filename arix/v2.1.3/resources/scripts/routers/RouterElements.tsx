import React from 'react';
import { ServerContext } from '@/state/server';
import routes from '@/routers/routes';
import { NavLink, Route, Switch, useRouteMatch } from 'react-router-dom';
import PermissionRoute from '@/components/elements/PermissionRoute';
import Spinner from '@/components/elements/Spinner';
import { NotFound, PremiumFeature } from '@/components/elements/ScreenBlock';
import TransitionRouter from '@/TransitionRouter';
import { useLocation } from 'react-router';
import { ApplicationStore } from '@/state';
import { useStoreState } from 'easy-peasy';
import Icon from '@/components/admin/elements/IconMap';
import Can from '@/components/elements/Can';
import { LinkCategory, LinkItem } from '@/api/admin/Link';
import { useTranslation } from 'react-i18next';
import { StarIcon } from '@heroicons/react/solid';
import DropdownMenu, { DropdownButtonRow } from '@/components/elements/DropdownMenu';
import { DotsVerticalIcon } from '@heroicons/react/outline';
import { LuAppWindow, LuPictureInPicture } from 'react-icons/lu';

const shouldDisplayRoute = (route: any, nestId?: number, eggId?: number): boolean => {
    const hasNoRestrictions = !route.eggIds && !route.nestIds && !route.nestId && !route.eggId;
    if (hasNoRestrictions) return true;
    if (nestId === undefined && eggId === undefined) return false;
    const hasNestMatch = (route.nestIds?.includes(nestId) ?? false) || (route.nestId != null && route.nestId === nestId);
    const hasEggMatch = (route.eggIds?.includes(eggId) ?? false) || (route.eggId != null && route.eggId === eggId);
    return hasNestMatch || hasEggMatch;
};

const useServerIds = () => {
    const nestId = ServerContext.useStoreState((state) => state.server.data?.nestId);
    const eggId = ServerContext.useStoreState((state) => state.server.data?.eggId);
    const tier = ServerContext.useStoreState((state) => state.server.data?.tier);

    return { nestId, eggId, tier };
};

const usePathBuilder = () => {
    const match = useRouteMatch<{ id: string }>();
    return (value: string, useUrl = false) => {
        const base = (useUrl ? match.url : match.path).replace(/\/*$/, '');
        return `${base}/${value.replace(/^\/+/, '')}`;
    };
};

const getAdjustedPath = (path: string, isDashboardDisabled: boolean) =>
    path === '/console' && isDashboardDisabled ? '/' : path;

const LinkDropdown = ({ link }: { link: string }) => {
    return (
        <DropdownMenu
            renderToggle={(onClick) => (
                <button
                    className='z-10 absolute top-2 right-3 opacity-0 group-hover:opacity-100 transition-opacity rounded-component bg-gray-500 p-1'
                    type='button'
                    onClick={onClick}
                >
                    <DotsVerticalIcon className='w-4 h-4 text-gray-200' />
                </button>
            )}
        >
            <DropdownButtonRow onClick={() => window.open(link, '_blank')}>
                <LuAppWindow /> New tab
            </DropdownButtonRow>
            <DropdownButtonRow onClick={() => window.open(`${link}?floating=true`, '_blank', 'noopener,noreferrer,width=600,height=400')}>
                <LuPictureInPicture /> New window
            </DropdownButtonRow>
        </DropdownMenu>
    )
}

const Link = (props: LinkItem) => {
    const { t } = useTranslation('arix/navigation');
    const { nestId, eggId, tier } = useServerIds();
    const tierVisibility = useStoreState(
        (state: ApplicationStore) => state.settings.data!.arix.advanced.tierVisibility
    );

    const permissions = (props.permission ?? []).filter((permission) => permission && permission.trim().length > 0);
    const hasPermissions = permissions.length > 0;

    const hasNestRestrictions = Array.isArray(props.nests) && props.nests.length > 0;
    const hasEggRestrictions = Array.isArray(props.eggs) && props.eggs.length > 0;
    const hasTierRestrictions = Array.isArray(props.tier) && props.tier.length > 0;

    const nestMatches = hasNestRestrictions && typeof nestId === 'number' && props.nests?.includes(nestId) === true;
    const eggMatches = hasEggRestrictions && typeof eggId === 'number' && props.eggs?.includes(eggId) === true;
    const tierMatches =
        hasTierRestrictions && tier !== null && tier !== undefined && props.tier?.includes(tier) === true;

    const hasRestrictions = hasNestRestrictions || hasEggRestrictions || hasTierRestrictions;

    const showStar =
        hasTierRestrictions && tier !== null && tier !== undefined && !tierMatches && tierVisibility === 'show';
    const shouldHide =
        hasTierRestrictions && tier !== null && tier !== undefined && !tierMatches && tierVisibility === 'hidden';

    const buildPath = usePathBuilder();

    if (hasRestrictions && !nestMatches && !eggMatches) {
        if (hasNestRestrictions || hasEggRestrictions || shouldHide) {
            return null;
        }
    }

    const starIcon = showStar ? <StarIcon className='w-3 text-yellow-500' /> : null;

    const linkContent = (
        <>
            <div className='routers_link_icon'>
                <Icon name={props.icon} size='1.25rem' />
            </div>
            <span className='routers_link_title'>{t(props.name)}</span>
            {starIcon}
        </>
    );

    const inner = props.url.includes('http') ? (
        <div className='group relative'>
            <a key={props.name} href={props.url} target='_blank' rel='noreferrer' className='routers_link'>
                {linkContent}
            </a>
            <LinkDropdown link={props.url} />
        </div>
    ) : (
        <div className='group relative'>
            <NavLink
                key={props.name}
                to={buildPath(props.url, true)}
                exact={props.url === '/'}
                className='routers_link'
            >
                {linkContent}
            </NavLink>
            <LinkDropdown link={buildPath(props.url, true)} />
        </div>
    );

    return hasPermissions ? (
        <Can action={permissions} matchAny>
            {inner}
        </Can>
    ) : (
        inner
    );
};

const Category = (props: LinkCategory) => {
    const { t } = useTranslation('arix/navigation');
    const { nestId, eggId } = useServerIds();
    const permissions = (props.permission ?? []).filter((permission) => permission && permission.trim().length > 0);
    const hasPermissions = permissions.length > 0;
    const hasNestRestrictions = Array.isArray(props.nests) && props.nests.length > 0;
    const hasEggRestrictions = Array.isArray(props.eggs) && props.eggs.length > 0;
    const nestMatches = hasNestRestrictions && typeof nestId === 'number' && props.nests?.includes(nestId) === true;
    const eggMatches = hasEggRestrictions && typeof eggId === 'number' && props.eggs?.includes(eggId) === true;
    const hasRestrictions = hasNestRestrictions || hasEggRestrictions;

    if (hasRestrictions && !nestMatches && !eggMatches) {
        return null;
    }

    return hasPermissions ? (
        <Can action={permissions} matchAny>
            <div key={props.name} className='routers_category-wrapper'>
                <span className='routers_category'>{t(props.name)}</span>
                <div className='routers_links'>
                    {props.links.map((link) => (
                        <Link key={link.name} {...link} />
                    ))}
                </div>
            </div>
        </Can>
    ) : (
        <div className='routers_category-wrapper'>
            <span className='routers_category'>{t(props.name)}</span>
            <div className='routers_links'>
                {props.links.map((link) => (
                    <Link key={link.name} {...link} />
                ))}
            </div>
        </div>
    );
};

export const Navigation = () => {
    const links = useStoreState((state: ApplicationStore) => state.settings.data!.arix.links);

    return (
        <React.Fragment>
            {Object.values(links ?? {}).map((category, index) => (
                <Category key={index} {...category} />
            ))}
        </React.Fragment>
    );
};

export const ComponentLoader = () => {
    const location = useLocation();
    const links = useStoreState((state: ApplicationStore) => state.settings.data!.arix.links);
    const dashboardPage = useStoreState((state: ApplicationStore) => state.settings.data!.arix.advanced.dashboardPage);
    const { nestId, eggId, tier } = useServerIds();
    const buildPath = usePathBuilder();

    const canShowWithTier = (routePath: string): boolean => {
        const link = Object.values(links ?? {})
            .flatMap((category) => category.links)
            .find((link) => link.url === routePath);

        if (!link) return true;
        if (!Array.isArray(link.tier) || link.tier.length === 0) return true;
        if (tier == null) return true;

        return link.tier.includes(tier);
    };

    return (
        <TransitionRouter>
            <Switch location={location}>
                {routes.server.map((route) => {
                    if (!shouldDisplayRoute(route, nestId, eggId)) return null;
                    if (route.path === '/' && !dashboardPage) return null;

                    const path = getAdjustedPath(route.path, !dashboardPage);
                    const Component = route.component;

                    if (!canShowWithTier(path)) return <PremiumFeature />;

                    return (
                        <PermissionRoute key={path} permission={route.permission} path={buildPath(path)} exact>
                            <Spinner.Suspense>
                                <Component />
                            </Spinner.Suspense>
                        </PermissionRoute>
                    );
                })}
                <Route path={'*'} component={NotFound} />
            </Switch>
        </TransitionRouter>
    );
};
