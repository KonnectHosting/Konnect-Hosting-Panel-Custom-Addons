import useSWR, { ConfigInterface, responseInterface } from 'swr';
import { ActivityLog, Transformers } from '@definitions/user';
import { AxiosError } from 'axios';
import http, { PaginatedResult } from '@/api/http';
import { toPaginatedSet } from '@definitions/helpers';
import { useUserSWRKey } from '@/plugins/useSWRKey';

const useSessionHistory = (
    page?: number,
    config?: ConfigInterface<PaginatedResult<ActivityLog>, AxiosError>
): responseInterface<PaginatedResult<ActivityLog>, AxiosError> => {
    const key = useUserSWRKey(['account', 'sessions', String(page ?? 1)]);

    return useSWR<PaginatedResult<ActivityLog>>(
        key,
        async () => {
            const { data } = await http.get('/api/client/account/sessions', {
                params: { page: page ?? 1, per_page: 10 },
            });

            return toPaginatedSet(data, Transformers.toActivityLog);
        },
        { revalidateOnMount: true, ...(config || {}) }
    );
};

export { useSessionHistory };
