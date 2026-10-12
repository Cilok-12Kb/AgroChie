import { cn } from '@/lib/cn';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  muted?: boolean;
}

export function SectionCard({
  title,
  subtitle,
  children,
  className,
  action,
  muted = false,
}: SectionCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[--border] p-5 md:p-6',
        muted ? 'bg-[--surface-muted]' : 'bg-[--surface]',
        'shadow-sm',
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            {title && (
              <h2 className="text-base md:text-lg font-bold text-[--text]">{title}</h2>
            )}
            {subtitle && (
              <p className="text-sm text-[--text-muted] mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
