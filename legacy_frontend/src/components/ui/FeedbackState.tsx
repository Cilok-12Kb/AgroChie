import { cn } from '@/lib/cn';
import { Sprout, Search, AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: 'default' | 'search' | 'error';
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const defaultIcon =
    variant === 'search' ? (
      <Search size={40} className="text-[--border]" />
    ) : variant === 'error' ? (
      <AlertCircle size={40} className="text-[--danger]/40" />
    ) : (
      <Sprout size={40} className="text-[--primary-soft]" style={{ color: '#a3c4b0' }} />
    );

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-12 px-6 gap-4',
        className
      )}
    >
      <div className="w-16 h-16 rounded-2xl bg-[--surface-muted] flex items-center justify-center">
        {icon ?? defaultIcon}
      </div>
      <div className="space-y-1.5">
        <p className="font-bold text-[--text] text-lg">{title}</p>
        {description && (
          <p className="text-sm text-[--text-muted] max-w-xs mx-auto">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// Loading skeleton
export function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse-soft bg-[--border] rounded-xl',
        className
      )}
    />
  );
}

// Error state
interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <EmptyState
      variant="error"
      title="Terjadi kesalahan"
      description={message ?? 'Tidak dapat memuat data. Coba lagi.'}
      action={
        onRetry ? (
          <button
            onClick={onRetry}
            className="text-sm font-semibold text-[--primary] hover:underline"
          >
            Coba lagi
          </button>
        ) : undefined
      }
    />
  );
}
