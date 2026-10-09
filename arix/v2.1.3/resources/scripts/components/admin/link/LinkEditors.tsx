import React, { useEffect, useState } from 'react';
import Input from '@/components/elements/Input';
import { Button } from '@/components/elements/button/index';
import { Dialog } from '@/components/elements/dialog';
import { LinkCategory, LinkItem, Tier } from '@/api/admin/Link';
import IconPicker from './IconPicker';
import Switch from '@/components/elements/Switch';
import PermissionsSelector from './PermissionsSelector';
import NestSelector from './NestSelector';
import { ChevronDownIcon } from '@heroicons/react/outline';

const tiers: { value: Tier; label: string }[] = [
    { value: 'budget', label: 'Budget' },
    { value: 'standard', label: 'Standard' },
    { value: 'premium', label: 'Premium' },
];

const normalizeTiers = (tier: LinkItem['tier'] | Tier | undefined): Tier[] => {
    if (Array.isArray(tier)) {
        return tier;
    }

    return tier ? [tier] : [];
};

type CategoryEditorProps = {
    open: boolean;
    onClose: () => void;
    title: string;
    initialCategory: LinkCategory;
    onSubmit: (updatedCategory: LinkCategory) => void;
    onRemove?: () => void;
};

export const EditorOrCreateCategory = ({
    open,
    onClose,
    title,
    initialCategory,
    onSubmit,
    onRemove,
}: CategoryEditorProps) => {
    const [advanced, setAdvanced] = useState(false);
    const [name, setName] = useState(initialCategory.name);
    const [permissions, setPermissions] = useState<string[]>(initialCategory.permission ?? []);
    const [nests, setNests] = useState<number[]>(initialCategory.nests ?? []);
    const [eggs, setEggs] = useState<number[]>(initialCategory.eggs ?? []);
    const [active, setActive] = useState(initialCategory.active);

    useEffect(() => {
        if (!open) {
            return;
        }

        setName(initialCategory.name);
        setPermissions(initialCategory.permission ?? []);
        setNests(initialCategory.nests ?? []);
        setEggs(initialCategory.eggs ?? []);
        setActive(initialCategory.active);
    }, [open, initialCategory]);

    const submit = () => {
        onSubmit({
            ...initialCategory,
            name: name.trim() || initialCategory.name,
            permission: permissions,
            nests,
            eggs,
            active,
        });
        onClose();
    };

    const removeCategory = () => {
        if (!onRemove) {
            return;
        }

        onRemove();
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} title={title}>
            <div className='space-y-4'>
                <div>
                    <label className='block text-xs mb-1'>Name</label>
                    <Input value={name} onChange={(e) => setName(e.currentTarget.value)} />
                </div>
                <label className='flex items-center gap-x-2 text-sm'>
                    <Switch name='active' checked={active} onChange={(e) => setActive(e.currentTarget.checked)} />
                    Enable category
                </label>
                <div>
                    <div
                        onClick={() => setAdvanced(!advanced)}
                        className='flex gap-x-2 items-center cursor-pointer text-sm pb-2 text-gray-400 hover:text-gray-200'
                    >
                        Show Advanced Options
                        <ChevronDownIcon
                            className={`w-4 ml-1 inline-block duration-300 ${advanced ? 'rotate-180' : ''}`}
                        />
                    </div>
                    <div className={`space-y-4 duration-300 overflow-hidden ${advanced ? 'max-h-screen' : 'max-h-0'}`}>
                        <PermissionsSelector
                            selectedPermissions={permissions}
                            setSelectedPermissions={setPermissions}
                        />
                        <NestSelector
                            selectedNests={nests}
                            setSelectedNests={setNests}
                            selectedEggs={eggs}
                            setSelectedEggs={setEggs}
                        />
                    </div>
                </div>
            </div>

            <Dialog.Footer>
                {onRemove && (
                    <Button.Danger
                        onClick={removeCategory}
                        className='mr-auto'
                        variant={Button.Variants.Secondary}
                        size={Button.Sizes.Small}
                    >
                        Delete Category
                    </Button.Danger>
                )}
                <Button.Text onClick={onClose}>Cancel</Button.Text>
                <Button onClick={submit}>Update</Button>
            </Dialog.Footer>
        </Dialog>
    );
};

type LinkEditorProps = {
    open: boolean;
    onClose: () => void;
    title: string;
    initialLink: LinkItem;
    onSubmit: (updatedLink: LinkItem) => void;
    onRemove?: () => void;
};

