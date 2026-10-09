import { ApplicationStore } from '@/state';
import { useStoreState } from 'easy-peasy';
import React from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';

const Table = styled.table`
    ${tw`w-full`};

    tr {
        & > th {
            ${tw`text-gray-300 font-normal text-left py-2 px-3 whitespace-nowrap`};

            &:first-of-type {
                ${tw`pl-6`};
            }
            &:last-of-type {
                ${tw`pr-6`};
            }
        }

        & > td {
            ${tw`border-t border-gray-600 py-3 px-3 whitespace-nowrap`};

            &:first-of-type {
                ${tw`pl-6`};
            }
            &:last-of-type {
                ${tw`pr-6`};
            }
        }
    }
`;

interface Props {
    title: React.ReactNode;
    headers?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

export const ItemRow = ({
    children,
    ...props
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLTableRowElement>) => {
    const tableStyle = useStoreState((state: ApplicationStore) => state.settings.data!.arix.components.tableStyle);

    return tableStyle === 'default' ? (
        <tr {...props}>{children}</tr>
    ) : (
        <div className={'bg-gray-700 gap-4 rounded-box backdrop boxBorder flex justify-between flex-wrap items-center px-6 py-5'}>
            {children}
        </div>
    );
};

export const ItemCell = ({
    children,
    className,
    ...props
}: { children: React.ReactNode } & React.TdHTMLAttributes<HTMLTableCellElement>) => {
    const tableStyle = useStoreState((state: ApplicationStore) => state.settings.data!.arix.components.tableStyle);

    return tableStyle === 'default' ? (
        <td {...props} className={className ? className : ''}>
            {children}
        </td>
    ) : (
        <div
            {...props}
            className={`!w-auto ${
                className ? `${className} ${className.includes('text-end') ? 'flex-1' : ''}` : 'flex-1'
            }`}
        >
            {children}
        </div>
    );
};

const ItemList = ({ title, headers, children, footer }: Props) => {
    const tableStyle = useStoreState((state: ApplicationStore) => state.settings.data!.arix.components.tableStyle);

    return tableStyle === 'default' ? (
        <div className={'bg-gray-700 rounded-box backdrop boxBorder'}>
            <div className={'px-6 pt-5 pb-1'}>{title}</div>
            <div className={'w-full overflow-x-auto'}>
                <Table>
                    {headers && <thead>{headers}</thead>}
                    <tbody>{children}</tbody>
                </Table>
            </div>
            {footer && <div className={'px-6 py-2 border-t border-gray-600'}>{footer}</div>}
        </div>
    ) : (
        <div>
            {title}
            <div className={`mt-4 space-y-2`}>{children}</div>

            {footer}
        </div>
    );
};

export default ItemList;
