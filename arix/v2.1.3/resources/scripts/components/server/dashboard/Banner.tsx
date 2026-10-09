import React from 'react';
import { ServerContext } from '@/state/server';

const Banner = () => {
    const eggImage = ServerContext.useStoreState((state) => state.server.data!.eggImage);

    return (
        <div className={'lg:col-span-2'}>
            <div
                className={'bg-center bg-no-repeat bg-cover w-full h-[25vh] rounded-box max-h-[250px]'}
                css={`
                    background-image: url(${eggImage ? eggImage : '/arix/minecraft-banner.png'});
                `}
            />
        </div>
    );
};

export default Banner;
