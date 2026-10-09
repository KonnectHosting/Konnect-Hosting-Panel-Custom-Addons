import React from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';

const Table = styled.table`
    ${tw`w-full`};

    & > tr {
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
    children: React.ReactNode;
}

const TableList = ({ children }: Props) => {
    return (
        <div className={'w-full overflow-x-auto'}>
            <Table>{children}</Table>
        </div>
    );
};

export default TableList;
