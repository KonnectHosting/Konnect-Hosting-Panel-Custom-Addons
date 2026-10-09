import React, { useEffect, useState } from "react";
import TitledGreyBox from "@/components/elements/TitledGreyBox";
import getChangeEggs, { Eggs, changeEgg } from "@/api/server/eggChanger";
import { ServerContext } from "@/state/server";
import Select from "@/components/elements/Select";
import { Dialog } from "@/components/elements/dialog/index";
import { ApplicationStore } from "@/state";
import { useStoreState } from "easy-peasy";
import Switch from "@/components/elements/Switch";
import { Button } from "@/components/elements/button/index";
import useFlash from "@/plugins/useFlash";
import FlashMessageRender from "@/components/FlashMessageRender";
import addonAvailable from "@/plugins/addonAvailable";
import { useTranslation } from "react-i18next";

export default function EggChanger() {
    const { t } = useTranslation('arix/server/addons/eggchanger');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedEgg, setSelectedEgg] = useState<{ id: number, name: string } | null>(null);
    const [changeableEggs, setChangeableEggs] = useState<Eggs>();
    const { addFlash, clearFlashes } = useFlash();
    const { forceStartup } = useStoreState((state: ApplicationStore) => state.settings.data!.addons.eggChanger);
    const { uuid, eggId, nestId } = ServerContext.useStoreState((state) => state.server.data!);

    const [updateStartup, setForceStartup] = useState(false);
    const [reinstall, setReinstall] = useState(false);

    useEffect(() => {
        clearFlashes('server:egg-changer');
        getChangeEggs(uuid).then((response) => {
            setChangeableEggs(response);
        }).catch((error) => {
            console.error(error);
            addFlash({
                type: 'error',
                key: 'server:egg-changer',
                message: t('failed-to-fetch')
            });
        });
    }, [uuid]);

    const ChangeEgg = () => {
        if (!selectedEgg) return;

        changeEgg({
            uuid,
            eggId: selectedEgg.id,
            updateStartup: updateStartup,
            reinstall: reinstall
        }).then(() => {
            setIsOpen(false);
            addFlash({
                type: 'success',
                key: 'server:egg-changer',
                message: `${t('success')} ${selectedEgg.name}.`
            });
        }).catch((error) => {
            console.error(error);
            addFlash({
                type: 'error',
                key: 'server:egg-changer',
                message: 'Failed to change egg. Please try again later.'
            });
        });
    };

    if (addonAvailable('eggChanger', nestId, eggId) === false) {
        return null;
    }

    return (
        <React.Fragment>
            <FlashMessageRender byKey={'server:egg-changer'} />
            <Dialog
                title={`Switch to ${selectedEgg?.name}`}
                open={isOpen}
                onClose={() => setIsOpen(false)}
            >
                {!forceStartup && (
                    <div className="mb-4">
                        <Switch
                            name="forceStartup"
                            label={t('update-startup')}
                            description={t('update-startup-help')}
                            checked={updateStartup}
                            onChange={() => setForceStartup(!updateStartup)}
                        />
                    </div>
                )}
                <Switch
                    name="reinstall"
                    label={t('reinstall-server')}
                    description={t('reinstall-server-help')}
                    checked={reinstall}
                    onChange={() => setReinstall(!reinstall)}
                />
                <Dialog.Footer>
                    <Button.Text onClick={() => setIsOpen(false)}>{t('cancel')}</Button.Text>
                    <Button
                        color="primary"
                        onClick={ChangeEgg}
                    >
                        {t('switch-egg')}
                    </Button>
                </Dialog.Footer>
            </Dialog>
            <TitledGreyBox title={t('egg-changer')}>
                <Select
                    value={selectedEgg?.id || ''}
                    onChange={(e) => {
                        const egg = changeableEggs?.eggs.find((v) => v.id === parseInt(e.target.value));
                        setSelectedEgg(egg || null);
                    }}
                >
                    <option value={''} disabled selected>
                        {t('select-egg')}
                    </option>
                    {changeableEggs?.eggs.map((egg) => (
                        <option key={egg.id} value={egg.id}>
                            {egg.name}
                        </option>
                    ))}
                </Select>
                <div className="flex justify-end mt-4">
                    <Button onClick={() => setIsOpen(true)} disabled={!selectedEgg}>
                        {t('switch-egg')}
                    </Button>
                </div>
            </TitledGreyBox>
        </React.Fragment>
    )
}