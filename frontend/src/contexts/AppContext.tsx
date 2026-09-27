import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/services/api';
import type { Account, AppNotification, Category, User } from '@/types';

interface AppContextType {
  user: User | null;
  setUser: (u: User | null) => void;
  accounts: Account[];
  categories: Category[];
  notifications: AppNotification[];
  unreadCount: number;
  isOnline: boolean;
  refreshAccounts: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  logout: () => Promise<void>;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('earnvoice_user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('earnvoice_theme') as 'dark' | 'light') || 'dark';
  });

  // Online/offline detection
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Sync offline when back online
  useEffect(() => {
    if (isOnline && user) {
      api.syncOfflineTransactions().catch(() => {});
    }
  }, [isOnline, user]);

  // Auth logout event
  useEffect(() => {
    const handler = () => { setUser(null); setAccounts([]); setCategories([]); setNotifications([]); };
    window.addEventListener('earnvoice_auth_logout', handler);
    return () => window.removeEventListener('earnvoice_auth_logout', handler);
  }, []);

  // Theme application
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') { root.classList.add('dark'); }
    else { root.classList.remove('dark'); }
    localStorage.setItem('earnvoice_theme', theme);
  }, [theme]);

  const refreshAccounts = useCallback(async () => {
    try {
      const res = await api.getAccounts();
      setAccounts(res.accounts);
    } catch {}
  }, []);

  const refreshCategories = useCallback(async () => {
    try {
      const cats = await api.getCategories();
      setCategories(cats);
    } catch {}
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications);
      setUnreadCount(res.unread_count);
    } catch {}
  }, []);

  // Load data when user logs in
  useEffect(() => {
    if (user) {
      refreshAccounts();
      refreshCategories();
      refreshNotifications();
    }
  }, [user, refreshAccounts, refreshCategories, refreshNotifications]);

  // Periodic notification refresh (30 seconds)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(refreshNotifications, 30000);
    return () => clearInterval(interval);
  }, [user, refreshNotifications]);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    setAccounts([]);
    setCategories([]);
    setNotifications([]);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const handleSetUser = useCallback((u: User | null) => {
    setUser(u);
    if (u) localStorage.setItem('earnvoice_user', JSON.stringify(u));
    else { localStorage.removeItem('earnvoice_user'); localStorage.removeItem('earnvoice_token'); }
  }, []);

  return (
    <AppContext.Provider value={{
      user, setUser: handleSetUser,
      accounts, categories,
      notifications, unreadCount,
      isOnline,
      refreshAccounts, refreshCategories, refreshNotifications,
      logout, theme, toggleTheme,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
