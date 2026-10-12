'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { MOBILE_NAV_ITEMS, SIDEBAR_ITEMS } from '@/config/navigation';
import { MoreHorizontal, X } from 'lucide-react';
import { useState } from 'react';

export function MobileBottomNav() {
  const pathname = usePathname();
  const [showAll, setShowAll] = useState(false);

  return (
    <>
      {/* All Features Drawer */}
      {showAll && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowAll(false)}
          />
          <div className="relative bg-[--surface] rounded-t-3xl border-t border-[--border] p-5 pb-24 max-h-[70vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-[--text]">Semua fitur</h2>
              <button
                onClick={() => setShowAll(false)}
                className="p-2 rounded-xl hover:bg-[--surface-muted]"
                aria-label="Tutup menu"
              >
                <X size={20} />
              </button>
            </div>
            <ul className="grid grid-cols-3 gap-3">
              {SIDEBAR_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setShowAll(false)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-2xl text-center transition-all',
                        isActive
                          ? 'bg-[--primary-soft] text-[--primary-ink]'
                          : 'hover:bg-[--surface-muted] text-[--text-muted]'
                      )}
                    >
                      <Icon
                        size={22}
                        className={isActive ? 'text-[--primary]' : 'text-[--text-muted]'}
                      />
                      <span className="text-xs font-semibold leading-tight">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Bottom Nav Bar */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[--surface] border-t border-[--border] px-2 pt-1 pb-safe"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        <ul className="flex items-center justify-around">
          {MOBILE_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all min-h-[48px] justify-center',
                    isActive ? 'text-[--primary]' : 'text-[--text-muted]'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="relative">
                    <Icon size={22} />
                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[--primary]" />
                    )}
                  </span>
                  <span className="text-[10px] font-semibold leading-tight text-center">
                    {item.label.split(' ')[0]}
                  </span>
                </Link>
              </li>
            );
          })}

          {/* More button */}
          <li className="flex-1">
            <button
              onClick={() => setShowAll(true)}
              className="w-full flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl text-[--text-muted] min-h-[48px] justify-center"
              aria-label="Semua fitur"
            >
              <MoreHorizontal size={22} />
              <span className="text-[10px] font-semibold">Lainnya</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
