import React from 'react';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import { ServerContext } from '@/state/server';
import { useStoreState } from 'easy-peasy';
import RenameServerBox from '@/components/server/settings/RenameServerBox';
import FlashMessageRender from '@/components/FlashMessageRender';
import Can from '@/components/elements/Can';
import ReinstallServerBox from '@/components/server/settings/ReinstallServerBox';
import tw from 'twin.macro';
import Input from '@/components/elements/Input';
import Label from '@/components/elements/Label';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import isEqual from 'react-fast-compare';
import CopyOnClick from '@/components/elements/CopyOnClick';
import { ip } from '@/lib/formatters';
import { Button } from '@/components/elements/button/index';
import { CogIcon } from '@heroicons/react/outline';
import { useTranslation } from 'react-i18next';

export default () => {
    const { t } = useTranslation('arix/server/settings');
    const username = useStoreState((state) => state.user.data!.username);
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const node = ServerContext.useStoreState((state) => state.server.data!.node);
    const nodeIcon = ServerContext.useStoreState((state) => state.server.data!.nodeIcon);
    const sftp = ServerContext.useStoreState((state) => state.server.data!.sftpDetails, isEqual);

    return (
        <ServerContentBlock title={t('settings')} icon={CogIcon}>
            <FlashMessageRender byKey={'settings'} css={tw`mb-4`} />
            <div css={tw`grid lg:grid-cols-2 items-start gap-4`}>
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
                        <div css={tw`mt-6 flex items-center`}>
                            <div css={tw`flex-1`}>
                                <div css={tw`border-l-4 border-cyan-500 p-3`}>
                                    <p css={tw`text-xs text-neutral-200`}>{t('sftp.description')}</p>
                                </div>
                            </div>
                            <div css={tw`ml-4`}>
                                <a href={`sftp://${username}.${id}@${ip(sftp.ip)}:${sftp.port}`}>
                                    <Button.Text variant={Button.Variants.Secondary}>
                                        {t('sftp.launch-sftp')}
                                    </Button.Text>
                                </a>
                            </div>
                        </div>
                    </TitledGreyBox>
                </Can>
                <Can action={'settings.rename'}>
                    <RenameServerBox />
                </Can>
                <TitledGreyBox title={t('debug.title')}>
                    <div css={tw`flex items-center justify-between text-sm`}>
                        <p>{t('debug.node')}</p>
                        <div css={tw`flex items-center gap-x-1`}>
                            {nodeIcon && <img src={nodeIcon} alt={node} css={tw`w-5 h-5 object-cover rounded-sm`} />}
                            <code css={tw`font-mono bg-neutral-900 rounded py-1 px-2`}>{node}</code>
                        </div>
                    </div>
                    <CopyOnClick text={uuid}>
                        <div css={tw`flex items-center justify-between mt-2 text-sm`}>
                            <p>{t('debug.server-id')}</p>
                            <code
                                className={`privacy:blur-sm hover:privacy:blur-none duration-300 font-mono bg-neutral-900 rounded py-1 px-2`}
                            >
                                {uuid}
                            </code>
                        </div>
                    </CopyOnClick>
                </TitledGreyBox>
                <Can action={'settings.reinstall'}>
                    <ReinstallServerBox />
                </Can>
            </div>
        </ServerContentBlock>
    );
};
