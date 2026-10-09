import React, { useEffect, useRef, useState } from 'react';
import { ActivityLogFilters } from '@/api/account/activity';
import { useActivityLogs } from '@/api/server/activity';
import { useFlashKey } from '@/plugins/useFlash';
import PageContentBlock from '@/components/elements/PageContentBlock';
import FlashMessageRender from '@/components/FlashMessageRender';
import { Link } from 'react-router-dom';
import PaginationFooter from '@/components/elements/table/PaginationFooter';
import { XCircleIcon } from '@heroicons/react/solid';
import Spinner from '@/components/elements/Spinner';
import { Button, styles as btnStyles } from '@/components/elements/button/index';
import ActivityLogEntry from '@/components/elements/activity/ActivityLogEntry';
import useLocationHash from '@/plugins/useLocationHash';
import { useTranslation } from 'react-i18next';
import ItemList, { ItemRow, ItemCell } from '@/components/elements/ItemList';
import Input from '@/components/elements/Input';
import DatePickerInput from '@/components/elements/DatePicker';
import Label from '@/components/elements/Label';
import { ChevronDownIcon } from '@heroicons/react/outline';
import classNames from 'classnames';
import { LuBot } from 'react-icons/lu';
import { Subuser } from '@/state/server/subusers';
import getServerSubusers from '@/api/server/users/getServerSubusers';
import { ServerContext } from '@/state/server';
import Select from '../elements/Select';

