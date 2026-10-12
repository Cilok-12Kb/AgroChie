'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[--primary] text-white hover:bg-[--primary-hover] active:scale-[0.98] shadow-sm hover:shadow-md',
  secondary:
    'bg-[--primary-soft] text-[--primary-ink] hover:bg-[--border] active:scale-[0.98]',
  ghost:
    'bg-transparent text-[--primary] hover:bg-[--primary-soft] active:scale-[0.98]',
  danger:
    'bg-[--danger] text-white hover:opacity-90 active:scale-[0.98] shadow-sm',
  outline:
    'bg-transparent border border-[--border] text-[--text] hover:bg-[--surface-muted] active:scale-[0.98]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-1.5 gap-1.5 rounded-lg',
  md: 'text-base px-4 py-2.5 gap-2 rounded-xl',
  lg: 'text-base px-6 py-3 gap-2.5 rounded-xl font-semibold',
};

export const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className,
      children,
      disabled,
      ...rest
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center font-semibold transition-all duration-150 select-none',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--primary] focus-visible:ring-offset-2',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...rest}
      >
        {isLoading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>Memuat...</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

AppButton.displayName = 'AppButton';
