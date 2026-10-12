'use client';

import { usePathname } from 'next/navigation';
import { Bell, Menu } from 'lucide-react';
import { SIDEBAR_ITEMS } from '@/config/navigation';
import Link from 'next/link';

export function TopBar() {
  const pathname = usePathname();
  const current = SIDEBAR_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  );

  return (
    <header className="lg:hidden sticky top-0 z-20 bg-[--surface]/95 backdrop-blur-md border-b border-[--border] px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[--primary] flex items-center justify-center">
            <span className="text-white text-xs font-bold">AC</span>
          </div>
          <div>
            <span className="font-bold text-[--text] text-base">
              {current?.label ?? 'AgroChie'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/pengingat"
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[--surface-muted] text-[--text-muted]"
            aria-label="Pengingat"
          >
            <Bell size={20} />
          </Link>
        </div>
      </div>
    </header>
  );
}
