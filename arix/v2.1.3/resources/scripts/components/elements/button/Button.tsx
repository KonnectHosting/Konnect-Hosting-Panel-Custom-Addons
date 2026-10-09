import React, { forwardRef } from 'react';
import classNames from 'classnames';
import { ButtonProps, Options } from '@/components/elements/button/types';
import styles from './style.module.css';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ children, shape, size, variant, className, ...rest }, ref) => {
        const clickEffect = useStoreState((state: ApplicationStore) => state.settings.data!.arix.styling.clickEffect);

        const ClickEffectStyling =
            clickEffect === 'drop' ? styles.drop : clickEffect === 'shrink' ? styles.shrink : styles.outline;

        return (
            <button
                ref={ref}
                className={classNames(
                    ClickEffectStyling,
                    styles.button,
                    styles.primary,
                    {
                        [styles.secondary]: variant === Options.Variant.Secondary,
                        [styles.square]: shape === Options.Shape.IconSquare,
                        [styles.small]: size === Options.Size.Small,
                        [styles.large]: size === Options.Size.Large,
                    },
                    'compact:px-3 compact:py-1',
                    className
                )}
                {...rest}
            >
                {children}
            </button>
        );
    }
);

const TextButton = forwardRef<HTMLButtonElement, ButtonProps>(({ className, ...props }, ref) => (
    // @ts-expect-error not sure how to get this correct
    <Button ref={ref} className={classNames(styles.text, className)} {...props} />
));

const DangerButton = forwardRef<HTMLButtonElement, ButtonProps>(({ className, ...props }, ref) => (
    // @ts-expect-error not sure how to get this correct
    <Button ref={ref} className={classNames(styles.danger, className)} {...props} />
));

const SuccessButton = forwardRef<HTMLButtonElement, ButtonProps>(({ className, ...props }, ref) => (
    // @ts-expect-error not sure how to get this correct
    <Button ref={ref} className={classNames(styles.success, className)} {...props} />
));

const _Button = Object.assign(Button, {
    Sizes: Options.Size,
    Shapes: Options.Shape,
    Variants: Options.Variant,
    Text: TextButton,
    Danger: DangerButton,
    Success: SuccessButton,
});

export default _Button;
