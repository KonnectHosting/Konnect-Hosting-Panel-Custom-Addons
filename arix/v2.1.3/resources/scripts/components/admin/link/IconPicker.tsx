import React, { InputHTMLAttributes, useEffect, useMemo, useRef, useState } from 'react';
import Input from '@/components/elements/Input';
import Icon, { getAllIconNames, preloadAllIcons } from '../elements/IconMap';
import { Button } from '@/components/elements/button/index';
import Spinner from '@/components/elements/Spinner';

export default ({
    value,
    setIcon,
    ...props
}: { value: string; setIcon: (value: string) => void } & InputHTMLAttributes<HTMLInputElement>) => {
    const [isOpen, setIsOpen] = useState(false);
    const [style, setStyle] = useState<'outline' | 'solid'>(value?.includes('Solid') ? 'solid' : 'outline');
    const [icon, setIconState] = useState(value || '');
    const [search, setSearch] = useState(value || '');
    const [allIconNames, setAllIconNames] = useState<string[]>([]);
    const [isLoadingIcons, setIsLoadingIcons] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setIcon(icon);
    }, [icon, setIcon]);

    const normalize = (s: string) => s.replace(/Hi(Solid|Outline)/gi, '').toLowerCase();

    const validationTimeout = useRef<number | null>(null);

    const ensureIconNames = async () => {
        if (allIconNames.length > 0 || isLoadingIcons) {
            return;
        }

        setIsLoadingIcons(true);

        try {
            const names = await getAllIconNames();
            setAllIconNames(names);
        } finally {
            setIsLoadingIcons(false);
        }
    };

    const findMatches = (term: string) => {
        const normalized = normalize(term);
        if (!normalized) return allIconNames;
        return allIconNames.filter((k) => normalize(k).includes(normalized));
    };

    const validateSearchOrFallback = () => {
        const newIcon = search;
        if (allIconNames.includes(newIcon)) {
            setIconState(newIcon);
            setSearch(newIcon);
            return;
        }

        const matches = findMatches(newIcon);
        if (matches.length === 1) {
            setIconState(matches[0]);
            setSearch(matches[0]);
            return;
        }

        setIconState(value);
        setSearch(value);
    };

    useEffect(() => {
        return () => {
            if (validationTimeout.current) {
                clearTimeout(validationTimeout.current);
                validationTimeout.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        void ensureIconNames();
    }, [isOpen]);

    const filteredIconNames = useMemo(() => {
        const term = normalize(search);

        return allIconNames
            .filter((iconName) => iconName.includes(style === 'solid' ? 'Solid' : 'Outline'))
            .filter((iconName) => {
                if (!term) return true;
                if (search === value) return true;
                return normalize(iconName).includes(term);
            });
    }, [allIconNames, search, style, value]);

    return (
        <div
            ref={containerRef}
            className='relative'
            onFocus={() => {
                setIsOpen(true);
                preloadAllIcons();
            }}
            onBlur={(e: React.FocusEvent<HTMLDivElement>) => {
                const related = e.relatedTarget as Node | null;
                if (related && containerRef.current?.contains(related)) return;

                setIsOpen(false);

                if (validationTimeout.current) {
                    clearTimeout(validationTimeout.current);
                    validationTimeout.current = null;
                }

                validationTimeout.current = window.setTimeout(() => {
                    validateSearchOrFallback();
                    validationTimeout.current = null;
                }, 100);
            }}
        >
            <div className='relative'>
                <Icon name={icon} className='w-5 h-5 absolute top-3 left-3.5' />
                <Input
                    name='icon'
                    className='!pl-10'
                    value={search}
                    onChange={(e) => setSearch(e.currentTarget.value)}
                    {...props}
                />
            </div>

            {isOpen && (
                <div className='w-full p-4 mt-2 rounded-component bg-gray-700 border border-gray-500 z-10 shadow-xl'>
                    <div className='grid grid-cols-2 gap-2 mb-4'>
                        <Button.Text
                            type='button'
                            size={Button.Sizes.Small}
                            className={style === 'outline' ? '!bg-secondary-100' : ''}
                            onClick={() => setStyle('outline')}
                        >
                            Outline
                        </Button.Text>
                        <Button.Text
                            type='button'
                            size={Button.Sizes.Small}
                            className={style === 'solid' ? '!bg-secondary-100' : ''}
                            onClick={() => setStyle('solid')}
                        >
                            Solid
                        </Button.Text>
                    </div>
                    {isLoadingIcons && allIconNames.length === 0 ? (
                        <div className='flex items-center gap-2 justify-center py-6'>
                            <Spinner size='small' />
                            Loading icons...
                        </div>
                    ) : (
                        <div className='grid grid-cols-4 overflow-hidden gap-2 max-h-56 overflow-y-auto'>
                            {filteredIconNames.map((iconName) => (
                                <button
                                    key={iconName}
                                    type='button'
                                    className={`bg-secondary-200 flex flex-col items-center justify-center border border-secondary-100 ${
                                        icon === iconName ? '!bg-secondary-100' : ''
                                    } hover:bg-secondary-100 px-4 py-3 rounded-md`}
                                    disabled={icon === iconName}
                                    onClick={() => {
                                        if (validationTimeout.current) {
                                            clearTimeout(validationTimeout.current);
                                            validationTimeout.current = null;
                                        }
                                        setIconState(iconName);
                                        setSearch(iconName);
                                    }}
                                >
                                    <Icon name={iconName} className='w-6 h-6' />
                                    <span className='text-xs mt-1'>{iconName.replace(/Hi(Solid|Outline)/gi, '')}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
