import React, { useState } from 'react';
import { Dialog } from '@/components/elements/dialog';
import { ServerContext } from '@/state/server';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import { Subuser } from '@/state/server/subusers';
import { Button } from '@/components/elements/button/index';
import deleteSubuser from '@/api/server/users/deleteSubuser';
import { Actions, useStoreActions } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { httpErrorToHuman } from '@/api/http';
import { useTranslation } from 'react-i18next';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';

export default ({ subuser }: { subuser: Subuser }) => {
    const { t } = useTranslation('arix/server/users');
    const [loading, setLoading] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const removeSubuser = ServerContext.useStoreActions((actions) => actions.subusers.removeSubuser);
    const { addError, clearFlashes } = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes);

    const doDeletion = () => {
        setLoading(true);
        clearFlashes('users');
        deleteSubuser(uuid, subuser.uuid)
            .then(() => {
                setLoading(false);
                removeSubuser(subuser.uuid);
            })
            .catch((error) => {
                console.error(error);
                addError({ key: 'users', message: httpErrorToHuman(error) });
                setShowConfirmation(false);
            });
    };

    return (
        <>
            <Dialog.Confirm
                title={t('delete-this-subuser')}
                confirm={t('yes-remove')}
                open={showConfirmation}
                onConfirmed={() => doDeletion()}
                onClose={() => setShowConfirmation(false)}
            >
                <SpinnerOverlay visible={loading} />
                {t('are-you-sure-to-remove')}
            </Dialog.Confirm>
            <Button.Danger onClick={() => setShowConfirmation(true)}>
                <FontAwesomeIcon icon={faTrashAlt} />
            </Button.Danger>
        </>
    );
};
