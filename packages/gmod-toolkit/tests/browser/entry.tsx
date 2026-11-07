import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import '@/assets/tailwind.css';
import Workshop from '@/components/server/gmodToolkit/WorkshopContainer';
import Fastdl from '@/components/server/gmodToolkit/FastdlContainer';
import Scanner from '@/components/server/gmodToolkit/ScannerContainer';
import { Websocket } from '@/plugins/Websocket';
(window as Window & { toolkitSocket?: Websocket }).toolkitSocket = new Websocket();
const page = new URLSearchParams(location.search).get('page');
ReactDOM.render(
    <BrowserRouter>
        <div className={'text-xs px-5 py-2 border-b border-neutral-700 text-neutral-400'}>
            GMod Toolkit preview · synthetic test data
        </div>
        {page === 'fastdl' ? <Fastdl /> : page === 'scanner' ? <Scanner /> : <Workshop />}
    </BrowserRouter>,
    document.getElementById('app')
);
