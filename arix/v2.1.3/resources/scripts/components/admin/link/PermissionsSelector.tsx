import getSystemPermissions from '@/api/getSystemPermissions';
import Input from '@/components/elements/Input';
import Label from '@/components/elements/Label';
import Spinner from '@/components/elements/Spinner';
import { PanelPermissions } from '@/state/permissions';
import { CheckIcon } from '@heroicons/react/outline';
import React, { useEffect, useState } from 'react';

export default ({
    selectedPermissions,
    setSelectedPermissions,
}: {
    selectedPermissions: string[];
    setSelectedPermissions: (permissions: string[]) => void;
}) => {
    const [permissions, setPermissions] = useState<PanelPermissions | null>(null);
    const [show, setShow] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                const result = await getSystemPermissions();
                setPermissions(result);
            } catch (error) {
                console.error('Error fetching permissions:', error);
            }
        };

        fetchPermissions();
    }, []);

    const handlePermission = (permission: string) => {
        if (selectedPermissions.includes(permission)) {
            setSelectedPermissions(selectedPermissions.filter((p) => p !== permission));
            return;
        } else {
            setSelectedPermissions([...selectedPermissions, permission]);
        }
    };

    return (
        <div>
            {permissions ? (
                <div className='bg-gray-700 border border-gray-500 rounded-component'>
                    <div className='px-4 pt-4'>
                        <div className='flex justify-between items-start'>
                            <Label className='mb-2' htmlFor='search'>
                                Permissions
                            </Label>
                            <div className='flex gap-x-1 text-xs'>
                                <button
                                    onClick={() => setShow(false)}
                                    className={`duration-300 ${!show ? 'underline' : ''}`}
                                >
                                    Show All
                                </button>
                                /
                                <button
                                    onClick={() => setShow(true)}
                                    className={`duration-300 ${show ? 'underline' : ''}`}
                                >
                                    Selected ({selectedPermissions.length})
                                </button>
                            </div>
                        </div>
                        <Input
                            name='permissionSearch'
                            placeholder='Search permissions...'
                            className='!py-2 px-3 mb-2'
                            value={search}
                            onChange={(e) => setSearch(e.currentTarget.value)}
                        />
                    </div>
                    <div className='space-y-1 max-h-56 overflow-y-auto px-4 pb-4'>
                        {Object.entries(permissions)
                            .filter(([key, value]) => {
                                if (key === 'websocket') {
                                    return false;
                                }

                                const matchesSearch =
                                    key.includes(search) || Object.keys(value.keys).some((k) => k.includes(search));
                                if (!matchesSearch) {
                                    return false;
                                }

                                if (!show) {
                                    return true;
                                }

                                const selectedCategory = selectedPermissions.includes(`${key}.*`);
                                const selectedChildren = Object.keys(value.keys).some((permKey) =>
                                    selectedPermissions.includes(`${key}.${permKey}`)
                                );

                                return selectedCategory || selectedChildren;
                            })
                            .map(([key, value]) => {
                                const selectedCategory = selectedPermissions.includes(`${key}.*`);
                                const visiblePermissionKeys = Object.keys(value.keys)
                                    .filter((permKey) => permKey.includes(search))
                                    .filter((permKey) => !show || selectedPermissions.includes(`${key}.${permKey}`));

                                return (
                                    <React.Fragment key={key}>
                                        {(!show || selectedCategory) && (
                                            <div
                                                onClick={() => handlePermission(`${key}.*`)}
                                                className={`flex items-center justify-between py-1 px-2 rounded-component duration-300 cursor-pointer ${
                                                    selectedCategory ? 'bg-arix/20' : 'hover:bg-gray-600'
                                                }`}
                                            >
                                                <span className='text-sm'>{key}.*</span>
                                                <CheckIcon
                                                    className={`w-4 ${selectedCategory ? 'text-arix' : 'opacity-0'}`}
                                                />
                                            </div>
                                        )}
                                        {visiblePermissionKeys.length > 0 && (
                                            <div className='ml-2 space-y-1'>
                                                {visiblePermissionKeys.map((permKey) => {
                                                    const fullPermission = `${key}.${permKey}`;
                                                    const isSelected = selectedPermissions.includes(fullPermission);

                                                    return (
                                                        <div
                                                            onClick={() => handlePermission(fullPermission)}
                                                            key={permKey}
                                                            className={`flex items-center justify-between py-1 px-2 rounded-component duration-300 cursor-pointer ${
                                                                isSelected ? 'bg-arix/20' : 'hover:bg-gray-600'
                                                            }`}
                                                        >
                                                            <span className='text-sm'>{fullPermission}</span>
                                                            <CheckIcon
                                                                className={`w-4 ${
                                                                    isSelected ? 'text-arix' : 'opacity-0'
                                                                }`}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                    </div>
                </div>
            ) : (
                <div className='flex items-center gap-x-1'>
                    <Spinner size='small' />
                    Loading permissions
                </div>
            )}
        </div>
    );
};
