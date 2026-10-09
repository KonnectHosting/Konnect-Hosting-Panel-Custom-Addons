import tw from 'twin.macro';
import React, { useState } from 'react';
import { useFlashKey } from '@/plugins/useFlash';
import { deleteSSHKey, useSSHKeys } from '@/api/account/ssh-keys';
import { Dialog } from '@/components/elements/dialog';
import Code from '@/components/elements/Code';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/elements/button/index';
import { TrashIcon } from '@heroicons/react/outline';

export default ({ name, fingerprint }: { name: string; fingerprint: string }) => {
    const { t } = useTranslation('arix/account');
    const { clearAndAddHttpError } = useFlashKey('account');
    const [visible, setVisible] = useState(false);
    const { mutate } = useSSHKeys();

    const onClick = () => {
        clearAndAddHttpError();

        Promise.all([
            mutate((data) => data?.filter((value) => value.fingerprint !== fingerprint), false),
            deleteSSHKey(fingerprint),
        ]).catch((error) => {
            mutate(undefined, true).catch(console.error);
            clearAndAddHttpError(error);
        });
    };

    return (
        <>
            <Dialog.Confirm
                open={visible}
                title={t('sshKey.deleteForm.delete-ssh-key')}
                confirm={t('sshKey.deleteForm.delete-key')}
                onConfirmed={onClick}
                onClose={() => setVisible(false)}
            >
                {t('sshKey.deleteForm.will-invalidate-1')} <Code>{name}</Code>{' '}
                {t('sshKey.deleteForm.will-invalidate-2')}
            </Dialog.Confirm>
            <Button.Danger variant={Button.Variants.Secondary} onClick={() => setVisible(true)}>
                <TrashIcon css={tw`w-4 h-4`} />
            </Button.Danger>
        </>
    );
};
