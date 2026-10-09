import { format, isValid, parse } from 'date-fns';
import React, { useEffect, useState } from 'react';
import { DayPicker, DayPickerProps } from 'react-day-picker';
import 'react-day-picker/style.css';
import Input from './Input';

function DatePicker({ ...props }: DayPickerProps) {
    return (
        <div className='bg-neutral-600 space-y-3 rounded-lg border border-neutral-500 shadow-lg text-neutral-200 z-50 p-4'>
            <DayPicker
                captionLayout={props.captionLayout ? props.captionLayout : 'dropdown-months'}
                navLayout='around'
                mode={props.mode ? props.mode : 'single'}
                showOutsideDays={true}
                classNames={{
                    day: 'w-10 h-10',
                    outside: 'bg-gray-500',
                    disabled: 'bg-gray-500 cursor-not-allowed',
                    dropdowns: 'flex items-center gap-2',
                    chevron: 'fill-gray-300',
                    today: 'font-semibold text-lg',
                    selected: 'bg-arix text-white rounded-component',
                    range_start: 'bg-arix text-white',
                    range_middle: '!bg-gray-500 text-gray-200',
                    range_end: 'bg-arix text-white',
                }}
                {...props}
            />
        </div>
    );
}
export interface DatePickerInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    DatePickerProps?: DayPickerProps;
    defaultValue?: string;
}

export default function DatePickerInput({ disabled, DatePickerProps, defaultValue, ...props }: DatePickerInputProps) {
    const [month, setMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [showPicker, setShowPicker] = useState(false);
    const wrapperRef = React.useRef<HTMLDivElement>(null);

    const parseDate = (value: string): Date | null => {
        if (!value) return null;
        const date = new Date(value);
        return isValid(date) ? date : null;
    };

    const [inputValue, setInputValue] = useState(() => {
        const date = parseDate(defaultValue || '');
        return date ? format(date, 'MM/dd/yyyy') : '';
    });

    const handleDayPickerSelect = (date: Date | undefined) => {
        if (props.onChange) {
            console.log('works');
            props.onChange(
                date
                    ? ({ target: { value: format(date, 'MM/dd/yyyy') } } as React.ChangeEvent<HTMLInputElement>)
                    : ({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>)
            );
        }

        setSelectedDate(date);
        if (date) {
            setMonth(date);
            setInputValue(format(date, 'MM/dd/yyyy'));
        } else {
            setInputValue('');
        }
        setShowPicker(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (props.onChange) {
            console.log('works');
            props.onChange(e);
        }

        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 2) value = value.slice(0, 2) + '/' + value.slice(2);
        if (value.length > 5) value = value.slice(0, 5) + '/' + value.slice(5, 9);

        setInputValue(value);
        const parsedDate = parse(value, 'MM/dd/yyyy', new Date());
        if (isValid(parsedDate)) {
            setSelectedDate(parsedDate);
            setMonth(parsedDate);
        } else {
            setSelectedDate(undefined);
        }
    };

    useEffect(() => {
        const date = parseDate(defaultValue || '');
        if (date) {
            setSelectedDate(date);
            setMonth(date);
        }
    }, [defaultValue]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowPicker(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div ref={wrapperRef} className='relative'>
            <Input
                {...props}
                placeholder='mm/dd/yyyy'
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => setShowPicker(true)}
                disabled={disabled}
            />
            {showPicker && (
                <div className='absolute top-full right-0 z-10 translate-y-2'>
                    <DatePicker
                        {...DatePickerProps}
                        month={month}
                        onMonthChange={setMonth}
                        mode='single'
                        selected={selectedDate}
                        onSelect={handleDayPickerSelect}
                        disabled={disabled}
                    />
                </div>
            )}
        </div>
    );
}
