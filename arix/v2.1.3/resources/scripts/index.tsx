import React from 'react';
import ReactDOM from 'react-dom';
import App from '@/components/App';
import { SiteSettings } from '@/state/settings';
import { bootstrapArixRuntimeStyles } from '@/plugins/arixRuntimeStyles';
import { setConfig } from 'react-hot-loader';

// Enable language support.
import './i18n';

// Prevents page reloads while making component changes which
// also avoids triggering constant loading indicators all over
// the place in development.
//
// @see https://github.com/gaearon/react-hot-loader#hook-support
setConfig({ reloadHooks: false });

const { SiteConfiguration } = window as Window & { SiteConfiguration?: SiteSettings };
bootstrapArixRuntimeStyles(SiteConfiguration);

ReactDOM.render(<App />, document.getElementById('app'));
