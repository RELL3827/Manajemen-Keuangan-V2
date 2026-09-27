import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle, ArrowLeftRight, BarChart3, Bell, CheckCheck,
  Home, LogOut, Moon, PieChart, PiggyBank,
  Settings, Sun, Target, Wallet, Wifi, WifiOff, X
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { api } from '@/services/api';
import { cn, formatIndonesianDate } from '@/utils/formatters';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Beranda', Icon: Home },
  { id: 'transactions', label: 'Transaksi', Icon: ArrowLeftRight },
  { id: 'accounts', label: 'Dompet', Icon: Wallet },
  { id: 'budgets', label: 'Anggaran', Icon: PieChart },
  { id: 'savings', label: 'Tabungan', Icon: PiggyBank },
];

const SECONDARY_NAV = [
  { id: 'reports', label: 'Laporan', Icon: BarChart3 },
  { id: 'settings', label: 'Pengaturan', Icon: Settings },
];

export default function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const { user, notifications, unreadCount, isOnline, theme, toggleTheme, logout, refreshNotifications } = useApp();
  const [showNotif, setShowNotif] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await api.markAllNotificationsAsRead();
      await refreshNotifications();
    } finally {
      setMarkingAll(false);
    }
  };

  const notifIcon = (type: string) => {
    if (type.includes('budget')) return <AlertCircle className="text-amber-400" size={15} />;
    if (type.includes('savings')) return <Target className="text-emerald-400" size={15} />;
    return <Bell className="text-blue-400" size={15} />;
  };

  const pageTitleMap: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: 'Beranda', subtitle: 'Ringkasan finansial dan arus kas' },
    transactions: { title: 'Transaksi', subtitle: 'Riwayat & pencatatan keuangan' },
    accounts: { title: 'Dompet & Rekening', subtitle: 'Kelola saldo bank, e-wallet, dan kas' },
    budgets: { title: 'Anggaran', subtitle: 'Batas alokasi pengeluaran bulanan' },
    savings: { title: 'Target Tabungan', subtitle: 'Perencanaan dan progres target impian' },
    reports: { title: 'Laporan Finansial', subtitle: 'Statistik dan ekspor laporan berkala' },
    settings: { title: 'Pengaturan Akun', subtitle: 'Profil pengguna dan preferensi aplikasi' },
  };

  const currentMeta = pageTitleMap[activeTab] || { title: 'EarnVoice', subtitle: 'Manajemen Keuangan Pintar' };

  return (
    <div className={cn('min-h-dvh flex bg-fintech-bg text-fintech-text', theme)}>
      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-fintech-card border-r border-fintech-border flex-col z-30">
        {/* Brand Header */}
        <div className="p-5 border-b border-fintech-border/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <Wallet size={18} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-fintech-text">EarnVoice</h1>
              <p className="text-[11px] text-fintech-muted leading-none">Keuangan Cerdas</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-semibold text-fintech-muted uppercase tracking-wider">
            Menu Utama
          </div>
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={cn(
                  'flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left',
                  isActive
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                    : 'text-fintech-muted hover:text-fintech-text hover:bg-fintech-cardHover'
                )}
              >
                <Icon size={17} strokeWidth={isActive ? 2.2 : 1.7} />
                <span>{label}</span>
              </button>
            );
          })}

          <div className="pt-4 px-3 py-2 text-[10px] font-semibold text-fintech-muted uppercase tracking-wider">
            Lainnya
          </div>
          {SECONDARY_NAV.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={cn(
                  'flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left',
                  isActive
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                    : 'text-fintech-muted hover:text-fintech-text hover:bg-fintech-cardHover'
                )}
              >
                <Icon size={17} strokeWidth={isActive ? 2.2 : 1.7} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* User Footer Card */}
        <div className="p-3 border-t border-fintech-border/70">
          <div className="p-3 rounded-xl bg-fintech-bg/50 border border-fintech-border flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-bold shrink-0">
                {user?.name?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-fintech-text truncate leading-tight">{user?.name}</p>
                <p className="text-[10px] text-fintech-muted truncate leading-tight">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Keluar"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-fintech-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT WRAPPER (Offset on Desktop) ── */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-fintech-bg/85 backdrop-blur-md border-b border-fintech-border safe-top">
          <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto w-full">
            {/* Title / Breadcrumb */}
            <div className="flex items-center gap-3">
              <div className="md:hidden flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <Wallet size={15} />
                </div>
                <span className="font-bold text-sm tracking-tight text-fintech-text">EarnVoice</span>
              </div>
              <div className="hidden md:block">
                <h2 className="text-sm font-semibold text-fintech-text leading-tight">{currentMeta.title}</h2>
                <p className="text-[11px] text-fintech-muted leading-tight">{currentMeta.subtitle}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Online status badge */}
              <div className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
                isOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              )}>
                {isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
                <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
              </div>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                title="Ganti Tema"
                className="w-8 h-8 rounded-xl flex items-center justify-center text-fintech-muted hover:text-fintech-text hover:bg-fintech-cardHover transition-colors border border-fintech-border/60"
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>

              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setShowNotif(v => !v)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-fintech-muted hover:text-fintech-text hover:bg-fintech-cardHover transition-colors border border-fintech-border/60 relative"
                >
                  <Bell size={15} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
                  )}
                </button>

                <AnimatePresence>
                  {showNotif && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 mt-2 w-80 bg-fintech-card border border-fintech-border rounded-2xl shadow-fintech overflow-hidden z-50"
                    >
                      <div className="flex items-center justify-between p-3.5 border-b border-fintech-border">
                        <span className="font-semibold text-xs text-fintech-text">Pemberitahuan</span>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAll}
                            disabled={markingAll}
                            className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <CheckCheck size={12} /> Tandai dibaca
                          </button>
                        )}
                      </div>
                      <div className="max-h-72 overflow-y-auto divide-y divide-fintech-border/40">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-fintech-muted text-xs">
                            Tidak ada notifikasi baru
                          </div>
                        ) : (
                          notifications.slice(0, 10).map(n => (
                            <div
                              key={n.id}
                              className={cn(
                                'flex gap-3 p-3 text-left hover:bg-fintech-cardHover transition-colors',
                                !n.is_read && 'bg-blue-500/5'
                              )}
                            >
                              <div className="mt-0.5 shrink-0">{notifIcon(n.type)}</div>
                              <div className="min-w-0 flex-1">
                                <p className={cn('text-xs font-medium truncate', !n.is_read ? 'text-fintech-text' : 'text-fintech-muted')}>
                                  {n.title}
                                </p>
                                <p className="text-[11px] text-fintech-muted mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                                <span className="text-[10px] text-fintech-muted/70 mt-1 block">{formatIndonesianDate(n.created_at)}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile Logout shortcut */}
              <button
                onClick={logout}
                title="Keluar"
                className="md:hidden w-8 h-8 rounded-xl flex items-center justify-center text-fintech-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors border border-fintech-border/60"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-5 md:px-6 pb-24 md:pb-12">
          {children}
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAVIGATION ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-fintech-card/95 backdrop-blur-md border-t border-fintech-border safe-bottom md:hidden">
        <div className="flex items-center justify-around px-1 py-1.5">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={cn(
                  'flex flex-col items-center gap-1 py-1 px-2.5 rounded-lg transition-colors relative min-w-[56px]',
                  isActive ? 'text-blue-500 font-semibold' : 'text-fintech-muted hover:text-fintech-text'
                )}
              >
                <Icon size={19} strokeWidth={isActive ? 2.3 : 1.7} />
                <span className="text-[10px] leading-tight">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
