import {
  Home,
  Sprout,
  CloudSun,
  BarChart3,
  MessageCircle,
  User,
  Wallet,
  CalendarDays,
  ShieldCheck,
  ClipboardList,
  History,
  Bell,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  mobile: boolean;
  priority: 'P0' | 'P1' | 'P2';
  requiresFinancing?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/beranda', label: 'Beranda', icon: Home, mobile: true, priority: 'P1' },
  { href: '/musim-tanam', label: 'Musim tanam', icon: Sprout, mobile: true, priority: 'P0' },
  { href: '/pengingat', label: 'Cek lahan', icon: Bell, mobile: true, priority: 'P2' },
  { href: '/prediksi', label: 'Prediksi musim', icon: BarChart3, mobile: true, priority: 'P0', requiresFinancing: true },
  { href: '/asisten', label: 'Asisten', icon: MessageCircle, mobile: true, priority: 'P2' },
  { href: '/profil', label: 'Profil', icon: User, mobile: true, priority: 'P0' },
  { href: '/rencana-biaya', label: 'Rencana biaya', icon: Wallet, mobile: false, priority: 'P0', requiresFinancing: true },
  { href: '/kalender-uang', label: 'Kalender uang', icon: CalendarDays, mobile: false, priority: 'P0', requiresFinancing: true },
  { href: '/cuaca-lahan', label: 'Cuaca dan lahan', icon: CloudSun, mobile: false, priority: 'P1' },
  { href: '/risiko-kredit', label: 'Risiko dan kredit', icon: ShieldCheck, mobile: false, priority: 'P1', requiresFinancing: true },
  { href: '/catatan', label: 'Catatan', icon: ClipboardList, mobile: false, priority: 'P1', requiresFinancing: true },
  { href: '/riwayat-musim', label: 'Riwayat musim', icon: History, mobile: false, priority: 'P1' },
] as const;

export const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((item) => item.mobile);
export const SIDEBAR_ITEMS = NAV_ITEMS;
