'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { SIDEBAR_ITEMS } from '@/config/navigation';
import { Leaf, ChevronRight } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-[--surface] border-r border-[--border] fixed left-0 top-0 bottom-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-[--border]">
        <div className="w-9 h-9 rounded-xl bg-[--primary] flex items-center justify-center shadow-sm">
          <Leaf size={20} className="text-white" />
        </div>
        <div>
          <span className="font-extrabold text-lg text-[--text]">AgroChie</span>
          <span className="block text-xs text-[--text-muted] -mt-0.5">Rencana musim tanam</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-0.5" role="list">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 group',
                    isActive
                      ? 'bg-[--primary] text-white shadow-sm'
                      : 'text-[--text-muted] hover:bg-[--surface-muted] hover:text-[--text]'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon
                    size={18}
                    className={cn(
                      'flex-shrink-0 transition-transform group-hover:scale-110',
                      isActive ? 'text-white' : 'text-[--text-muted] group-hover:text-[--primary]'
                    )}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {isActive && <ChevronRight size={14} className="text-white/60" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[--border]">
        <p className="text-xs text-[--text-muted] leading-relaxed">
          Data contoh · Mode simulasi aktif
        </p>
      </div>
    </aside>
  );
}
