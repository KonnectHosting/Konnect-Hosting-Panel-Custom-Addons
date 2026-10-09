import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    className?: string;
    color?: 'success' | 'danger' | 'warning' | 'info';
}

export default function Badge({ children, className, color }: BadgeProps) {
    return (
        <span
            className={`py-1 px-2 rounded ${className || ''} ${
                color === 'danger'
                    ? 'text-danger-50 bg-danger-200/40'
                    : color === 'success'
                    ? 'text-success-50 bg-success-200/40'
                    : color === 'warning'
                    ? 'text-yellow-50 bg-yellow-500/40'
                    : color === 'info'
                    ? 'text-blue-50 bg-blue-500/40'
                    : ''
            }`}
        >
            {children}
        </span>
    );
}