export const EditorOrCreateLink = ({ open, onClose, title, initialLink, onSubmit, onRemove }: LinkEditorProps) => {
    const [advanced, setAdvanced] = useState(false);
    const [icon, setIcon] = useState(initialLink.icon);
    const [name, setName] = useState(initialLink.name);
    const [url, setUrl] = useState(initialLink.url);
    const [permissions, setPermissions] = useState<string[]>(initialLink.permission ?? []);
    const [nests, setNests] = useState<number[]>(initialLink.nests ?? []);
    const [eggs, setEggs] = useState<number[]>(initialLink.eggs ?? []);
    const [active, setActive] = useState(initialLink.active);
    const [selectedTiers, setSelectedTiers] = useState<Tier[]>(normalizeTiers(initialLink.tier));

    useEffect(() => {
        if (!open) {
            return;
        }

        setIcon(initialLink.icon);
        setName(initialLink.name);
        setUrl(initialLink.url);
        setPermissions(initialLink.permission ?? []);
        setNests(initialLink.nests ?? []);
        setEggs(initialLink.eggs ?? []);
        setActive(initialLink.active);
        setSelectedTiers(normalizeTiers(initialLink.tier));
    }, [open, initialLink]);

    const submit = () => {
        onSubmit({
            icon: icon.trim(),
            name: name.trim() || initialLink.name,
            url: url.trim() || initialLink.url,
            permission: permissions,
            nests,
            eggs,
            active,
            tier: selectedTiers,
        });
        onClose();
    };

    const removeLink = () => {
        if (!onRemove) {
            return;
        }

        onRemove();
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} title={title}>
            <div className='space-y-4'>
                <div>
                    <label className='block text-xs mb-1'>Name</label>
                    <Input value={name} onChange={(e) => setName(e.currentTarget.value)} />
                </div>
                <div>
                    <label className='block text-xs mb-1'>URL</label>
                    <Input value={url} onChange={(e) => setUrl(e.currentTarget.value)} />
                </div>
                <div>
                    <label className='block text-xs mb-1'>Icon</label>
                    <IconPicker value={icon ?? 'HiOutlineHome'} setIcon={setIcon} />
                </div>
                <label className='flex items-center gap-x-2 text-sm'>
                    <Switch name='active' checked={active} onChange={(e) => setActive(e.currentTarget.checked)} />
                    Enable link
                </label>
                <div>
                    <div
                        onClick={() => setAdvanced(!advanced)}
                        className='flex gap-x-2 items-center cursor-pointer text-sm pb-2 text-gray-400 hover:text-gray-200'
                    >
                        Show Advanced Options
                        <ChevronDownIcon
                            className={`w-4 ml-1 inline-block duration-300 ${advanced ? 'rotate-180' : ''}`}
                        />
                    </div>
                    <div className={`space-y-4 duration-300 overflow-hidden ${advanced ? 'max-h-screen' : 'max-h-0'}`}>
                        <PermissionsSelector
                            selectedPermissions={permissions}
                            setSelectedPermissions={setPermissions}
                        />
                        <NestSelector
                            selectedNests={nests}
                            setSelectedNests={setNests}
                            selectedEggs={eggs}
                            setSelectedEggs={setEggs}
                        />
                        <div>
                            <label className='block text-xs mb-2'>Tiers</label>
                            <div className='flex flex-wrap gap-x-4 gap-y-2'>
                                {tiers.map(({ value, label }) => (
                                    <label key={value} className='flex items-center gap-x-2 text-sm'>
                                        <Input
                                            type='checkbox'
                                            checked={selectedTiers.includes(value)}
                                            onChange={(event) =>
                                                setSelectedTiers(
                                                    event.currentTarget.checked
                                                        ? [...selectedTiers, value]
                                                        : selectedTiers.filter((tier) => tier !== value)
                                                )
                                            }
                                        />
                                        {label}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Dialog.Footer>
                {onRemove && (
                    <Button.Danger
                        onClick={removeLink}
                        className='mr-auto'
                        variant={Button.Variants.Secondary}
                        size={Button.Sizes.Small}
                    >
                        Delete Link
                    </Button.Danger>
                )}
                <Button.Text onClick={onClose}>Cancel</Button.Text>
                <Button onClick={submit}>Update</Button>
            </Dialog.Footer>
        </Dialog>
    );
};
