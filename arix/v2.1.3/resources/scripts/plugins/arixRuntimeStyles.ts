import { store } from '@/state';
import { SiteSettings } from '@/state/settings';

const STYLE_ELEMENT_ID = 'arix-runtime-styles';

type ArixSettings = SiteSettings['arix'];

interface Rule {
    enabled: (settings?: ArixSettings) => boolean;
    css: (settings?: ArixSettings) => string;
}

const RULES: Rule[] = [
    {
        enabled: (settings?: ArixSettings) => Boolean(settings?.styling?.backdrop),
        css: () => '.backdrop{backdrop-filter:blur(16px);}',
    },
    {
        enabled: () => true,
        css: (settings?: ArixSettings) => `:root{--radiusBox:${settings?.styling?.radiusBox}px;}`,
    },
    {
        enabled: () => true,
        css: (settings?: ArixSettings) => `:root{--radiusInput:${settings?.styling?.radiusInput}px;}`,
    },
    {
        enabled: (settings?: ArixSettings) => Boolean(settings?.styling?.borderInput),
        css: () => `:root{--borderInput: 1px solid;}`,
    },
    {
        enabled: (settings?: ArixSettings) => Boolean(settings?.styling?.background),
        css: (settings?: ArixSettings) => `:root{--image: url(${settings?.styling?.backgroundImage});}`,
    },
    {
        enabled: (settings?: ArixSettings) => Boolean(settings?.styling?.background),
        css: (settings?: ArixSettings) => `.lightmode{--image: url(${settings?.styling?.backgroundImageLight});}`,
    },
    {
        enabled: () => true,
        css: (settings?: ArixSettings) => `:root{--backdropPercentage:${settings?.styling?.backdropPercentage}%;}`,
    },
    {
        enabled: (settings?: ArixSettings) => Boolean(settings?.styling?.borderBox),
        css: () => `.boxBorder{border: 1px solid; border-color:rgb(var(--gray600)) !important; }`,
    },
];

let isSubscribed = false;

const apply = (settings?: ArixSettings): void => {
    if (typeof document === 'undefined') return;

    let style = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
    if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ELEMENT_ID;
        document.head.appendChild(style);
    }

    const css = RULES.filter((rule) => rule.enabled(settings))
        .map((rule) => rule.css(settings))
        .join('');
    if (style.textContent !== css) style.textContent = css;
};

export const bootstrapArixRuntimeStyles = (initialSettings?: SiteSettings): void => {
    apply(initialSettings?.arix);

    if (isSubscribed) return;

    isSubscribed = true;
    store.subscribe(() => apply(store.getState().settings.data?.arix));
};
