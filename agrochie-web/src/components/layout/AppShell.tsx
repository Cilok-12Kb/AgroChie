'use client';
import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Leaf, ChevronDown, MapPin, Server, Bell, Menu, X } from 'lucide-react';
import { NAV_ITEMS } from '@/config/navigation';
import { useWorkspace } from '@/features/console/hooks';
import { WorkspaceContext } from '@/features/console/context';
import { Busy, ErrorLine } from '@/features/console/ui';
import { EmailBanner } from '@/features/auth/EmailBanner'; // [REVISI]
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher';
import { useTranslation } from '@/i18n/LanguageContext';
import type { Translations } from '@/i18n/LanguageContext';
import type { Workspace } from '@/features/console/hooks';

// [REVISI] Sidebar dipindah dari dalam AppShell ke tingkat modul (isi JSX tidak berubah).
// Semua nilai yang tadinya ditangkap closure kini lewat props.
type NavGroup = { title: string; items: Array<(typeof NAV_ITEMS)[number]> };
function SidebarContent({ w, t, groups, path, onNavigate, onLogout }: {
  w: Workspace; t: Translations; groups: NavGroup[]; path: string; onNavigate: () => void; onLogout: () => void;
}) {
  return (
    <>
      {/* Logo */}
      <Link href="/beranda" className="flex items-center gap-3 mb-9 px-3" onClick={onNavigate}>
        <span className="console-brand-icon"><Leaf size={22} strokeWidth={2.4} /></span>
        <span>
          <span className="font-black tracking-tight text-[21px] block leading-none text-slate-900">
            Agro<span className="text-emerald-700">Chie</span>
          </span>
          <span className="text-[10px] tracking-wide font-bold text-slate-500 block mt-1">{t.shell.tagline}</span>
        </span>
      </Link>

      {/* Season status */}
      <div className="rounded-2xl bg-emerald-50/75 border border-emerald-100 p-4 mx-1 mb-8">
        <span className="flex gap-2 items-center text-emerald-800 font-bold text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          {w.season ? t.shell.seasonRunning : t.shell.seasonReady}
        </span>
        <p className="text-[11px] text-emerald-800/70 mt-2">{t.shell.seasonDescription}</p>
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
                    onClick={onNavigate}
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
          <div data-no-translate className="h-10 w-10 bg-emerald-100 rounded-xl flex items-center justify-center font-black text-emerald-700">
            {w.account.data?.name?.[0]?.toUpperCase() ?? 'P'}
          </div>
          <div className="min-w-0 flex-1">
            <p data-no-translate className="text-xs font-extrabold text-slate-900 truncate">{w.account.data?.name ?? 'Petani'}</p>
            <p className="text-[11px] text-slate-500">{w.account.data?.isGuest ? t.shell.guestSession : t.shell.farmerAccount}</p>
          </div>
          <button title={t.shell.logoutLabel} aria-label={t.shell.logoutLabel} onClick={onLogout} className="text-slate-500 hover:text-red-600 p-1">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const w = useWorkspace();
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (w.unauthorized) router.replace(`/masuk?next=${encodeURIComponent(path)}`);
  }, [w.unauthorized, router, path]);

  // Tutup sidebar setiap pindah halaman
  // [REVISI] tanpa setState di dalam effect: sesuaikan state saat render ketika path berubah (hasil sama).
  const [prevPath, setPrevPath] = useState(path);
  if (prevPath !== path) { setPrevPath(path); setSidebarOpen(false); }
  const closeSidebar = () => setSidebarOpen(false);

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

  // Peta terjemahan label per href
  const navLabelMap: Record<string, string> = {
    '/beranda':         t.nav.beranda,
    '/musim-tanam':     t.nav.musimTanam,
    '/cuaca-lahan':     t.nav.cuacaLahan,
    '/deteksi-tanaman': t.nav.deteksiTanaman,
    '/prediksi':        t.nav.prediksiMusim,
    '/rencana-biaya':   t.nav.rencanaBiaya,
    '/kalender-uang':   t.nav.kalenderUang,
    '/catatan':         t.nav.catatan,
    '/riwayat-musim':   t.nav.riwayatMusim,
    '/risiko-kredit':   t.nav.risikoKredit,
    '/pengingat':       t.nav.cekLahan,
    '/asisten':         t.nav.asisten,
    '/profil':          t.nav.profil,
  };

  // Gabungkan icon dari NAV_ITEMS dengan label terjemahan
  const translatedNavItems = NAV_ITEMS.map(item => ({
    ...item,
    label: navLabelMap[item.href] ?? item.label,
  }));

  const groups = [
    { title: t.navGroup.menuUtama,   items: translatedNavItems.filter(i => ['/beranda', '/musim-tanam', '/cuaca-lahan', '/deteksi-tanaman', '/prediksi'].includes(i.href)) },
    { title: t.navGroup.operasional, items: translatedNavItems.filter(i => ['/rencana-biaya', '/kalender-uang', '/catatan', '/riwayat-musim', '/risiko-kredit'].includes(i.href)) },
    { title: t.navGroup.pendukung,   items: translatedNavItems.filter(i => ['/pengingat', '/asisten', '/profil'].includes(i.href)) },
  ];

  // [REVISI] SidebarContent dipindah ke tingkat modul (di atas AppShell); di sini hanya dipasang dengan props.
  const sidebar = (
    <SidebarContent w={w} t={t} groups={groups} path={path} onNavigate={closeSidebar} onLogout={logout} />
  );

  return (
    <WorkspaceContext.Provider value={w}>
      <div className="console-shell">

        {/* ── Desktop sidebar (fixed, always visible ≥1024px) ─────────── */}
        <aside className="console-sidebar hidden lg:flex">
          {sidebar}
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
          aria-label={t.shell.openMenu}
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            aria-label={t.shell.closeMenu}
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
          {sidebar}
        </aside>

        {/* ── Main content area ────────────────────────────────────────── */}
        <div className="console-main">
          <header className="console-topbar">
            <div className="flex min-w-0 items-center gap-3 lg:gap-4">
              {/* Hamburger (mobile only) */}
              <button
                className="lg:hidden p-2 -ml-1 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label={t.shell.openMenu}
                aria-expanded={sidebarOpen}
                onClick={() => setSidebarOpen(v => !v)}
              >
                <Menu size={22} />
              </button>

              {/* Brand icon (mobile, visible when sidebar closed) */}
              <Link href="/beranda" className="lg:hidden console-brand-icon" aria-label={t.shell.homeLabel}>
                <Leaf size={20} />
              </Link>

              <span className="hidden sm:inline-flex text-xs text-slate-400 font-semibold">
                AgroChie <span className="mx-2">/</span> {translatedNavItems.find(x => x.href === path)?.label ?? t.shell.workspace}
              </span>
              <span className="hidden lg:inline h-4 w-px bg-slate-200" />

              {/* Farm selector */}
              <div className="flex items-center gap-2">
                <MapPin size={15} className="text-emerald-700 shrink-0" />
                <select
                  aria-label={t.shell.farmSelectorLabel}
                  className="console-farm-select"
                  value={w.farm?.id ?? ''}
                  onChange={e => w.selectFarm(e.target.value)}
                  disabled={!w.farms.data?.length}
                >
                  {w.farms.data?.length
                    ? w.farms.data.map(f => <option data-no-translate value={f.id} key={f.id}>{f.name}</option>)
                    : <option value="">{t.shell.noFarm}</option>}
                </select>
                <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden md:inline-flex items-center gap-2 text-[11px] text-emerald-700 font-bold rounded-full bg-emerald-50 px-3 py-1.5">
                <Server size={13} /> {t.shell.apiBadge}
              </span>
              {/* Language Switcher */}
              <LanguageSwitcher />
              <Link href="/pengingat" aria-label={t.shell.reminderLabel} title={t.shell.reminderLabel} className="console-circle-icon">
                <Bell size={18} />
              </Link>
              <Link data-no-translate href="/profil" title={t.shell.profileLabel} className="h-9 w-9 rounded-full bg-emerald-700 text-white inline-flex items-center justify-center font-extrabold text-sm">
                {w.account.data?.name?.[0]?.toUpperCase() ?? 'P'}
              </Link>
            </div>
          </header>

          {/* [REVISI] banner email (bisa ditutup per sesi) */}
          <EmailBanner account={w.account.data} />

          <main id="main-content" className="console-content">
            {w.loading ? <Busy /> : w.unauthorized ? <Busy /> : w.error && !w.account.data
              ? <div className="max-w-xl mx-auto mt-10"><ErrorLine error={w.error} /><p className="text-sm text-slate-600 mt-2">{t.common.serverError}</p></div>
              : children}
          </main>
        </div>

      </div>
    </WorkspaceContext.Provider>
  );
}
