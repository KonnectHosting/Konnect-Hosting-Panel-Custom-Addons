import React, { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import Input from '@/components/elements/Input';
import CopyOnClick from '@/components/elements/CopyOnClick';
import { useTranslation } from 'react-i18next';
import getRules from '@/api/server/subdomains/getRules';
import { ApplicationStore } from '@/state';
import { useStoreState } from 'easy-peasy';

export default function RecordGenerator(){
    const { t } = useTranslation('arix/server/addons/network');
    const [domain, setDomain] = useState<string>('play.example.com');
    const nestId = ServerContext.useStoreState((state) => state.server.data?.nestId ?? 0);
    const [records, setRecords] = useState<Record<string, string>>({});
    const enabled = useStoreState((state: ApplicationStore) => state.settings.data!.addons.recordGenerator);

    useEffect(() => {
        getRules({ nest: nestId }).then((rules) => {
            setRecords(rules.data);
        });
    }, [nestId]);
    const ip = ServerContext.useStoreState((state) => {
        const match = state.server.data?.allocations.find((allocation) => allocation.isDefault);

        return !match ? 'n/a' : `${match.ip}`;
    });
    const port = ServerContext.useStoreState((state) => {
        const match = state.server.data?.allocations.find((allocation) => allocation.isDefault);

        return !match ? 'n/a' : `${match.port}`;
    });

    if ((records === null || Object.keys(records).length === 0) || !enabled) {
        return null;
    }

    return (
        <TitledGreyBox title={t('record-generator')} className={'mt-4'}>
            <p className={'mb-2'}>{t('description')}</p>

            <Input
                type="text"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="play.example.com"
            />

            <div className={`duration-300 ${domain === 'play.example.com' ? 'blur-sm pointer-events-none' : ''}`}>
                <div className={'grid lg:grid-cols-3 gap-2 px-5 py-4 bg-gray-600 mt-4 rounded-lg'}>
                    <div>
                        <p className={'text-sm font-medium text-gray-300'}>TYPE</p>
                        A
                    </div>
                    <CopyOnClick text={domain}>
                        <div>
                            <p className={'text-sm font-medium text-gray-300'}>NAME</p>
                            {domain}
                        </div>
                    </CopyOnClick>
                    <CopyOnClick text={ip}>
                        <div>
                            <p className={'text-sm font-medium text-gray-300'}>CONTENT</p>
                            {ip}
                        </div>
                    </CopyOnClick>
                </div>
                <div className={'grid lg:grid-cols-3 gap-2 px-5 py-4 bg-gray-600 mt-2 rounded-lg'}>
                    <div>
                        <p className={'text-sm font-medium text-gray-300'}>TYPE</p>
                        SRV
                    </div>
                    <div>
                        <CopyOnClick text={`${records.prefix}${domain}`}>
                            <div>
                                <p className={'text-sm font-medium text-gray-300'}>NAME</p>
                                {records.prefix}{domain}
                            </div>
                        </CopyOnClick>
                    </div>
                    <div>
                        <CopyOnClick text={`0 5 ${port} ${domain}`}>
                            <div>
                                <p className={'text-sm font-medium text-gray-300'}>CONTENT</p>
                                0 5 {port} {domain}
                            </div>
                        </CopyOnClick>
                    </div>
                </div>
            </div>
        </TitledGreyBox>
    )
}
