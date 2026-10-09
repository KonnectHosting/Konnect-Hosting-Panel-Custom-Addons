import React from 'react';
import { ServerContext } from '@/state/server';
import { LuServer } from 'react-icons/lu';
import styled from 'styled-components/macro';
import Markdown from 'markdown-to-jsx';
import tw from 'twin.macro';

const MyAlert = styled.div`
    ${tw`mx-auto w-full flex items-center gap-x-2 max-w-[1200px] px-4 py-3 mt-4 rounded-component text-gray-100 !border-t-0 !border-r-0 !border-b-0 bg-[#680DE533] !border-[#680DE5]`};
    border-left: var(--radiusInput) solid;

    & a {
        ${tw`underline`}
    }
    & > svg {
        font-size: 1.2rem;
    }
`;

const NodeAlert = () => {
    const nodeAlert = ServerContext.useStoreState((state) => state.server.data?.nodeAlert);

    return (
        <div className={'px-4'}>
            {nodeAlert && (
                <MyAlert className={'backdrop'}>
                    <LuServer />
                    <div>
                        <Markdown>{nodeAlert}</Markdown>
                    </div>
                </MyAlert>
            )}
        </div>
    );
};

export default NodeAlert;
