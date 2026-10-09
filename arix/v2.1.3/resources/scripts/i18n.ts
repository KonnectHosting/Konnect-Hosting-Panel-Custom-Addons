import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import I18NextHttpBackend, { HttpBackendOptions } from 'i18next-http-backend';
import I18NextMultiloadBackendAdapter from 'i18next-multiload-backend-adapter';
import LanguageDetector from 'i18next-browser-languagedetector';

// If we're using HMR use a unique hash per page reload so that we're always
// doing cache busting. Otherwise just use the builder provided hash value in
// the URL to allow cache busting to occur whenever the front-end is rebuilt.
const hash = module.hot ? Date.now().toString(16) : process.env.WEBPACK_BUILD_HASH;

i18n.use(I18NextMultiloadBackendAdapter)
    .use(initReactI18next)
    .use(LanguageDetector)
    .init({
        detection: {
            order: ['localStorage'],
            caches: ['localStorage'],
        },
        debug: process.env.DEBUG === 'true',
        fallbackLng: 'en',
        keySeparator: '.',
        backend: {
            backend: I18NextHttpBackend,
            backendOption: {
                loadPath: (languages: string[], namespaces: string[]) => {
                    return `/locales/locale.json?locale=${languages.join(',')}&namespace=${namespaces.join(',')}`;
                },
                queryStringParams: { hash },
                allowMultiLoading: true,
            } as HttpBackendOptions,
        } as Record<string, any>,
        interpolation: {
            escapeValue: false,
        },
    })
    .catch((error) => {
        console.error('Error initializing i18next:', error);
    });

export default i18n;