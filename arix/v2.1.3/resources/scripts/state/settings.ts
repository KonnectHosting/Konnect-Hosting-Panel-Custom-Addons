import { LinkSettings } from '@/api/admin/Link';
import { action, Action } from 'easy-peasy';

export interface SiteSettings {
    name: string;
    locale: string;
    arix: {
        general: {
            logo: string;
            logoLight: string;
            fullLogo: boolean;
            logoHeight: number;

            discord: string;
            support: string;
        };

        announcement: {
            enabled: boolean;
            position: 'header' | 'top';
            color: string;
            icon: string;
            message: string;
            cta: boolean;
            ctaTitle: string;
            ctaLink: string;
            dismissable: boolean;
        };

        styling: {
            pageTitle: boolean;

            background: boolean;
            backgroundImage?: string;
            backgroundImageLight?: string;
            backgroundFaded: 'default' | 'translucent' | 'faded';
            loginBackground?: string;

            backdrop: boolean;
            backdropPercentage: number;

            radiusInput: number;
            radiusBox: number;

            borderInput: boolean;
            borderBox: boolean;

            clickEffect: 'drop' | 'shrink' | 'outline';
            pageTransition: 'fadeUp' | 'fadeIn' | 'fadeScale';

            flashMessage: number;
        };

        layout: {
            layout: 'default' | 'slim' | 'floating' | 'pill' | 'horizontal';
            dock: 'sidebar' | 'top' | 'header';
            hoverEffect: 'default' | 'filled' | 'filled secondary' | 'icon pill' | 'pill' | 'pill secondary';
            searchComponent: string;

            logoPosition: string;
            socialPosition: string;
            loginLayout: string;
        };

        components: {
            serverRow: string;

            statsCards: number;
            sideGraphs: number;
            graphs: number;

            titledBoxStyle: 'default' | 'line' | 'fill' | 'pill';
            statsStyle: 'default' | 'reversed' | 'minimal' | 'minimalReversed';

            tableStyle: 'default' | 'cards';
        };

        social: {
            socials: {
                title: string;
                icon:
                    | 'billing'
                    | 'status'
                    | 'support'
                    | 'discord'
                    | 'twitter'
                    | 'instagram'
                    | 'linkedin'
                    | 'youtube'
                    | 'github';
                description: string;
                url: string;
            }[];

            socialButtons: boolean;
            discordBox: boolean;
        };

        advanced: {
            defaultMode: string;
            modeToggler: boolean;
            langSwitch: boolean;
            defaultLang: string;
            languageOptions: { key: string; name: string }[];
            copyright: string;
            profileType: string;
            ipFlag: boolean;
            lowResourcesAlert: boolean;
            alertLink?: string;
            dashboardPage: boolean;
            registration: boolean;

            trashbin: boolean;
            gracePeriod: number;

            tierVisibility: 'hidden' | 'show';

            profileCustomization: {
                username: boolean;
                name: boolean;
                email: boolean;
            };

            subscriptionAlert: boolean;
        };

        dashboardWidgets: string[];

        links: LinkSettings;
    };
    recaptcha: {
        method: 'recaptcha' | 'turnstile';
        enabled: boolean;
        siteKey: string;
    };
    turnstile: {
        siteKey: string;
    };
}

export interface SettingsStore {
    data?: SiteSettings;
    setSettings: Action<SettingsStore, SiteSettings>;
    updateSetting: Action<SettingsStore, { key: string; value: any }>;
}

const settings: SettingsStore = {
    data: undefined,

    setSettings: action((state, payload) => {
        state.data = payload;
    }),

    updateSetting: action((state, { key, value }) => {
        if (!state.data) return;

        const keys = key.split('.');

        let current: any = state.data;

        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }

        current[keys[keys.length - 1]] = value;
    }),
};

export default settings;
