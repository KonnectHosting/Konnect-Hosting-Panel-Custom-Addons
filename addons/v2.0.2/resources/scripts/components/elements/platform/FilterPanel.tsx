import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDownIcon } from '@heroicons/react/outline';
import Input from '@/components/elements/Input';
import { FilterContext, FilterFieldConfig, FilterState } from '@/api/server/platform/types';

type UpdateFilter = (key: string, value: string) => void;

const RadioButton: React.FC<{
    id: string;
    fieldKey: string;
    active?: string;
    updateFilter: UpdateFilter;
}> = ({ id, fieldKey, active, updateFilter }) => {
    return (
        <div className='flex items-center gap-x-1 cursor-pointer'>
            <Input
                id={`${fieldKey}-${id}`}
                name={fieldKey}
                type='radio'
                checked={active === id}
                onChange={() => updateFilter(fieldKey, id)}
            />
            <label htmlFor={`${fieldKey}-${id}`} className={'capitalize'}>
                {id.toLowerCase()}
            </label>
        </div>
    );
};

const VersionDropdown: React.FC<{
    main: string;
    versions: string[];
    active?: string;
    updateFilter: UpdateFilter;
}> = ({ main, versions, active, updateFilter }) => {
    const [isOpen, setOpen] = useState(false);

    return (
        <div>
            <div className={'flex items-center gap-x-2'}>
                <RadioButton id={main} active={active} fieldKey={'version'} updateFilter={updateFilter} />
                <button onClick={() => setOpen(!isOpen)}>
                    <ChevronDownIcon className={`${isOpen ? 'rotate-180' : ''} w-5 duration-300`} />
                </button>
            </div>
            <div className={`${isOpen ? 'max-h-96' : 'max-h-0'} overflow-hidden duration-300 pl-4`}>
                {versions.map((version) => (
                    <RadioButton
                        key={version}
                        id={version}
                        active={active}
                        fieldKey={'version'}
                        updateFilter={updateFilter}
                    />
                ))}
            </div>
        </div>
    );
};

function resolveOptions(field: FilterFieldConfig, filters: FilterState, ctx: FilterContext): string[] {
    if (typeof field.options === 'function') {
        return field.options(filters, ctx);
    }

    return field.options ?? [];
}

export default function FilterPanel({
    fields,
    filters,
    ctx,
    updateFilter,
    translationNamespace,
}: {
    fields: FilterFieldConfig[];
    filters: FilterState;
    ctx: FilterContext;
    updateFilter: UpdateFilter;
    translationNamespace: string;
}) {
    const { t } = useTranslation(translationNamespace);

    return (
        <>
            {fields.map((field) => {
                if (field.visible && !field.visible(filters, ctx)) {
                    return null;
                }

                if (field.type === 'version-tree') {
                    return (
                        <div key={field.key} className={'flex flex-col gap-1'}>
                            <p className={'font-medium'}>{t(field.label)}</p>
                            <div className={'flex flex-col gap-1 max-h-48 overflow-auto'}>
                                {Object.entries(ctx.versionGroups).map(([group, versions]) => (
                                    <VersionDropdown
                                        key={group}
                                        main={group}
                                        versions={versions}
                                        active={filters[field.key]}
                                        updateFilter={updateFilter}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                }

                const options = resolveOptions(field, filters, ctx);
                
                if (options.length <= 1) {
                    return null;
                }

                return (
                    <div key={field.key} className={'flex flex-col gap-1'}>
                        <p className={'font-medium'}>{t(field.label)}</p>
                        {options.map((id) => (
                            <RadioButton
                                key={id}
                                id={id}
                                fieldKey={field.key}
                                active={filters[field.key]}
                                updateFilter={updateFilter}
                            />
                        ))}
                    </div>
                );
            })}
        </>
    );
}
