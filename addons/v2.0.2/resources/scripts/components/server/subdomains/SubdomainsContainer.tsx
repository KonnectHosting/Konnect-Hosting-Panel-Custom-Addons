import React, { useState, useEffect } from 'react';
import { ServerContext } from '@/state/server';
import getSubdomains from '@/api/server/subdomains/getSubdomains';
import useFlash from '@/plugins/useFlash';
import FlashMessageRender from '@/components/FlashMessageRender';
import CreateSubdomainButton from '@/components/server/subdomains/CreateSubdomainButton';
import DeleteSubdomainButton from '@/components/server/subdomains/DeleteSubdomainButton';
import { useDeepMemoize } from '@/plugins/useDeepMemoize';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import CopyOnClick from '@/components/elements/CopyOnClick';
import Spinner from '@/components/elements/Spinner';
import Can from '@/components/elements/Can';
import ItemList, { ItemRow, ItemCell } from '@/components/elements/ItemList';
import tw from 'twin.macro';
import { useTranslation } from 'react-i18next';
import { HiOutlineGlobeAlt } from "react-icons/hi";

const DomainsContainer = () => {
    const { t } = useTranslation('arix/server/addons/subdomains');
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const [loading, setLoading] = useState<boolean>(true);
    const { addError, clearFlashes } = useFlash();

    const subdomains = useDeepMemoize(ServerContext.useStoreState((state) => state.subdomains.data));
    const setSubdomains = ServerContext.useStoreActions((state) => state.subdomains.setSubdomains);

    const subdomainLimit = ServerContext.useStoreState((state) => state.server.data!.featureLimits.subdomains);
    const subdomainCount = Object.keys(subdomains).length;


    useEffect(() => {
        setLoading(!subdomains.length);
        clearFlashes('subdomains');

        getSubdomains(id)
            .then((response) => {
                setSubdomains(response.data);
            })
            .catch((error) => {
                addError({ key: 'subdomains', message: error });
            })
            .finally(() => {
                setLoading(false); 
            });
    }, []);

    return (
        <ServerContentBlock 
            title={t('subdomains')} 
            icon={HiOutlineGlobeAlt}
        >
            <FlashMessageRender byKey={'subdomains'} />
            {!subdomains.length && loading ? 
                <Spinner size={'large'} centered />
                :
                <ItemList
                    title={
                        <div className={'flex lg:flex-row flex-col gap-2 items-start justify-between'}>
                            <div>
                                <p className={'text-medium text-gray-300'}>{t('manage-subdomains')}</p>
                                {subdomainLimit > 0 && subdomainCount > 0 && (
                                    <p css={tw`text-sm text-neutral-300 mt-1`}>
                                        {t('you-are-currently-using', { current: subdomainCount, max: subdomainLimit })}
                                    </p>
                                )}
                            </div>
                            <Can action={'allocation.create'}>
                                {subdomainLimit > 0 && subdomainLimit !== subdomainCount && (
                                    <CreateSubdomainButton />
                                )}
                            </Can>
                        </div>
                    }
                    headers={
                        <tr>
                            <th>{t('subdomain')}</th>
                            <th>{t('allocation')}</th>
                            <th></th>
                        </tr>
                    }
                >
                    {subdomainCount > 0 ?
                        Object.entries(subdomains as Record<string, {
                            full_domain: string;
                            ip: string;
                            port: number;
                        }>).filter(([, domain]) => !!domain).map(([key, domain]) => (
                            <ItemRow key={key}>
                                <ItemCell>
                                    <CopyOnClick text={domain.full_domain}>
                                        <p>{domain.full_domain}</p>
                                    </CopyOnClick>
                                </ItemCell>
                                <ItemCell>
                                    <CopyOnClick text={`${domain.ip}:${domain.port}`}>
                                        <p>{domain.ip}:{domain.port}</p>
                                    </CopyOnClick>
                                </ItemCell>
                                <ItemCell className={'w-1'}>
                                    <Can action={'allocation.delete'}>
                                        <DeleteSubdomainButton id={key} />
                                    </Can>
                                </ItemCell>
                            </ItemRow>
                        ))
                    :
                        <ItemRow>
                            <ItemCell colSpan={5} css={tw`text-center text-sm`}>
                                {t('no-subdomains')}
                            </ItemCell>
                        </ItemRow>
                    }
                </ItemList>
            }
        </ServerContentBlock>
    );
};

export default DomainsContainer;