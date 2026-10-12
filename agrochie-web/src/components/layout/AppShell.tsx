'use client';
import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Leaf, ChevronDown, MapPin, Server, Bell, Menu, X } from 'lucide-react';
import { NAV_ITEMS } from '@/config/navigation';
import { useWorkspace } from '@/features/console/hooks';
import { WorkspaceContext } from '@/features/console/context';
import { Busy, ErrorLine } from '@/features/console/ui';

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const w = useWorkspace();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (w.unauthorized) router.replace(`/masuk?next=${encodeURIComponent(path)}`);
  }, [w.unauthorized, router, path]);

  // Tutup sidebar setiap pindah halaman
  useEffect(() => { setSidebarOpen(false); }, [path]);

  // Tutup sidebar jika resize ke desktop
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setSidebarOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const logout = useCallback(async () => {
    try { await (await import('@/features/console/api')).api.auth.logout(); }
    finally { window.location.href = '/masuk'; }
  }, []);

  const groups = [
    { title: 'MENU UTAMA',  items: NAV_ITEMS.filter(i => ['/beranda', '/musim-tanam', '/cuaca-lahan', '/prediksi'].includes(i.href)) },
    { title: 'OPERASIONAL', items: NAV_ITEMS.filter(i => ['/rencana-biaya', '/kalender-uang', '/catatan', '/riwayat-musim', '/risiko-kredit'].includes(i.href)) },
    { title: 'PENDUKUNG',   items: NAV_ITEMS.filter(i => ['/pengingat', '/asisten', '/profil'].includes(i.href)) },
  ];

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <Link href="/beranda" className="flex items-center gap-3 mb-9 px-3" onClick={() => setSidebarOpen(false)}>
        <span className="console-brand-icon"><Leaf size={22} strokeWidth={2.4} /></span>
        <span>
          <span className="font-black tracking-tight text-[21px] block leading-none text-slate-900">
            Agro<span className="text-emerald-700">Chie</span>
          </span>
          <span className="text-[10px] tracking-wide font-bold text-slate-500 block mt-1">Smart farming workspace</span>
        </span>
      </Link>

      {/* Season status */}
      <div className="rounded-2xl bg-emerald-50/75 border border-emerald-100 p-4 mx-1 mb-8">
        <span className="flex gap-2 items-center text-emerald-800 font-bold text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          {w.season ? 'Musim sedang berjalan' : 'Siap untuk mulai'}
        </span>
        <p className="text-[11px] text-emerald-800/70 mt-2">Rencanakan, pantau, dan catat setiap musim.</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-1 space-y-6" aria-label="Navigasi utama">
        {groups.map(group => (
          <section key={group.title}>
            <h2 className="text-[10px] font-black tracking-[.15em] text-slate-400 px-3 mb-2">{group.title}</h2>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const Icon = item.icon;
                const active = path === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`console-nav-link ${active ? 'console-nav-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon size={18} strokeWidth={active ? 2.2 : 1.9} />
                    <span>{item.label}</span>
                    {active && <span className="ml-auto w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-100 pt-4 px-2 mt-5">
        <div className="flex gap-2 items-center rounded-xl p-2">
          <div className="h-10 w-10 bg-emerald-100 rounded-xl flex items-center justify-center font-black text-emerald-700">
            {w.account.data?.name?.[0]?.toUpperCase() ?? 'P'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-slate-900 truncate">{w.account.data?.name ?? 'Petani'}</p>
            <p className="text-[11px] text-slate-500">{w.account.data?.isGuest ? 'Sesi tamu' : 'Akun petani'}</p>
          </div>
          <button title="Keluar" aria-label="Keluar" onClick={logout} className="text-slate-500 hover:text-red-600 p-1">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <WorkspaceContext.Provider value={w}>
      <div className="console-shell">

        {/* ── Desktop sidebar (fixed, always visible ≥1024px) ─────────── */}
        <aside className="console-sidebar hidden lg:flex">
          <SidebarContent />
        </aside>

        {/* ── Mobile drawer overlay ────────────────────────────────────── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
            aria-hidden="true"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Mobile sidebar drawer ────────────────────────────────────── */}
        <aside
          className={`console-sidebar-mobile lg:hidden ${sidebarOpen ? 'console-sidebar-mobile-open' : ''}`}
          aria-label="Menu navigasi"
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label="Tutup menu"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
          <SidebarContent />
        </aside>

        {/* ── Main content area ────────────────────────────────────────── */}
        <div className="console-main">
          <header className="console-topbar">
            <div className="flex min-w-0 items-center gap-3 lg:gap-4">
              {/* Hamburger (mobile only) */}
              <button
                className="lg:hidden p-2 -ml-1 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Buka menu navigasi"
                aria-expanded={sidebarOpen}
                onClick={() => setSidebarOpen(v => !v)}
              >
                <Menu size={22} />
              </button>

              {/* Brand icon (mobile, visible when sidebar closed) */}
              <Link href="/beranda" className="lg:hidden console-brand-icon" aria-label="Beranda">
                <Leaf size={20} />
              </Link>

              <span className="hidden sm:inline-flex text-xs text-slate-400 font-semibold">
                AgroChie <span className="mx-2">/</span> {NAV_ITEMS.find(x => x.href === path)?.label ?? 'Workspace'}
              </span>
              <span className="hidden lg:inline h-4 w-px bg-slate-200" />

              {/* Farm selector */}
              <div className="flex items-center gap-2">
                <MapPin size={15} className="text-emerald-700 shrink-0" />
                <select
                  aria-label="Pilih lahan aktif"
                  className="console-farm-select"
                  value={w.farm?.id ?? ''}
                  onChange={e => w.selectFarm(e.target.value)}
                  disabled={!w.farms.data?.length}
                >
                  {w.farms.data?.length
                    ? w.farms.data.map(f => <option value={f.id} key={f.id}>{f.name}</option>)
                    : <option value="">Belum ada lahan</option>}
                </select>
                <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden md:inline-flex items-center gap-2 text-[11px] text-emerald-700 font-bold rounded-full bg-emerald-50 px-3 py-1.5">
                <Server size={13} /> Express API
              </span>
              <Link href="/pengingat" aria-label="Pengingat" title="Pengingat" className="console-circle-icon">
                <Bell size={18} />
              </Link>
              <Link href="/profil" title="Profil" className="h-9 w-9 rounded-full bg-emerald-700 text-white inline-flex items-center justify-center font-extrabold text-sm">
                {w.account.data?.name?.[0]?.toUpperCase() ?? 'P'}
              </Link>
            </div>
          </header>

          <main id="main-content" className="console-content">
            {w.loading ? <Busy /> : w.unauthorized ? <Busy /> : w.error && !w.account.data
              ? <div className="max-w-xl mx-auto mt-10"><ErrorLine error={w.error} /><p className="text-sm text-slate-600 mt-2">Pastikan Express dan PostgreSQL berjalan. Refresh setelah server siap.</p></div>
              : children}
          </main>
        </div>

      </div>
    </WorkspaceContext.Provider>
  );
}
