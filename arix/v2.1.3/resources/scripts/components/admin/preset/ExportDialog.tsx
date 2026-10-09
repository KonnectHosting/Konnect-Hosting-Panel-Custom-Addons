import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import Input from '@/components/elements/Input';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';

export default () => {
    const arixSettings = useStoreState((state: ApplicationStore) => state.settings.data!.arix);
    const preset = JSON.stringify(arixSettings, null, 2);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedGroups, setSelectedGroups] = useState<Record<string, boolean>>({});

    const parsedPreset = useMemo<Record<string, unknown>>(() => {
        try {
            return JSON.parse(preset) as Record<string, unknown>;
        } catch {
            return {};
        }
    }, [preset]);

    const { categoryKeys, otherKeys, hasOther } = useMemo(() => {
        const categories: string[] = [];
        const others: string[] = [];

        Object.entries(parsedPreset).forEach(([key, value]) => {
            if (value !== null && typeof value === 'object') {
                categories.push(key);
            } else {
                others.push(key);
            }
        });

        categories.sort();
        others.sort();

        return {
            categoryKeys: categories,
            otherKeys: others,
            hasOther: others.length > 0,
        };
    }, [parsedPreset]);

    useEffect(() => {
        setSelectedGroups((prev) => {
            const next = { ...prev };
            for (const key of categoryKeys) {
                if (next[key] === undefined) {
                    next[key] = true;
                }
            }
            if (hasOther && next.other === undefined) {
                next.other = true;
            }
            return next;
        });
    }, [categoryKeys, hasOther]);

    const buildExportPayload = (): Record<string, unknown> => {
        const output: Record<string, unknown> = {};

        for (const key of categoryKeys) {
            if (selectedGroups[key]) {
                output[key] = parsedPreset[key];
            }
        }

        if (hasOther && selectedGroups.other) {
            for (const key of otherKeys) {
                output[key] = parsedPreset[key];
            }
        }

        return output;
    };

    const exportSettings = () => {
        const filename = `preset-${Date.now()}.arix`;
        const data = JSON.stringify(buildExportPayload(), null, 2);
        const blob = new Blob([btoa(data)], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    return (
        <>
            <Dialog title='Export Preset' open={isOpen} onClose={() => setIsOpen(false)}>
                <p>Select which categories you want to export.</p>

                <div className='mt-4 space-y-2'>
                    {categoryKeys.map((key) => (
                        <label key={key} className='flex items-center gap-2 text-sm text-neutral-200 capitalize'>
                            <Input
                                type='checkbox'
                                checked={Boolean(selectedGroups[key])}
                                onChange={() => {
                                    setSelectedGroups((prev) => ({
                                        ...prev,
                                        [key]: !prev[key],
                                    }));
                                }}
                            />
                            {key}
                        </label>
                    ))}
                    {hasOther && (
                        <label className='flex items-center gap-2 text-sm text-neutral-200'>
                            <Input
                                type='checkbox'
                                checked={Boolean(selectedGroups.other)}
                                onChange={() => {
                                    setSelectedGroups((prev) => ({
                                        ...prev,
                                        other: !prev.other,
                                    }));
                                }}
                            />
                            Other
                        </label>
                    )}
                </div>
                <Dialog.Footer>
                    <Button.Text onClick={() => setIsOpen(false)}>Close</Button.Text>
                    <Button
                        onClick={() => {
                            exportSettings();
                            setIsOpen(false);
                        }}
                    >
                        Export
                    </Button>
                </Dialog.Footer>
            </Dialog>

            <Button.Text onClick={() => setIsOpen(true)}>Export</Button.Text>
        </>
    );
};
