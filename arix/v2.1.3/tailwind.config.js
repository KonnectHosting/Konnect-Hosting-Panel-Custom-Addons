const colors = require('tailwindcss/colors');
const plugin = require('tailwindcss/plugin');

const gray = {
    50: 'rgb(var(--gray50))',
    100: 'rgb(var(--gray100))',
    200: 'rgb(var(--gray200))',
    300: 'rgb(var(--gray300))',
    400: 'rgb(var(--gray400))',
    500: 'rgb(var(--gray500))',
    600: 'rgb(var(--gray600))',
    700: 'var(--gray700)',
    800: 'rgb(var(--gray800))',
    900: 'rgb(var(--gray900))',
};

module.exports = {
    content: [
        './resources/scripts/**/*.{js,ts,tsx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                header: ['"IBM Plex Sans"', '"Roboto"', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                box: 'var(--radiusBox)',
                component: 'var(--radiusInput)'
            },
            colors: {
                black: '#131a20',
                // "primary" and "neutral" are deprecated, prefer the use of "blue" and "gray"
                // in new code.
                arix: 'rgb(var(--primary))',
                success: {
                    50: 'rgb(var(--successText))',
                    100: 'rgb(var(--successBorder))',
                    200: 'rgb(var(--successBackground))'
                },
                danger: {
                    50: 'rgb(var(--dangerText))',
                    100: 'rgb(var(--dangerBorder))',
                    200: 'rgb(var(--dangerBackground))'
                },
                secondary: {
                    50: 'rgb(var(--secondaryText))',
                    100: 'rgb(var(--secondaryBorder))',
                    200: 'rgb(var(--secondaryBackground))'
                },
                primary: colors.blue,
                gray: gray,
                neutral: gray,
                cyan: colors.cyan,
            },
            fontSize: {
                '2xs': '0.625rem',
            },
            transitionDuration: {
                250: '250ms',
            },
            borderColor: theme => ({
                default: theme('colors.neutral.400', 'currentColor'),
            }),
        },
    },
    plugins: [
        require('@tailwindcss/line-clamp'),
        require('@tailwindcss/forms')({
            strategy: 'class',
        }),
        plugin(function ({ addVariant }) {
          addVariant('compact', '.compact &')
        }),
        plugin(function ({ addVariant }) {
          addVariant('privacy', '.privacy &')
        }),
    ]
};
