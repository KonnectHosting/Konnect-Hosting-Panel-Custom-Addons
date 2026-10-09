import React, { useState } from 'react';
import { LinkCategory, LinkSettings } from '@/api/admin/Link';
import { ChevronDownIcon, ChevronUpIcon, CogIcon, PlusIcon } from '@heroicons/react/outline';
import { Button } from '@/components/elements/button/index';
import Badge from '@/components/elements/Badge';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import Icon from '../elements/IconMap';
import { EditorOrCreateCategory, EditorOrCreateLink } from './LinkEditors';

const hasConditions = (nests?: number[], eggs?: number[]) =>
    (Array.isArray(nests) && nests.length > 0) || (Array.isArray(eggs) && eggs.length > 0);

const formatTiers = (tiers: string[]) =>
    tiers.map((tier) => `${tier.charAt(0).toUpperCase()}${tier.slice(1)}`).join(', ');

const ReorderButtons = ({ onMoveUp, onMoveDown }: { onMoveUp: () => void; onMoveDown: () => void }) => (
    <div className='flex items-center gap-x-1'>
        <button className='p-1' onClick={onMoveUp}>
            <ChevronUpIcon className='w-4' />
        </button>
        <button className='p-1' onClick={onMoveDown}>
            <ChevronDownIcon className='w-4' />
        </button>
    </div>
);

const ConditionBadge = ({ show, tooltip, text }: { show: boolean; tooltip: string; text?: string }) => (
    <>
        {show && (
            <Tooltip content={tooltip}>
                <div className='text-sm'>
                    <Badge color='warning'>{text || 'Conditional'}</Badge>
                </div>
            </Tooltip>
        )}
    </>
);

type Props = {
    categoryKey: string;
    category: LinkCategory;
    linkSettings: LinkSettings;
    onSettingsChange: (nextSettings: LinkSettings) => void;
};

