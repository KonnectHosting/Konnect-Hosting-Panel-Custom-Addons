import TransferListener from '@/components/server/TransferListener';
import React, { useEffect, useState } from 'react';
import { useRouteMatch } from 'react-router-dom';
import WebsocketHandler from '@/components/server/WebsocketHandler';
import { ApplicationStore } from '@/state';
import Announcement from '@/components/elements/Announcement';
import { ServerContext } from '@/state/server';
import Spinner from '@/components/elements/Spinner';
import { ServerError } from '@/components/elements/ScreenBlock';
import { httpErrorToHuman } from '@/api/http';
import { useStoreState } from 'easy-peasy';
import InformationBar from '@/routers/layouts/InformationBar';

import LowResourcesAlert from '@/components/server/LowResourcesAlert';
import PanelSounds from '@/components/server/PanelSounds';
import InstallListener from '@/components/server/InstallListener';
import NodeAlert from '@/components/server/NodeAlert';
import ErrorBoundary from '@/components/elements/ErrorBoundary';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import ConflictStateRenderer from '@/components/server/ConflictStateRenderer';
import { Navigation, ComponentLoader } from '@/routers/RouterElements';
import { ip } from '@/lib/formatters';
import { useFloating } from '@/context/FloatingContext';
import UnpaidInvoiceAlert from '@/components/server/UnpaidInvoiceAlert';
import LayoutWrapper from './layouts/LayoutWrapper';

import { GlobeIcon } from '@heroicons/react/outline';
import PowerButtons from '@/components/server/console/PowerButtons';
import CopyOnClick from '@/components/elements/CopyOnClick';
import Can from '@/components/elements/Can';
import SlimBar from './layouts/SlimBar';
import ContentContainer from '@/components/elements/ContentContainer';
import PillBar from './layouts/PillBar';
import CollapsibleConsole from '@/components/server/CollapsibleConsole';

/*
        ██╗██╗  ░██╗░░░░░░░██╗░█████╗░██████╗░███╗░░██╗  ██╗██╗
        ██║██║  ░██║░░██╗░░██║██╔══██╗██╔══██╗████╗░██║  ██║██║
        ██║██║  ░╚██╗████╗██╔╝███████║██████╔╝██╔██╗██║  ██║██║
        ╚═╝╚═╝  ░░████╔═████║░██╔══██║██╔══██╗██║╚████║  ╚═╝╚═╝
        ██╗██╗  ░░╚██╔╝░╚██╔╝░██║░░██║██║░░██║██║░╚███║  ██╗██╗
        ╚═╝╚═╝  ░░░╚═╝░░░╚═╝░░╚═╝░░╚═╝╚═╝░░╚═╝╚═╝░░╚══╝  ╚═╝╚═╝


        Read this before doing addon modifications

        Arix Theme has already handled many panel 
        modifications for you, so there's no need for 
        any changes in the "ServerRouter.tsx" file.
*/

