import React, { useEffect, useState } from 'react';
import { Button } from '@/components/elements/button/index';
import { Dialog } from '@/components/elements/dialog';
import { SubuserPreset, deletePreset, getPresets } from '@/api/server/users/subuserPreset';
import { ServerContext } from '@/state/server';
import EditPresetModal from '@/components/server/users/presets/EditPresetModal';
import useFlash from '@/plugins/useFlash';
import { TrashIcon } from '@heroicons/react/outline';
import FlashMessageRender from '@/components/FlashMessageRender';
import { useTranslation } from 'react-i18next';

export default () => {
    const { t } = useTranslation('arix/server/users');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { clearFlashes, addFlash } = useFlash();
    const [presetOpen, setPresetOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [presets, setPresets] = useState<SubuserPreset[]>([]);
    const [editing, setEditing] = useState<SubuserPreset | undefined>();

    const load = () => getPresets(uuid).then(setPresets);

    useEffect(() => {
        if (presetOpen) load();
    }, [presetOpen]);

    const openEdit = (preset?: SubuserPreset) => {
        setEditing(preset);
        setPresetOpen(false);
        setEditOpen(true);
    };

    const DeletePreset = (preset: SubuserPreset) => {
        clearFlashes();

        deletePreset(uuid, preset.id)
            .then(() => {
                setPresets((presets) => presets.filter((p) => p.id !== preset.id));
            })
            .then(() => {
                addFlash({
                    key: 'server:users:preset',
                    type: 'success',
                    title: 'Success',
                    message: `${preset.name} deleted.`,
                });
            })
            .catch(() => {
                addFlash({
                    key: 'server:users:preset',
                    type: 'error',
                    title: 'Error',
                    message: `Failed to delete ${preset.name}.`,
                });
            });
    };

    return (
        <>
            <FlashMessageRender byKey={'server:users:preset'} />
            <EditPresetModal open={editOpen} onClose={() => setEditOpen(false)} preset={editing} onSaved={load} />
            <Dialog
                open={presetOpen}
                onClose={() => setPresetOpen(false)}
                title={t('presets.title')}
                description={t('presets.description')}
            >
                {presets.length === 0 ? (
                    <p className={'text-sm text-gray-300 text-center pt-4'}>{t('presets.no-presets')}</p>
                ) : (
                    presets.map((preset) => (
                        <div key={preset.id} className={'flex items-center justify-between pt-4'}>
                            <span>{preset.name}</span>
                            <span className={'text-sm bg-gray-600 px-2 py-1 rounded'}>
                                {preset.permissions.length} {t('presets.permissions')}
                            </span>
                            <div className={'flex space-x-2'}>
                                <Button.Text size={Button.Sizes.Small} onClick={() => openEdit(preset)}>
                                    {t('presets.edit')}
                                </Button.Text>
                                <Button.Danger size={Button.Sizes.Small} onClick={() => DeletePreset(preset)}>
                                    <TrashIcon className={'w-4 h-4'} />
                                </Button.Danger>
                            </div>
                        </div>
                    ))
                )}
                <Dialog.Footer>
                    <Button.Text onClick={() => setPresetOpen(false)}>{t('presets.close')}</Button.Text>
                    <Button onClick={() => openEdit(undefined)}>{t('presets.create-preset')}</Button>
                </Dialog.Footer>
            </Dialog>
            <Button.Text onClick={() => setPresetOpen(true)}>{t('presets.title')}</Button.Text>
        </>
    );
};
