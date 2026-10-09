import React, { memo, useCallback, useState } from 'react';
import isEqual from 'react-fast-compare';
import tw from 'twin.macro';
import InputSpinner from '@/components/elements/InputSpinner';
import Input from '@/components/elements/Input';
import Can from '@/components/elements/Can';
import { Button } from '@/components/elements/button/index';
import { Allocation } from '@/api/server/getServer';
import styled from 'styled-components/macro';
import { debounce } from 'debounce';
import setServerAllocationNotes from '@/api/server/network/setServerAllocationNotes';
import { useFlashKey } from '@/plugins/useFlash';
import { ServerContext } from '@/state/server';
import CopyOnClick from '@/components/elements/CopyOnClick';
import DeleteAllocationButton from '@/components/server/network/DeleteAllocationButton';
import setPrimaryServerAllocation from '@/api/server/network/setPrimaryServerAllocation';
import getServerAllocations from '@/api/swr/getServerAllocations';
import { ip } from '@/lib/formatters';
import { useTranslation } from 'react-i18next';
import { ItemRow, ItemCell } from '@/components/elements/ItemList';

const Label = styled.label`
    ${tw`uppercase text-xs mt-1 text-neutral-400 block px-1 select-none transition-colors duration-150`}
`;

interface Props {
    allocation: Allocation;
}

const AllocationRow = ({ allocation }: Props) => {
    const { t } = useTranslation('arix/server/network');
    const [loading, setLoading] = useState(false);
    const { clearFlashes, clearAndAddHttpError } = useFlashKey('server:network');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { mutate } = getServerAllocations();

    const onNotesChanged = useCallback((id: number, notes: string) => {
        mutate((data) => data?.map((a) => (a.id === id ? { ...a, notes } : a)), false);
    }, []);

    const setAllocationNotes = debounce((notes: string) => {
        setLoading(true);
        clearFlashes();

        setServerAllocationNotes(uuid, allocation.id, notes)
            .then(() => onNotesChanged(allocation.id, notes))
            .catch((error) => clearAndAddHttpError(error))
            .then(() => setLoading(false));
    }, 750);

    const setPrimaryAllocation = () => {
        clearFlashes();
        mutate((data) => data?.map((a) => ({ ...a, isDefault: a.id === allocation.id })), false);

        setPrimaryServerAllocation(uuid, allocation.id).catch((error) => {
            clearAndAddHttpError(error);
            mutate();
        });
    };

    return (
        <ItemRow>
            <ItemCell className='privacy:blur-sm hover:privacy:blur-none duration-300'>
                {allocation.alias ? (
                    <CopyOnClick text={allocation.alias}>
                        <p>{allocation.alias}</p>
                    </CopyOnClick>
                ) : (
                    <CopyOnClick text={ip(allocation.ip)}>
                        <p>{ip(allocation.ip)}</p>
                    </CopyOnClick>
                )}
            </ItemCell>
            <ItemCell>{allocation.port}</ItemCell>
            <ItemCell className={'min-w-[250px]'}>
                <InputSpinner visible={loading}>
                    <Input
                        className={'bg-neutral-800 hover:border-neutral-600 border-transparent'}
                        placeholder={t('notes')}
                        defaultValue={allocation.notes || undefined}
                        onChange={(e) => setAllocationNotes(e.currentTarget.value)}
                    />
                </InputSpinner>
            </ItemCell>
            <ItemCell className={'w-1'}>
                <div className={'flex gap-x-2'}>
                    {allocation.isDefault ? (
                        <Button disabled>{t('primary')}</Button>
                    ) : (
                        <>
                            <Can action={'allocation.update'}>
                                <Button.Text onClick={setPrimaryAllocation}>{t('make-primary')}</Button.Text>
                            </Can>
                            <Can action={'allocation.delete'}>
                                <DeleteAllocationButton allocation={allocation.id} />
                            </Can>
                        </>
                    )}
                </div>
            </ItemCell>
        </ItemRow>
    );
};

export default memo(AllocationRow, isEqual);
