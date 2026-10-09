import React from 'react';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import { ServerContext } from '@/state/server';
import { useStoreState } from 'easy-peasy';
import isEqual from 'react-fast-compare';
import Can from '@/components/elements/Can';
import CopyOnClick from '@/components/elements/CopyOnClick';
import Input from '@/components/elements/Input';
import Label from '@/components/elements/Label';
import { Button } from '@/components/elements/button/index';
import tw from 'twin.macro';
import { ip } from '@/lib/formatters';
import { useTranslation } from 'react-i18next';

const Sftp = () => {
    const { t } = useTranslation('arix/server/dashboard');
    const username = useStoreState((state) => state.user.data!.username);
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const sftp = ServerContext.useStoreState((state) => state.server.data!.sftpDetails, isEqual);

    return (
        <Can action={'file.sftp'}>
            <TitledGreyBox title={t('sftp.title')}>
                <div>
                    <Label>{t('sftp.server-address')}</Label>
                    <CopyOnClick text={`sftp://${ip(sftp.ip)}:${sftp.port}`}>
                        <Input
                            type={'text'}
                            className='privacy-blur'
                            value={`sftp://${ip(sftp.ip)}:${sftp.port}`}
                            readOnly
                        />
                    </CopyOnClick>
                </div>
                <div css={tw`mt-6`}>
                    <Label>{t('sftp.username')}</Label>
                    <CopyOnClick text={`${username}.${id}`}>
                        <Input type={'text'} value={`${username}.${id}`} className='privacy-blur' readOnly />
                    </CopyOnClick>
                </div>
                <div css={tw`mt-6 p-3 border-2 border-gray-500 rounded-component flex items-center`}>
                    <div css={tw`flex-1`}>
                        <p css={tw`text-xs text-neutral-200`}>{t('sftp.description')}</p>
                    </div>
                    <div css={tw`ml-4`}>
                        <a href={`sftp://${username}.${id}@${ip(sftp.ip)}:${sftp.port}`}>
                            <Button.Text variant={Button.Variants.Secondary}>{t('sftp.launch-sftp')}</Button.Text>
                        </a>
                    </div>
                </div>
            </TitledGreyBox>
        </Can>
    );
};

export default Sftp;
