import React, { useEffect, useState } from 'react';
import { Server } from '@/api/server/getServer';
import getServers from '@/api/getServers';
import useSWR from 'swr';
import { PaginatedResult } from '@/api/http';
import { useLocation, useHistory } from 'react-router-dom';
import Select from '@/components/elements/Select';
import { useTranslation } from 'react-i18next';

export default () => {
    const { t } = useTranslation('arix/navigation');
    const { search } = useLocation();
    const defaultPage = Number(new URLSearchParams(search).get('page') || '1');

    const [page, setPage] = useState(!isNaN(defaultPage) && defaultPage > 0 ? defaultPage : 1);

    const { data: servers } = useSWR<PaginatedResult<Server>>(['/api/client/servers', page], () =>
        getServers({ page })
    );

    useEffect(() => {
        if (!servers) return;
        if (servers.pagination.currentPage > 1 && !servers.items.length) {
            setPage(1);
        }
    }, [servers?.pagination.currentPage]);

    const history = useHistory();

    const handleChange = (value: string) => {
        history.push(value);
    };

    return (
        <div className={'w-[250px]'}>
            <Select
                onChange={(event) => handleChange(event.target.value)}
                value={window.location.pathname.split('/', 3).join('/')}
                className={'selection-container'}
            >
                <option value={`/`} style={{ display: 'none' }}>
                    {t('select-a-server')}
                </option>
                {servers && servers.items.length > 0 ? (
                    servers.items.map((server) => (
                        <option value={`/server/${server.id}`} key={server.uuid}>
                            {server.name}
                        </option>
                    ))
                ) : (
                    <option value={`/`}>{t('no-servers')}</option>
                )}
            </Select>
        </div>
    );
};
