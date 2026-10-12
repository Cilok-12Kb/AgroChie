import { cn } from '@/lib/cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'muted' | 'primary' | 'demo';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[--border] text-[--text-muted]',
  success: 'bg-[--primary-soft] text-[--primary-ink]',
  warning: 'bg-yellow-50 text-[--warning]',
  danger: 'bg-red-50 text-[--danger]',
  muted: 'bg-[--surface-muted] text-[--text-muted]',
  primary: 'bg-[--primary] text-white',
  demo: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
};

const dotClasses: Record<BadgeVariant, string> = {
  default: 'bg-[--text-muted]',
  success: 'bg-[--success]',
  warning: 'bg-[--warning]',
  danger: 'bg-[--danger]',
  muted: 'bg-[--text-muted]',
  primary: 'bg-white',
  demo: 'bg-yellow-600',
};

export function StatusBadge({
  label,
  variant = 'default',
  size = 'md',
  dot = false,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold rounded-full',
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1',
        variantClasses[variant],
        className
      )}
    >
      {dot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotClasses[variant])}
        />
      )}
      {label}
    </span>
  );
}

// Money display component
interface MoneyTextProps {
  amount: number;
  compact?: boolean;
  className?: string;
  prefix?: string;
}

export function MoneyText({ amount, compact = false, className, prefix }: MoneyTextProps) {
  const formatted = compact
    ? amount >= 1_000_000
      ? `${prefix ?? 'Rp '}${(amount / 1_000_000).toFixed(1)} jt`
      : `${prefix ?? 'Rp '}${new Intl.NumberFormat('id-ID').format(amount)}`
    : new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(amount);

  return (
    <span className={cn('tabular-nums', className)}>
      {prefix && !compact ? `${prefix}${formatted.replace('Rp', '').trim()}` : formatted}
    </span>
  );
}
