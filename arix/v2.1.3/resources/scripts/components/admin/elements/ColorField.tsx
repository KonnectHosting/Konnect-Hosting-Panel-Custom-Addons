import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { Field as FormikField, FieldProps } from 'formik';
import { HexColorPicker } from 'react-colorful';
import Input from '@/components/elements/Input';
import Label from '@/components/elements/Label';

interface OwnProps {
    name: string;
    position?: 'top' | 'bottom';
    label?: string;
    description?: string;
    placeholder?: string;
    className?: string;
    validate?: (value: any) => undefined | string | Promise<any>;
}

type Props = OwnProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'name'>;

const DEFAULT_COLOR = '#123123';

const isHexColor = (value: string): boolean => /^#[\da-fA-F]{6}$/.test(value);

const getSafeHexColor = (value: unknown): string =>
    typeof value === 'string' && isHexColor(value) ? value : DEFAULT_COLOR;

const assignRef = (ref: React.Ref<HTMLInputElement>, instance: HTMLInputElement | null): void => {
    if (typeof ref === 'function') {
        ref(instance);
        return;
    }

    if (ref) {
        (ref as React.MutableRefObject<HTMLInputElement | null>).current = instance;
    }
};

interface ColorPickerInputProps {
    id?: string;
    field: FieldProps['field'];
    form: FieldProps['form'];
    position?: 'top' | 'bottom';
    description?: string;
    placeholder?: string;
    className?: string;
    inputProps: Omit<Props, keyof OwnProps | 'id'>;
    inputRef: React.Ref<HTMLInputElement>;
}

const ColorPickerInput = ({
    id,
    field,
    form,
    position = 'top',
    description,
    placeholder,
    className,
    inputProps,
    inputRef,
}: ColorPickerInputProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [typedColor, setTypedColor] = useState(getSafeHexColor(field.value));

    const currentColor = getSafeHexColor(field.value);
    const fieldError = form.touched[field.name] ? (form.errors[field.name] as string | undefined) : undefined;

    useEffect(() => {
        setTypedColor(getSafeHexColor(field.value));
    }, [field.value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent): void => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleEscape = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    return (
        <div>
            <div className={'relative'} ref={containerRef}>
                <div className={'relative flex items-center gap-2'}>
                    <button
                        type={'button'}
                        aria-label={'Toggle color picker'}
                        className={
                            'aspect-square absolute w-8 ml-2 rounded-component border border-neutral-500 hover:border-neutral-400'
                        }
                        style={{ backgroundColor: currentColor }}
                        onClick={() => setIsOpen((value) => !value)}
                    />
                    <Input
                        id={id}
                        {...field}
                        {...inputProps}
                        ref={(instance) => assignRef(inputRef, instance)}
                        type={'text'}
                        value={typedColor}
                        placeholder={placeholder ?? DEFAULT_COLOR}
                        maxLength={7}
                        className={`!pl-12 ${className ? className : ''}`}
                        hasError={!!fieldError}
                        onFocus={(event) => {
                            setIsOpen(true);
                            inputProps.onFocus?.(event);
                        }}
                        onChange={(event) => {
                            const nextValue = event.currentTarget.value;
                            setTypedColor(nextValue);

                            if (isHexColor(nextValue)) {
                                form.setFieldValue(field.name, nextValue);
                            }

                            inputProps.onChange?.(event);
                        }}
                        onBlur={(event) => {
                            const sanitized = getSafeHexColor(typedColor);
                            setTypedColor(sanitized);
                            form.setFieldTouched(field.name, true);
                            form.setFieldValue(field.name, sanitized);
                            inputProps.onBlur?.(event);
                        }}
                    />
                </div>

                {isOpen && (
                    <div
                        className={`absolute ${
                            position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
                        } z-50 rounded-component border border-neutral-500 bg-neutral-700 p-3 shadow-lg`}
                    >
                        <HexColorPicker
                            color={currentColor}
                            onChange={(nextColor) => {
                                setTypedColor(nextColor);
                                form.setFieldValue(field.name, nextColor);
                            }}
                        />
                    </div>
                )}
            </div>

            {fieldError ? (
                <p className={'input-help error text-danger-50 mt-1 text-sm'}>
                    {fieldError.charAt(0).toUpperCase() + fieldError.slice(1)}
                </p>
            ) : description ? (
                <p className={'input-help mt-1 text-sm text-gray-400'}>{description}</p>
            ) : null}
        </div>
    );
};

const ColorField = forwardRef<HTMLInputElement, Props>(
    ({ id, name, label, description, validate, position, ...props }, ref) => (
        <FormikField innerRef={ref} name={name} validate={validate}>
            {({ field, form }: FieldProps) => (
                <div>
                    {label && <Label htmlFor={id}>{label}</Label>}
                    <ColorPickerInput
                        id={id}
                        position={position}
                        field={field}
                        form={form}
                        description={description}
                        inputProps={props}
                        inputRef={ref}
                    />
                </div>
            )}
        </FormikField>
    )
);
ColorField.displayName = 'ColorField';

export default ColorField;
