import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import Input from '@/components/elements/Input';
import useFlash from '@/plugins/useFlash';
import { updatePreset } from '@/api/admin/Preset';
import Spinner from '@/components/elements/Spinner';
import Alert from '@/components/elements/alert/Alert';

export default () => {
    const [isOpen, setIsOpen] = useState(false);
    const [preset, setPreset] = useState<string>('');
    const [selectedGroups, setSelectedGroups] = useState<Record<string, boolean>>({});
    const { addFlash } = useFlash();
    const [isLoading, setIsLoading] = useState(false);

    const fileInput = useRef<HTMLInputElement | null>(null);

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

    const buildImportPayload = (): Record<string, unknown> => {
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

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        if (!f.name.endsWith('.arix')) return;
        const reader = new FileReader();
        reader.onload = () => {
            const text = String(reader.result ?? '');
            let decoded = '';

            try {
                decoded = atob(text);
            } catch {
                decoded = text;
            }

            setPreset(decoded);
            setSelectedGroups({});
            setIsOpen(true);
        };
        reader.readAsText(f);
        if (fileInput.current) fileInput.current.value = '';
    };

    const onUpdate = async (data?: string | Record<string, unknown>) => {
        setIsLoading(true);
        try {
            const payload =
                typeof data === 'string' ? (JSON.parse(data) as Record<string, unknown>) : data ?? parsedPreset;
            const resp = await updatePreset({ preset: payload });
            addFlash({ type: 'success', title: 'Preset updated', message: `${resp.imported} settings imported.` });
        } catch (e) {
            addFlash({ type: 'error', title: 'Error', message: 'Failed to import preset.' });
        } finally {
            setIsLoading(false);
        }
    };

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

    return (
        <>
            <Dialog title='Import Preset' open={isOpen} onClose={() => setIsOpen(false)}>
                <p>Select which categories you want to import.</p>
                
                <Alert type='warning' className='mt-2'>
                    Only import presets from trusted sources. Importing a preset can manipulate critical settings on your panel, and may cause introduce security vulnerabilities.
                </Alert>

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
                        onClick={async () => {
                            await onUpdate(buildImportPayload());
                            setIsOpen(false);
                        }}
                        disabled={isLoading}
                        className='flex items-center gap-x-2'
                    >
                        Import
                        {isLoading && <Spinner size='small' />}
                    </Button>
                </Dialog.Footer>
            </Dialog>

            <input ref={fileInput} type='file' accept='.arix' style={{ display: 'none' }} onChange={handleImport} />

            <Button onClick={() => fileInput.current?.click()}>Import</Button>
        </>
    );
};
