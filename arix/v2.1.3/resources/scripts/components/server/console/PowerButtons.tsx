import React, { useEffect, useState } from 'react';
import { Button } from '@/components/elements/button/index';
import Can from '@/components/elements/Can';
import { ServerContext } from '@/state/server';
import { StopIcon, RefreshIcon, PlayIcon, MinusCircleIcon } from '@heroicons/react/outline';
import { PowerAction } from '@/components/server/console/ServerConsoleContainer';
import { Dialog } from '@/components/elements/dialog';
import { useTranslation } from 'react-i18next';

interface PowerButtonProps {
    icons?: boolean;
    className?: string;
}

export default ({ className, icons }: PowerButtonProps) => {
    const { t } = useTranslation('arix/utilities');
    const [open, setOpen] = useState(false);
    const status = ServerContext.useStoreState((state) => state.status.value);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);

    const killable = status === 'stopping';
    const onButtonClick = (
        action: PowerAction | 'kill-confirmed',
        e: React.MouseEvent<HTMLButtonElement, MouseEvent>
    ): void => {
        e.preventDefault();
        if (action === 'kill') {
            return setOpen(true);
        }

        if (instance) {
            setOpen(false);
            instance.send('set state', action === 'kill-confirmed' ? 'kill' : action);
        }
    };

    useEffect(() => {
        if (status === 'offline') {
            setOpen(false);
        }
    }, [status]);

    return (
        <div className={className}>
            <Dialog.Confirm
                open={open}
                hideCloseIcon
                onClose={() => setOpen(false)}
                title={t('forcibly-stop-process')}
                confirm={t('continue')}
                onConfirmed={onButtonClick.bind(this, 'kill-confirmed')}
            >
                {t('forcibly-stopping-alert')}
            </Dialog.Confirm>
            <Can action={'control.start'}>
                <Button.Success
                    className={'flex items-center gap-x-1'}
                    disabled={status !== 'offline'}
                    size={icons ? Button.Sizes.Small : undefined}
                    onClick={onButtonClick.bind(this, 'start')}
                >
                    <PlayIcon className={'w-5'} /> {!icons && t('start')}
                </Button.Success>
            </Can>
            <Can action={'control.restart'}>
                <Button.Text
                    size={icons ? Button.Sizes.Small : undefined}
                    className={'flex items-center gap-x-1'}
                    disabled={!status}
                    onClick={onButtonClick.bind(this, 'restart')}
                >
                    <RefreshIcon className={'w-5'} /> {!icons && t('restart')}
                </Button.Text>
            </Can>
            <Can action={'control.stop'}>
                <Button.Danger
                    size={icons ? Button.Sizes.Small : undefined}
                    className={'flex items-center gap-x-1'}
                    disabled={status === 'offline'}
                    onClick={onButtonClick.bind(this, killable ? 'kill' : 'stop')}
                >
                    {killable ? <MinusCircleIcon className={'w-5'} /> : <StopIcon className={'w-5'} />}
                    {!icons && <>{killable ? t('kill') : t('stop')}</>}
                </Button.Danger>
            </Can>
        </div>
    );
};
