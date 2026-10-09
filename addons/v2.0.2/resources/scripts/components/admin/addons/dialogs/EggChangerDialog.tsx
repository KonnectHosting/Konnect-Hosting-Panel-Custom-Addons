import React, { useEffect, useState } from 'react';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import Spinner from '@/components/elements/Spinner';
import Switch from '@/components/elements/Switch';
import Label from '@/components/elements/Label';
import Select from '@/components/elements/Select';
import NestSelector from '@/components/admin/link/NestSelector';
import { EggProps, getEggs, getNests } from '@/api/admin/Link';
import { AddonSettings, updateAddon } from '@/api/admin/Addons';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';

type Restriction = 'none' | 'nestBased' | 'custom';

interface Props {
    open: boolean;
    data: {
        forceStartup: boolean;
        restriction: Restriction;
        eggMap: Record<number, number[]>;
    } & AddonSettings;
    onClose: () => void;
    onSave: (data: AddonSettings) => void;
}

export default ({ open, data, onClose, onSave }: Props) => {
    const [enabled, setEnabled] = useState(data.enabled);
    const [eggs, setEggs] = useState<number[]>(data.eggs);
    const [nests, setNests] = useState<number[]>(data.nests);
    const [forceStartup, setForceStartup] = useState(data.forceStartup);
    const [restriction, setRestriction] = useState<Restriction>(data.restriction ?? 'none');
    const [eggMap, setEggMap] = useState<Record<number, number[]>>(data.eggMap ?? {});
    const [saving, setSaving] = useState(false);
    const { addFlash, clearFlashes } = useFlash();

    const [eggsById, setEggsById] = useState<Record<number, { name: string; nestName: string }>>({});

    useEffect(() => {
        const fetchEggs = async () => {
            try {
                const nestsList = await getNests();
                const entries = await Promise.all(
                    nestsList.map(async (nest) => {
                        const nestEggs = await getEggs(nest.attributes.id);

                        return nestEggs.map(
                            (egg: EggProps) =>
                                [egg.attributes.id, { name: egg.attributes.name, nestName: nest.attributes.name }] as const
                        );
                    })
                );

                setEggsById(Object.fromEntries(entries.flat()));
            } catch (error) {
                console.error('Error fetching eggs:', error);
            }
        };

        fetchEggs();
    }, []);

    // Keeps eggMap consistent whenever the enabled-eggs list changes: drops
    // mappings for eggs that are no longer enabled, both as a source and as
    // a destination.
    const updateEggs = (newEggs: number[]) => {
        setEggs(newEggs);
        setEggMap((prev) => {
            const next: Record<number, number[]> = {};
            for (const source of newEggs) {
                if (prev[source] === undefined) {
                    continue;
                }

                next[source] = prev[source].filter((destination) => newEggs.includes(destination));
            }

            return next;
        });
    };

    const toggleDestination = (sourceEggId: number, destinationEggId: number) => {
        setEggMap((prev) => {
            const current = prev[sourceEggId] ?? [];
            const next = current.includes(destinationEggId)
                ? current.filter((id) => id !== destinationEggId)
                : [...current, destinationEggId];

            return { ...prev, [sourceEggId]: next };
        });
    };

    const handleSave = async () => {
        setSaving(true);
        clearFlashes();
        try {
            const result = await updateAddon('eggChanger', {
                enabled,
                eggs,
                nests,
                forceStartup,
                restriction,
                eggMap,
            });
            onSave(result);
            onClose();
        } catch (err) {
            addFlash({ type: 'error', message: httpErrorToHuman(err) });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} title='Egg Changer'>
            <div className='flex items-center justify-between mb-4'>
                <p>Enable Egg Changer</p>
                <Switch name='enabled' checked={enabled} onChange={() => setEnabled((v) => !v)} />
            </div>
            <div className='flex items-center justify-between mb-4'>
                <p>Force Startup Change</p>
                <Switch name='forceStartup' checked={forceStartup} onChange={() => setForceStartup((v) => !v)} />
            </div>
            <div className='mb-4'>
                <Label htmlFor='restriction'>Destination Restriction</Label>
                <Select
                    name='restriction'
                    value={restriction}
                    onChange={(e) => setRestriction(e.currentTarget.value as Restriction)}
                >
                    <option value='none'>None — can change into any egg</option>
                    <option value='nestBased'>Nest-based — only eggs in the same nest</option>
                    <option value='custom'>Custom — pick allowed destinations per egg</option>
                </Select>
                <p className='text-xs text-neutral-400 mt-1'>
                    {restriction === 'custom'
                        ? 'Nests below are ignored while Custom is selected — only the eggs you enable are eligible, and you must pick their allowed destinations below.'
                        : 'Nests below grant access to every egg in them, in addition to any individually enabled eggs.'}
                </p>
            </div>
            <NestSelector
                selectedNests={nests}
                setSelectedNests={setNests}
                selectedEggs={eggs}
                setSelectedEggs={updateEggs}
                hideNests={restriction === 'custom'}
            />
            {restriction === 'custom' && (
                <div className='mt-4'>
                    <Label className='mb-2'>Per-Egg Destinations</Label>
                    {eggs.length === 0 ? (
                        <p className='text-sm text-neutral-400'>Select at least one egg above to configure it.</p>
                    ) : (
                        <div className='space-y-3 max-h-64 overflow-y-auto'>
                            {eggs.map((sourceEggId) => {
                                const destinations = eggMap[sourceEggId] ?? [];
                                const candidates = eggs.filter((id) => id !== sourceEggId);

                                return (
                                    <div
                                        key={sourceEggId}
                                        className='bg-gray-700 border border-gray-500 rounded-component p-3'
                                    >
                                        <p className='text-sm font-medium mb-2'>
                                            {eggsById[sourceEggId]?.name ?? `Egg #${sourceEggId}`}
                                        </p>
                                        {candidates.length === 0 ? (
                                            <p className='text-xs text-neutral-400'>
                                                Enable another egg above to allow it as a destination.
                                            </p>
                                        ) : (
                                            <div className='flex flex-wrap gap-2'>
                                                {candidates.map((destinationEggId) => {
                                                    const active = destinations.includes(destinationEggId);

                                                    return (
                                                        <button
                                                            key={destinationEggId}
                                                            type='button'
                                                            onClick={() =>
                                                                toggleDestination(sourceEggId, destinationEggId)
                                                            }
                                                            className={`text-xs px-2 py-1 rounded border duration-300 ${
                                                                active
                                                                    ? 'bg-arix/10 border-arix/50 text-gray-50'
                                                                    : 'border-gray-500 hover:bg-gray-600'
                                                            }`}
                                                        >
                                                            {eggsById[destinationEggId]?.name ??
                                                                `Egg #${destinationEggId}`}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
            <Dialog.Footer>
                <Button.Text onClick={onClose}>Cancel</Button.Text>
                <Button onClick={handleSave} disabled={saving} className='flex items-center gap-x-2'>
                    Save
                    {saving && <Spinner size='small' />}
                </Button>
            </Dialog.Footer>
        </Dialog>
    );
};