export default () => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    const { t } = useTranslation('arix/activity');
    const { hash } = useLocationHash();
    const { clearAndAddHttpError } = useFlashKey('server:activity');

    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);

    const [users, setSubusers] = useState<Subuser[]>([]);
    const [filters, setFilters] = useState<ActivityLogFilters>({ page: 1, sorts: { timestamp: -1 } });
    const { data, isValidating, error } = useActivityLogs(filters, {
        revalidateOnMount: true,
        revalidateOnFocus: false,
    });

    useEffect(() => {
        setFilters((value) => ({
            ...value,
            filters: {
                ip: hash.ip,
                user: hash.user,
                event: hash.event,
                timestamp_from: hash.timestamp_from,
                timestamp_to: hash.timestamp_to,
            },
        }));
    }, [hash]);

    useEffect(() => {
        setFilters((value) => ({ ...value, page: 1 }));
    }, [filters.filters]);

    useEffect(() => {
        clearAndAddHttpError(error);
    }, [error]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!isOpen || !dropdownRef.current) {
                return;
            }

            if (!dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    useEffect(() => {
        if(isOpen) {
            getServerSubusers(uuid)
                .then((subusers) => {
                    setSubusers(subusers);
                })
                .catch((error) => {
                    console.error(error);
                });
            }
    }, [isOpen]);

    const activeFilters = Object.entries(filters.filters ?? {}).filter(
        ([, value]) => value !== undefined && value !== ''
    );

    const hashWithoutFilter = (filterKey: string) => {
        const nextHash = Object.entries(filters.filters ?? {})
            .filter(([key, value]) => key !== filterKey && value !== undefined && value !== '')
            .map(([key, value]) => `${key}=${value}`)
            .join('&');

        return nextHash ? `#${nextHash}` : '#';
    };

    const clearSingleFilter = (filterKey: string) => {
        setFilters((value) => ({
            ...value,
            filters: {
                ...value.filters,
                [filterKey]: '',
            },
        }));
    };

    return (
        <PageContentBlock title={t('activity-log')}>
            <FlashMessageRender byKey={'server:activity'} />
            <ItemList
                title={
                    <div className={'flex gap-2 items-start justify-between'}>
                        <div>
                            <p className={'text-medium text-gray-300'}>{t('activity-log')}</p>
                        </div>
                        <div className={'flex items-center gap-x-2'}>
                            {activeFilters.map(([key, value]) => (
                                <Link
                                    key={key}
                                    to={hashWithoutFilter(key)}
                                    onClick={() => clearSingleFilter(key)}
                                    className={classNames(
                                        btnStyles.button,
                                        btnStyles.small,
                                        btnStyles.text,
                                        'inline w-full gap-x-1 sm:w-auto'
                                    )}
                                >
                                    {key.replace(/_/g, ' ')}
                                    <span className='max-w-32 truncate'>{String(value)}</span>
                                    <XCircleIcon className={'w-4 h-4 ml-2'} />
                                </Link>
                            ))}
                            <div ref={dropdownRef} className={'relative'}>
                                <Button.Text onClick={() => setIsOpen(!isOpen)} className='group gap-x-1'>
                                    {t('filters.title')}
                                    <ChevronDownIcon
                                        className={`w-4 duration-200 ${
                                            isOpen ? 'rotate-180' : 'group-hover:rotate-180'
                                        }`}
                                    />
                                </Button.Text>
                                {isOpen && (
                                    <div
                                        className={
                                            'absolute bg-neutral-600 p-4 space-y-3 rounded-lg border border-neutral-500 shadow-lg text-neutral-200 z-50 right-0 top-full mt-2 w-72'
                                        }
                                    >
                                        <p className='font-medium'>{t('filters.title')}</p>
                                        <div>
                                            <Label htmlFor='user' className='!mb-1'>
                                                {t('filters.subuser')}
                                            </Label>
                                            <Select
                                                id='user'
                                                value={(filters.filters?.user as string) || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setFilters((value) => ({
                                                        ...value,
                                                        filters: { ...value.filters, user: val },
                                                    }));
                                                }}
                                                className='!py-2 !px-2'
                                            >
                                                <option value=''>Select a user</option>
                                                {users.map((user) => (
                                                    <option key={user.uuid} value={user.uuid}>
                                                        {user.username} ({user.email})
                                                    </option>
                                                ))}
                                            </Select>
                                        </div>
                                        <div>
                                            <Label htmlFor='event' className='!mb-1'>
                                                {t('event')}
                                            </Label>
                                            <Input
                                                id='event'
                                                placeholder={t('event')}
                                                value={(filters.filters?.event as string) || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setFilters((value) => ({
                                                        ...value,
                                                        filters: { ...value.filters, event: val },
                                                    }));
                                                }}
                                                className='!py-2 !px-2'
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor='ip' className='!mb-1'>
                                                {t('filters.ip-address')}
                                            </Label>
                                            <Input
                                                id='ip'
                                                placeholder={t('filters.ip-address')}
                                                value={(filters.filters?.ip as string) || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setFilters((value) => ({
                                                        ...value,
                                                        filters: { ...value.filters, ip: val },
                                                    }));
                                                }}
                                                className='!py-2 !px-2'
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor='timestamp_from' className='!mb-1'>
                                                {t('filters.timestamp_from')}
                                            </Label>
                                            <DatePickerInput
                                                id='timestamp_from'
                                                value={(filters.filters?.timestamp_from as string) || ''}
                                                className='!py-2 !px-2'
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setFilters((value) => ({
                                                        ...value,
                                                        filters: { ...value.filters, timestamp_from: val },
                                                    }));
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor='timestamp_to' className='!mb-1'>
                                                {t('filters.timestamp_to')}
                                            </Label>
                                            <DatePickerInput
                                                id='timestamp_to'
                                                value={(filters.filters?.timestamp_to as string) || ''}
                                                className='!py-2 !px-2'
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setFilters((value) => ({
                                                        ...value,
                                                        filters: { ...value.filters, timestamp_to: val },
                                                    }));
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                }
                headers={
                    <tr>
                        <th className='w-1/6'>{t('user')}</th>
                        <th className='w-1/3'>{t('event')}</th>
                        <th className='w-1/4'>{t('ip-address')}</th>
                        <th>{t('timestamp')}</th>
                        <th></th>
                    </tr>
                }
                footer={
                    data && (
                        <PaginationFooter
                            pagination={data.pagination}
                            onPageSelect={(page) => setFilters((value) => ({ ...value, page }))}
                        />
                    )
                }
            >
                {!data && isValidating ? (
                    <ItemRow>
                        <ItemCell colSpan={5}>
                            <Spinner centered />
                        </ItemCell>
                    </ItemRow>
                ) : (
                    data?.items.map((activity) => (
                        <ActivityLogEntry key={activity.id} activity={activity}>
                            <LuBot className='w-6 h-6 text-gray-400' />
                        </ActivityLogEntry>
                    ))
                )}
            </ItemList>
        </PageContentBlock>
    );
};
