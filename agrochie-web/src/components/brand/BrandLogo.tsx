import Image from 'next/image';

export function BrandLogo({
  size = 40,
  className = '',
  priority = false,
  alt = 'AgroChie logo',
}: {
  size?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/agrochie-logo.png"
        alt={alt}
        width={size}
        height={size}
        className="h-full w-full object-contain"
        priority={priority}
      />
    </span>
  );
}