const CategoryWrapper = ({ categoryKey, category, linkSettings, onSettingsChange }: Props) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
    const [editingLinkIndex, setEditingLinkIndex] = useState<number | null>(null);
    const [isCreateLinkDialogOpen, setIsCreateLinkDialogOpen] = useState(false);

    const replaceCategory = (updatedCategory: LinkCategory) => {
        const nextSettings: LinkSettings = { ...linkSettings };

        if (updatedCategory.name !== categoryKey) {
            delete nextSettings[categoryKey];
            nextSettings[updatedCategory.name] = updatedCategory;
        } else {
            nextSettings[categoryKey] = updatedCategory;
        }

        onSettingsChange(nextSettings);
    };

    const removeCategory = () => {
        const nextSettings: LinkSettings = { ...linkSettings };
        delete nextSettings[categoryKey];
        onSettingsChange(nextSettings);
    };

    const moveCategory = (direction: 'up' | 'down') => {
        const entries = Object.entries(linkSettings);
        const idx = entries.findIndex(([k]) => k === categoryKey);
        if (idx === -1) return;
        const target = direction === 'up' ? idx - 1 : idx + 1;
        if (target < 0 || target >= entries.length) return;
        const tmp = entries[target];
        entries[target] = entries[idx];
        entries[idx] = tmp;
        onSettingsChange(Object.fromEntries(entries) as LinkSettings);
    };

    const moveLink = (index: number, direction: 'up' | 'down') => {
        const links = [...category.links];
        const target = direction === 'up' ? index - 1 : index + 1;
        if (target < 0 || target >= links.length) return;
        const tmp = links[target];
        links[target] = links[index];
        links[index] = tmp;

        replaceCategory({ ...category, links });
    };

    return (
        <div>
            <EditorOrCreateCategory
                open={isCategoryDialogOpen}
                onClose={() => setIsCategoryDialogOpen(false)}
                title={`Edit ${category.name} category`}
                initialCategory={category}
                onSubmit={replaceCategory}
                onRemove={removeCategory}
            />

            {editingLinkIndex !== null && category.links[editingLinkIndex] && (
                <EditorOrCreateLink
                    open={editingLinkIndex !== null}
                    onClose={() => setEditingLinkIndex(null)}
                    title={`Edit ${category.links[editingLinkIndex].name} link`}
                    initialLink={category.links[editingLinkIndex]}
                    onSubmit={(updatedLink) => {
                        const links = [...category.links];
                        links[editingLinkIndex] = updatedLink;
                        replaceCategory({ ...category, links });
                    }}
                    onRemove={() => {
                        const links = [...category.links];
                        links.splice(editingLinkIndex, 1);
                        replaceCategory({ ...category, links });
                        setEditingLinkIndex(null);
                    }}
                />
            )}

            <EditorOrCreateLink
                open={isCreateLinkDialogOpen}
                onClose={() => setIsCreateLinkDialogOpen(false)}
                title={`Create link in ${category.name}`}
                initialLink={{
                    icon: 'HiOutlineHome',
                    name: 'new link',
                    url: '/',
                    permission: [],
                    nests: [],
                    eggs: [],
                    active: true,
                }}
                onSubmit={(newLink) => {
                    replaceCategory({ ...category, links: [...category.links, newLink] });
                }}
            />

            <div className='border border-gray-600 rounded-component overflow-hidden'>
                <div className='flex justify-between items-center px-4 bg-gray-800'>
                    <div
                        onClick={() => setIsOpen(!isOpen)}
                        className='flex-1 flex py-4 items-center gap-x-2 cursor-pointer'
                    >
                        <ChevronDownIcon className={`w-4 duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                        <p className='capitalize'>{category.name}</p>
                        <div className='!text-sm'>{!category.active && <Badge color='danger'>Inactive</Badge>}</div>
                    </div>
                    <div className='flex items-center gap-x-4'>
                        <ConditionBadge
                            show={hasConditions(category.nests, category.eggs)}
                            tooltip='This category has a nest/egg conditions.'
                        />
                        <ReorderButtons onMoveUp={() => moveCategory('up')} onMoveDown={() => moveCategory('down')} />
                        <Button.Text
                            size={Button.Sizes.Small}
                            className='gap-x-1'
                            onClick={() => setIsCategoryDialogOpen(true)}
                        >
                            <CogIcon className='w-4' />
                        </Button.Text>
                    </div>
                </div>

                {isOpen && (
                    <div>
                        {Array.isArray(category.links) &&
                            category.links.map((link, i) => (
                                <div
                                    key={i}
                                    className='border-b border-gray-600 px-4 py-2 flex justify-between items-center'
                                >
                                    <div className='flex-1 flex items-center gap-x-2'>
                                        <Icon name={link.icon} size={20} />
                                        <p className='capitalize'>{link.name}</p>
                                        <div className='!text-sm'>
                                            {!link.active && <Badge color='danger'>Inactive</Badge>}
                                        </div>
                                    </div>
                                    <div className='flex items-center gap-x-4'>
                                        <ConditionBadge
                                            show={hasConditions(link.nests, link.eggs)}
                                            tooltip='This link has a nest/egg condition.'
                                        />
                                        <ConditionBadge
                                            show={link.permission ? link.permission.length === 0 : false}
                                            tooltip='No permission has been assigned.'
                                            text='No Permission'
                                        />
                                        <ConditionBadge
                                            show={Array.isArray(link.tier) && link.tier.length > 0}
                                            tooltip={`This link is only shown for ${formatTiers(
                                                link.tier ?? []
                                            )} tier servers.`}
                                            text={formatTiers(link.tier ?? [])}
                                        />
                                        <ReorderButtons
                                            onMoveUp={() => moveLink(i, 'up')}
                                            onMoveDown={() => moveLink(i, 'down')}
                                        />
                                        <Button.Text
                                            size={Button.Sizes.Small}
                                            className='gap-x-1'
                                            onClick={() => setEditingLinkIndex(i)}
                                        >
                                            <CogIcon className='w-4' />
                                        </Button.Text>
                                    </div>
                                </div>
                            ))}
                        <div
                            className='px-4 py-2 text-sm flex items-center gap-x-1 duration-300 hover:bg-secondary-100 cursor-pointer'
                            onClick={() => setIsCreateLinkDialogOpen(true)}
                        >
                            <PlusIcon className='w-4' />
                            Add new link
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CategoryWrapper;
