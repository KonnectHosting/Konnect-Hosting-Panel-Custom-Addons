import React, { useState } from 'react';
import { Button } from '@/components/elements/button/index';
import { ServerContext } from '@/state/server';
import Spinner from '@/components/elements/Spinner';
import useFlash from '@/plugins/useFlash';
import deleteSubdomain from '@/api/server/subdomains/deleteSubdomain';
import FlashMessageRender from '@/components/FlashMessageRender';
import { Dialog } from '@/components/elements/dialog';
import tw from 'twin.macro';
import { TrashIcon } from '@heroicons/react/outline';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import { useTranslation } from 'react-i18next';

const DeleteSubdomainButton: React.FC<{ id: string }> = ({ id }) => {
    const { t } = useTranslation('arix/server/addons/subdomains');
    const [isOpen, setIsOpen] = useState(false);
    const removeSubdomain = ServerContext.useStoreActions((actions) => actions.subdomains.removeSubdomain);
    const serverId = ServerContext.useStoreState((state) => state.server.data!.id);
    const { addError, clearFlashes } = useFlash();
    const [loading, setLoading] = useState(false);

    const DeleteSubdomain = () => {
        setLoading(true);
        setIsOpen(false);
        clearFlashes('subdomains:delete');

        deleteSubdomain(serverId, id)
            .then(() => {
                removeSubdomain(id);
            })
            .catch((error) => {
                addError({ key: 'subdomains:delete', message: error.message });
            })
            .finally(() => {
                setLoading(false); 
            });
    }

    return(
        <>
        <FlashMessageRender byKey={'subdomains:delete'} css={tw`mb-4`} />
        <Dialog.Confirm
            open={isOpen}
            hideCloseIcon
            onClose={() => setIsOpen(false)}
            title={t('delete.delete-subdomain')}
            confirm={t('delete.continue')}
            onConfirmed={DeleteSubdomain}
        >
            {t('delete.are-you-sure')}
        </Dialog.Confirm>
        <Tooltip content={`${t('delete.delete-subdomain')}`} placement={'top'}>
            <Button.Danger 
                variant={Button.Variants.Secondary} 
                onClick={() => setIsOpen(true)} 
                disabled={loading} 
                className={'flex items-center gap-x-1'}
            >
                {loading 
                ? <Spinner size={'small'} />
                : <TrashIcon className={'w-4'} /> }
            </Button.Danger>
        </Tooltip>
        </>
    )
}

export default DeleteSubdomainButton;