export default () => {
    const match = useRouteMatch<{ id: string }>();
    const location = useLocation();
    const { floating: isFloating } = useFloating();

    const { t } = useTranslation('arix/navigation');

    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const { layout, dock } = useStoreState((state: ApplicationStore) => state.settings.data!.arix.layout);
    const position = useStoreState((state: ApplicationStore) => state.settings.data!.arix.announcement.position);
    const [error, setError] = useState('');

    const name = ServerContext.useStoreState((state) => state.server.data?.name);
    const id = ServerContext.useStoreState((state) => state.server.data?.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data?.uuid);
    const inConflictState = ServerContext.useStoreState((state) => state.server.inConflictState);
    const serverId = ServerContext.useStoreState((state) => state.server.data?.internalId);
    const getServer = ServerContext.useStoreActions((actions) => actions.server.getServer);
    const clearServerState = ServerContext.useStoreActions((actions) => actions.clearServerState);
    const status = ServerContext.useStoreState((state) => state.status.value);

    const allocation = ServerContext.useStoreState((state) => {
        const match = state.server.data?.allocations.find((allocation) => allocation.isDefault);

        return !match ? 'n/a' : `${match.alias || ip(match.ip)}:${match.port}`;
    });

    useEffect(
        () => () => {
            clearServerState();
        },
        []
    );

    useEffect(() => {
        setError('');

        getServer(match.params.id).catch((error) => {
            console.error(error);
            setError(httpErrorToHuman(error));
        });

        return () => {
            clearServerState();
        };
    }, [match.params.id]);

    return !uuid || !id ? (
        error ? (
            <ServerError message={error} />
        ) : (
            <Spinner size={'large'} centered />
        )
    ) : (
        <LayoutWrapper
            type={(layout === 'default' || layout === 'floating') && dock === 'sidebar'}
            navItems={
                <React.Fragment>
                    {(layout === 'default' || layout === 'floating') && dock === 'sidebar' && (
                        <div className={'px-5 py-3 border-b border-gray-500 lg:!flex !hidden flex-col gap-1'}>
                            <div className='flex items-center gap-x-1'>
                                <span className='font-semibold text-lg text-gray-50 overflow-hidden text-ellipsis whitespace-nowrap'>
                                    {name}
                                </span>
                                <div
                                    className={`w-4 h-4 shrink-0 rounded-full opacity-50
                                    ${
                                        status === 'offline'
                                            ? 'bg-danger-200'
                                            : status === 'running'
                                            ? 'bg-success-200'
                                            : status === 'starting'
                                            ? 'bg-yellow-500'
                                            : 'bg-red-500'
                                    }
                                `}
                                />
                            </div>
                            <CopyOnClick text={allocation}>
                                <p className='text-sm flex gap-x-1 items-center privacy:blur-sm hover:privacy:blur-none duration-300'>
                                    <GlobeIcon className='w-4 text-gray-300' />
                                    {allocation}
                                </p>
                            </CopyOnClick>
                            <Can action={['control.start', 'control.stop', 'control.restart']} matchAny>
                                <PowerButtons className='w-full grid grid-cols-3 gap-2 mt-3' icons />
                            </Can>
                        </div>
                    )}
                    <Navigation />
                    {rootAdmin && (
                        // eslint-disable-next-line react/jsx-no-target-blank
                        <a href={`/admin/servers/view/${serverId}`} target={'_blank'} className={'mt-3 routers_link'}>
                            <FontAwesomeIcon icon={faExternalLinkAlt} /> <span>{t`admin-view`}</span>
                        </a>
                    )}
                </React.Fragment>
            }
        >
            <PanelSounds />
            <InstallListener />
            <TransferListener />
            <WebsocketHandler />
            {inConflictState && (!rootAdmin || (rootAdmin && !location.pathname.endsWith(`/server/${id}`))) ? (
                <ConflictStateRenderer />
            ) : (
                <ErrorBoundary>
                    {!isFloating && (
                        <React.Fragment>
                            <div className={'lg:block hidden'}>
                                {layout === 'horizontal' && <InformationBar />}
                                {(layout === 'default' ||
                                    layout === 'floating' ||
                                    layout === 'slim' ||
                                    layout === 'pill') &&
                                    (dock === 'top' && layout !== 'pill' ? (
                                        <InformationBar />
                                    ) : (
                                        ((dock === 'header' && layout !== 'floating') || layout === 'pill') && (
                                            <SlimBar />
                                        )
                                    ))}
                            </div>
                            <div className={'lg:hidden block'}>
                                <InformationBar />
                            </div>
                            <UnpaidInvoiceAlert />
                            <LowResourcesAlert />
                        </React.Fragment>
                    )}
                    <CollapsibleConsole />
                    {layout === 'pill' && !isFloating ? (
                        <ContentContainer>
                            <div className='flex gap-4'>
                                <div className='my-6 sm:mb-10'>
                                    <PillBar>
                                        <Navigation />
                                        {rootAdmin && (
                                            // eslint-disable-next-line react/jsx-no-target-blank
                                            <a
                                                href={`/admin/servers/view/${serverId}`}
                                                target={'_blank'}
                                                className={'mt-3 routers_link'}
                                            >
                                                <FontAwesomeIcon icon={faExternalLinkAlt} />{' '}
                                                <span>{t`admin-view`}</span>
                                            </a>
                                        )}
                                    </PillBar>
                                </div>
                                <div className='flex-1'>
                                    {!isFloating && (
                                        <React.Fragment>
                                            <NodeAlert />
                                            {position === 'top' && <Announcement />}
                                        </React.Fragment>
                                    )}
                                    <ComponentLoader />
                                </div>
                            </div>
                        </ContentContainer>
                    ) : (
                        <React.Fragment>
                            {!isFloating && (
                                <React.Fragment>
                                    <NodeAlert />
                                    {position === 'top' && <Announcement />}
                                </React.Fragment>
                            )}
                            <ComponentLoader />
                        </React.Fragment>
                    )}
                </ErrorBoundary>
            )}
        </LayoutWrapper>
    );
};
