import { cn } from '@/lib/cn';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  badge?: React.ReactNode;
  highlight?: boolean;
  danger?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  subtitle,
  trend,
  trendLabel,
  badge,
  highlight,
  danger,
  className,
}: StatCardProps) {
  const trendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const TrendIcon = trendIcon;

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 md:p-5 flex flex-col gap-2 transition-shadow hover:shadow-md',
        highlight
          ? 'bg-[--primary] border-[--primary] text-white shadow-md'
          : danger
          ? 'bg-red-50 border-[--danger]/20'
          : 'bg-[--surface] border-[--border]',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-sm font-semibold',
            highlight ? 'text-white/80' : 'text-[--text-muted]'
          )}
        >
          {label}
        </span>
        {badge}
      </div>

      <div
        className={cn(
          'text-2xl md:text-3xl font-extrabold tabular-nums leading-none',
          highlight ? 'text-white' : danger ? 'text-[--danger]' : 'text-[--text]'
        )}
      >
        {value}
      </div>

      {(subtitle || trend) && (
        <div className="flex items-center gap-1.5 mt-0.5">
          {trend && (
            <TrendIcon
              size={14}
              className={cn(
                highlight ? 'text-white/70' : trend === 'up' ? 'text-[--danger]' : trend === 'down' ? 'text-[--success]' : 'text-[--text-muted]'
              )}
            />
          )}
          {(trendLabel || subtitle) && (
            <span
              className={cn(
                'text-xs',
                highlight ? 'text-white/70' : 'text-[--text-muted]'
              )}
            >
              {trendLabel ?? subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
