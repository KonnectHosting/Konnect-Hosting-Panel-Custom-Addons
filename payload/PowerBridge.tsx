import http, { httpErrorToHuman } from '@/api/http';

/** Used by the shared socket client, including themed power buttons. */
export default function guardedPower(
    token: string,
    event: string,
    payload: string | string[] | undefined,
    emit: (event: string, message: string) => void
): boolean {
    if (event !== 'set state') return false;
    let claims: { server_uuid?: string; permissions?: string[] };
    try {
        const body = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        claims = JSON.parse(atob(body));
    } catch {
        return false;
    }
    if (!claims.permissions?.includes('gmod.toolkit.guarded-power')) return false;
    const uuid = claims.server_uuid;
    const signal = Array.isArray(payload) ? payload[0] : payload;
    if (!uuid || !/^[a-f0-9-]{36}$/i.test(uuid) || !signal || !['start', 'restart', 'stop', 'kill'].includes(signal)) {
        emit('daemon error', 'Invalid guarded power request. Refresh the page and retry.');
        return true;
    }
    http.post(`/api/client/servers/${uuid}/power`, { signal })
        .then(() =>
            emit(
                'console output',
                ['start', 'restart'].includes(signal)
                    ? 'GMod Toolkit: power request queued for a code check. Open Backdoor Scanner for progress or review.'
                    : 'GMod Toolkit: power action sent; any queued start was cancelled.'
            )
        )
        .catch((error) => emit('daemon error', httpErrorToHuman(error)));
    return true;
}
