import { offlineDB } from './db';
import {
  Account,
  AppNotification,
  Budget,
  Category,
  DashboardSummary,
  FinancialInsight,
  SavingsGoal,
  Transaction,
  User,
  VoiceParsedResult
} from '@/types';

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('earnvoice_server_url');
    if (custom) return custom.replace(/\/+$/, '') + '/api';

    // On local machine (browser dev port 5173, Windows standalone app port 5174, etc.)
    const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalHost) {
      return '/api';
    }

    if (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:') {
      return 'http://172.20.10.3:8000/api';
    }
  }
  return '/api';
}

export function isOfflineMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    localStorage.getItem('earnvoice_is_offline_mode') === 'true' ||
    !localStorage.getItem('earnvoice_token')
  );
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('earnvoice_token');
  if (!token && endpoint !== '/login' && endpoint !== '/register') {
    throw new ApiError(0, 'Mode offline aktif.');
  }
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Safe 3.5s timeout controller to prevent UI hang on Windows or slow backend
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  const config: RequestInit = {
    ...options,
    headers,
    signal: options.signal || controller.signal,
  };

  try {
    const base = getApiBase();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const res = await fetch(`${base}${cleanEndpoint}`, config);
    clearTimeout(timeoutId);

    if (res.status === 401) {
      // Token expired or invalid
      if (endpoint !== '/login' && endpoint !== '/register') {
        localStorage.removeItem('earnvoice_token');
        localStorage.removeItem('earnvoice_user');
        window.dispatchEvent(new Event('earnvoice_auth_logout'));
      }
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = data.message || 'Terjadi kesalahan pada server.';
      throw new ApiError(res.status, message, data.errors);
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err instanceof ApiError) {
      throw err;
    }
    // Network error / timeout / offline
    throw new ApiError(0, 'Koneksi gagal atau offline. Aplikasi tetap dapat digunakan dalam mode offline.');
  }
}

export const api = {
  // 1. Auth
  async login(credentials: { email: string; password: string }): Promise<{ user: User; token: string }> {
    const data = await request<{ user: User; token: string }>('/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    localStorage.removeItem('earnvoice_is_offline_mode');
    localStorage.setItem('earnvoice_token', data.token);
    localStorage.setItem('earnvoice_user', JSON.stringify(data.user));
    return data;
  },

  async register(info: { name: string; email: string; password: string; password_confirmation: string }): Promise<{ user: User; token: string }> {
    const data = await request<{ user: User; token: string }>('/register', {
      method: 'POST',
      body: JSON.stringify(info),
    });
    localStorage.removeItem('earnvoice_is_offline_mode');
    localStorage.setItem('earnvoice_token', data.token);
    localStorage.setItem('earnvoice_user', JSON.stringify(data.user));
    return data;
  },

  async logout(): Promise<void> {
    try {
      await request('/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('earnvoice_token');
      localStorage.removeItem('earnvoice_user');
      window.dispatchEvent(new Event('earnvoice_auth_logout'));
    }
  },

  async getProfile(): Promise<User> {
    const data = await request<{ user: User }>('/user');
    return data.user;
  },

  async updateProfile(updates: Partial<User>): Promise<User> {
    const data = await request<{ user: User }>('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    localStorage.setItem('earnvoice_user', JSON.stringify(data.user));
    return data.user;
  },

  async updatePassword(payload: { current_password: string; password: string; password_confirmation: string }): Promise<void> {
    await request('/user/password', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async forgotPassword(email: string): Promise<string> {
    const data = await request<{ message: string }>('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return data.message;
  },

  // 2. Dashboard
  async getDashboard(period = 'month'): Promise<{
    summary: DashboardSummary;
    chart_data: Array<{ date: string; label: string; income: number; expense: number }>;
    recent_transactions: Transaction[];
    budgets: Budget[];
    insights: FinancialInsight[];
  }> {
    if (isOfflineMode()) {
      return offlineDB.getLocalDashboard(period);
    }
    try {
      const data = await request<any>(`/dashboard?period=${period}`);
      await offlineDB.setCachedData('dashboard', data);
      return data;
    } catch {
      return offlineDB.getLocalDashboard(period);
    }
  },

  // 3. Transactions
  async getTransactions(params: Record<string, any> = {}): Promise<{
    data: Transaction[];
    total: number;
    current_page: number;
    last_page: number;
  }> {
    if (isOfflineMode()) {
      return offlineDB.getLocalTransactions(params);
    }
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });

    try {
      const data = await request<any>(`/transactions?${query.toString()}`);
      await offlineDB.setCachedData('transactions_page', data);
      if (data && Array.isArray(data.data)) {
        offlineDB.seedInitialDataIfEmpty().then(async () => {
          for (const tx of data.data) {
            await offlineDB.saveLocalTransaction({ ...tx, synced: true }).catch(() => {});
          }
        }).catch(() => {});
      }
      return data;
    } catch {
      return offlineDB.getLocalTransactions(params);
    }
  },

  async createTransaction(payload: Partial<Transaction>): Promise<Transaction> {
    if (isOfflineMode()) {
      const tx = await offlineDB.saveLocalTransaction(payload);
      window.dispatchEvent(new Event('earnvoice_offline_tx_added'));
      return tx;
    }
    try {
      const data = await request<{ transaction: Transaction }>('/transactions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await offlineDB.saveLocalTransaction({ ...data.transaction, synced: true }).catch(() => {});
      window.dispatchEvent(new Event('earnvoice_offline_tx_added'));
      return data.transaction;
    } catch {
      const tx = await offlineDB.saveLocalTransaction(payload);
      window.dispatchEvent(new Event('earnvoice_offline_tx_added'));
      return tx;
    }
  },

  async updateTransaction(id: number | string, payload: Partial<Transaction>): Promise<Transaction> {
    const isLocalId = typeof id === 'string' && (id.startsWith('loc_') || id.startsWith('off_'));
    if (isOfflineMode() || isLocalId) {
      const tx = await offlineDB.saveLocalTransaction({ ...payload, id });
      window.dispatchEvent(new Event('earnvoice_offline_tx_added'));
      return tx;
    }
    try {
      const data = await request<{ transaction: Transaction }>(`/transactions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      await offlineDB.saveLocalTransaction({ ...data.transaction, synced: true }).catch(() => {});
      window.dispatchEvent(new Event('earnvoice_offline_tx_added'));
      return data.transaction;
    } catch {
      const tx = await offlineDB.saveLocalTransaction({ ...payload, id });
      window.dispatchEvent(new Event('earnvoice_offline_tx_added'));
      return tx;
    }
  },

  async deleteTransaction(id: number | string): Promise<void> {
    const isLocalId = typeof id === 'string' && (id.startsWith('loc_') || id.startsWith('off_'));
    await offlineDB.deleteLocalTransaction(id);
    if (!isOfflineMode() && !isLocalId) {
      try {
        await request(`/transactions/${id}`, { method: 'DELETE' });
      } catch {}
    }
    window.dispatchEvent(new Event('earnvoice_offline_tx_added'));
  },

  async syncOfflineTransactions(): Promise<{ synced_count: number }> {
    if (isOfflineMode()) return { synced_count: 0 };
    const pending = await offlineDB.getUnsyncedTransactions();
    if (!pending || pending.length === 0) {
      return { synced_count: 0 };
    }

    try {
      const data = await request<{ synced_count: number; synced: Array<{ client_id: string; server_id: number }> }>('/transactions/sync', {
        method: 'POST',
        body: JSON.stringify({ transactions: pending }),
      });

      if (data.synced && data.synced.length > 0) {
        const syncedIds = data.synced.map((s) => s.client_id).filter(Boolean);
        await offlineDB.markAsSynced(syncedIds);
        window.dispatchEvent(new Event('earnvoice_offline_tx_synced'));
      }

      return { synced_count: data.synced_count || 0 };
    } catch {
      return { synced_count: 0 };
    }
  },

  // 4. Accounts / Dompet
  async getAccounts(): Promise<{ accounts: Account[]; total_balance: number }> {
    if (isOfflineMode()) {
      return offlineDB.getLocalAccounts();
    }
    try {
      const data = await request<any>('/accounts');
      await offlineDB.setCachedData('accounts', data);
      if (data && Array.isArray(data.accounts)) {
        for (const acc of data.accounts) {
          await offlineDB.saveLocalAccount(acc).catch(() => {});
        }
      }
      return data;
    } catch {
      return offlineDB.getLocalAccounts();
    }
  },

  async createAccount(payload: Partial<Account>): Promise<Account> {
    if (isOfflineMode()) {
      const acc = await offlineDB.saveLocalAccount(payload);
      window.dispatchEvent(new Event('earnvoice_offline_tx_added'));
      return acc;
    }
    try {
      const data = await request<{ account: Account }>('/accounts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await offlineDB.saveLocalAccount(data.account).catch(() => {});
      window.dispatchEvent(new Event('earnvoice_offline_tx_added'));
      return data.account;
    } catch {
      const acc = await offlineDB.saveLocalAccount(payload);
      window.dispatchEvent(new Event('earnvoice_offline_tx_added'));
      return acc;
    }
  },

  async updateAccount(id: number, payload: Partial<Account>): Promise<Account> {
    if (isOfflineMode()) {
      const acc = await offlineDB.saveLocalAccount({ ...payload, id });
      window.dispatchEvent(new Event('earnvoice_offline_tx_added'));
      return acc;
    }
    try {
      const data = await request<{ account: Account }>(`/accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      await offlineDB.saveLocalAccount(data.account).catch(() => {});
      window.dispatchEvent(new Event('earnvoice_offline_tx_added'));
      return data.account;
    } catch {
      const acc = await offlineDB.saveLocalAccount({ ...payload, id });
      window.dispatchEvent(new Event('earnvoice_offline_tx_added'));
      return acc;
    }
  },

  async deleteAccount(id: number): Promise<void> {
    await offlineDB.deleteLocalAccount(id);
    if (!isOfflineMode()) {
      try {
        await request(`/accounts/${id}`, { method: 'DELETE' });
      } catch {}
    }
    window.dispatchEvent(new Event('earnvoice_offline_tx_added'));
  },

  async transfer(payload: {
    from_account_id: number;
    to_account_id: number;
    amount: number;
    description?: string;
    transaction_date: string;
  }): Promise<Transaction> {
    if (isOfflineMode()) {
      const tx = await offlineDB.saveLocalTransaction({
        account_id: payload.from_account_id,
        to_account_id: payload.to_account_id,
        amount: payload.amount,
        type: 'transfer',
        description: payload.description || 'Transfer antar rekening',
        transaction_date: payload.transaction_date,
      });
      window.dispatchEvent(new Event('earnvoice_offline_tx_added'));
      return tx;
    }
    try {
      const data = await request<{ transaction: Transaction }>('/accounts/transfer', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await offlineDB.saveLocalTransaction({ ...data.transaction, synced: true }).catch(() => {});
      window.dispatchEvent(new Event('earnvoice_offline_tx_added'));
      return data.transaction;
    } catch {
      const tx = await offlineDB.saveLocalTransaction({
        account_id: payload.from_account_id,
        to_account_id: payload.to_account_id,
        amount: payload.amount,
        type: 'transfer',
        description: payload.description || 'Transfer antar rekening',
        transaction_date: payload.transaction_date,
      });
      window.dispatchEvent(new Event('earnvoice_offline_tx_added'));
      return tx;
    }
  },

  // 5. Categories
  async getCategories(): Promise<Category[]> {
    if (isOfflineMode()) {
      return offlineDB.getLocalCategories();
    }
    try {
      const data = await request<Category[]>('/categories');
      await offlineDB.setCachedData('categories', data);
      if (Array.isArray(data)) {
        for (const cat of data) {
          await offlineDB.saveLocalCategory(cat).catch(() => {});
        }
      }
      return data;
    } catch {
      return offlineDB.getLocalCategories();
    }
  },

  async createCategory(payload: Partial<Category>): Promise<Category> {
    if (isOfflineMode()) {
      return offlineDB.saveLocalCategory(payload);
    }
    try {
      const data = await request<{ category: Category }>('/categories', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await offlineDB.saveLocalCategory(data.category).catch(() => {});
      return data.category;
    } catch {
      return offlineDB.saveLocalCategory(payload);
    }
  },

  async updateCategory(id: number, payload: Partial<Category>): Promise<Category> {
    if (isOfflineMode()) {
      return offlineDB.saveLocalCategory({ ...payload, id });
    }
    try {
      const data = await request<{ category: Category }>(`/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      await offlineDB.saveLocalCategory(data.category).catch(() => {});
      return data.category;
    } catch {
      return offlineDB.saveLocalCategory({ ...payload, id });
    }
  },

  async deleteCategory(id: number): Promise<void> {
    if (!isOfflineMode()) {
      try {
        await request(`/categories/${id}`, { method: 'DELETE' });
      } catch {}
    }
  },

  // 6. Budgets
  async getBudgets(month?: string): Promise<{
    month: string;
    budgets: Budget[];
    summary: { total_budget: number; total_spent: number; total_remaining: number; overall_percentage: number };
  }> {
    if (isOfflineMode()) {
      return {
        month: month || new Date().toISOString().slice(0, 7),
        budgets: [],
        summary: { total_budget: 0, total_spent: 0, total_remaining: 0, overall_percentage: 0 },
      };
    }
    const query = month ? `?month=${month}` : '';
    try {
      const data = await request<any>(`/budgets${query}`);
      return data;
    } catch {
      return {
        month: month || new Date().toISOString().slice(0, 7),
        budgets: [],
        summary: { total_budget: 0, total_spent: 0, total_remaining: 0, overall_percentage: 0 },
      };
    }
  },

  async saveBudget(payload: { category_id: number; amount: number; month: string; alert_threshold?: number }): Promise<Budget> {
    if (isOfflineMode()) {
      return {
        id: Date.now(),
        user_id: 1,
        category_id: payload.category_id,
        amount: payload.amount,
        month: payload.month,
        alert_threshold: payload.alert_threshold || 80,
        spent: 0,
        remaining: payload.amount,
        percentage: 0,
        is_over_budget: false,
      } as Budget;
    }
    const data = await request<{ budget: Budget }>('/budgets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.budget;
  },

  async updateBudget(id: number, payload: { amount: number; alert_threshold?: number }): Promise<Budget> {
    if (isOfflineMode()) {
      return {
        id,
        user_id: 1,
        category_id: 1,
        amount: payload.amount,
        month: new Date().toISOString().slice(0, 7),
        alert_threshold: payload.alert_threshold || 80,
        spent: 0,
        remaining: payload.amount,
        percentage: 0,
        is_over_budget: false,
      } as Budget;
    }
    const data = await request<{ budget: Budget }>(`/budgets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return data.budget;
  },

  async deleteBudget(id: number): Promise<void> {
    if (!isOfflineMode()) {
      try { await request(`/budgets/${id}`, { method: 'DELETE' }); } catch {}
    }
  },

  // 7. Savings Goals
  async getSavingsGoals(): Promise<{
    goals: SavingsGoal[];
    summary: { total_target: number; total_collected: number; total_remaining: number; overall_percentage: number };
  }> {
    if (isOfflineMode()) {
      return {
        goals: [],
        summary: { total_target: 0, total_collected: 0, total_remaining: 0, overall_percentage: 0 },
      };
    }
    try {
      return await request<any>('/savings-goals');
    } catch {
      return {
        goals: [],
        summary: { total_target: 0, total_collected: 0, total_remaining: 0, overall_percentage: 0 },
      };
    }
  },

  async createSavingsGoal(payload: Partial<SavingsGoal>): Promise<SavingsGoal> {
    if (isOfflineMode()) {
      return {
        id: Date.now(),
        user_id: 1,
        name: payload.name || 'Tabungan',
        target_amount: payload.target_amount || 0,
        current_amount: 0,
        target_date: payload.target_date || new Date().toISOString().split('T')[0],
        icon: payload.icon || 'piggy-bank',
        color: payload.color || '#10B981',
        is_completed: false,
      } as SavingsGoal;
    }
    const data = await request<{ goal: SavingsGoal }>('/savings-goals', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.goal;
  },

  async updateSavingsGoal(id: number, payload: Partial<SavingsGoal>): Promise<SavingsGoal> {
    if (isOfflineMode()) {
      return { id, ...payload } as any;
    }
    const data = await request<{ goal: SavingsGoal }>(`/savings-goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return data.goal;
  },

  async depositSavingsGoal(id: number, payload: { amount: number; account_id?: number; notes?: string }): Promise<SavingsGoal> {
    if (isOfflineMode()) {
      if (payload.account_id) {
        await offlineDB.saveLocalTransaction({
          account_id: payload.account_id,
          amount: payload.amount,
          type: 'expense',
          description: `Setor tabungan: ${payload.notes || ''}`,
          transaction_date: new Date().toISOString().split('T')[0],
        });
        window.dispatchEvent(new Event('earnvoice_offline_tx_added'));
      }
      return { id, current_amount: payload.amount } as any;
    }
    const data = await request<{ goal: SavingsGoal; is_completed: boolean }>(`/savings-goals/${id}/deposit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.goal;
  },

  async deleteSavingsGoal(id: number): Promise<void> {
    if (!isOfflineMode()) {
      try { await request(`/savings-goals/${id}`, { method: 'DELETE' }); } catch {}
    }
  },

  // 8. Reports
  async getReports(startDate?: string, endDate?: string): Promise<any> {
    if (isOfflineMode()) {
      const dbRes = await offlineDB.getLocalTransactions({ start_date: startDate, end_date: endDate });
      const txs = dbRes.data;
      let total_income = 0;
      let total_expense = 0;
      const byCategory: Record<string, number> = {};
      txs.forEach(t => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'income') total_income += amt;
        if (t.type === 'expense') {
          total_expense += amt;
          const catName = t.category?.name || 'Lainnya';
          byCategory[catName] = (byCategory[catName] || 0) + amt;
        }
      });
      return {
        total_income,
        total_expense,
        net_savings: total_income - total_expense,
        category_breakdown: Object.entries(byCategory).map(([name, amount]) => ({ name, amount })),
      };
    }
    const query = new URLSearchParams();
    if (startDate) query.append('start_date', startDate);
    if (endDate) query.append('end_date', endDate);
    try {
      return await request<any>(`/reports?${query.toString()}`);
    } catch {
      const dbRes = await offlineDB.getLocalTransactions({ start_date: startDate, end_date: endDate });
      const txs = dbRes.data;
      let total_income = 0;
      let total_expense = 0;
      const byCategory: Record<string, number> = {};
      txs.forEach(t => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'income') total_income += amt;
        if (t.type === 'expense') {
          total_expense += amt;
          const catName = t.category?.name || 'Lainnya';
          byCategory[catName] = (byCategory[catName] || 0) + amt;
        }
      });
      return {
        total_income,
        total_expense,
        net_savings: total_income - total_expense,
        category_breakdown: Object.entries(byCategory).map(([name, amount]) => ({ name, amount })),
      };
    }
  },

  // 9. Voice Server Parser
  async parseVoice(text: string): Promise<{
    raw_text: string;
    parsed: VoiceParsedResult;
    needs_clarification: boolean;
    clarification_questions: string[];
  }> {
    if (isOfflineMode()) {
      const { parseIndonesianVoice } = await import('./voiceParser');
      const cats = await offlineDB.getLocalCategories();
      const res = parseIndonesianVoice(text, cats);
      return {
        raw_text: text,
        parsed: res.parsed,
        needs_clarification: res.needsClarification,
        clarification_questions: res.clarificationQuestions,
      };
    }
    try {
      return await request<any>('/voice/parse', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
    } catch {
      const { parseIndonesianVoice } = await import('./voiceParser');
      const cats = await offlineDB.getLocalCategories();
      const res = parseIndonesianVoice(text, cats);
      return {
        raw_text: text,
        parsed: res.parsed,
        needs_clarification: res.needsClarification,
        clarification_questions: res.clarificationQuestions,
      };
    }
  },

  // 10. Notifications
  async getNotifications(): Promise<{ notifications: AppNotification[]; unread_count: number }> {
    if (isOfflineMode()) {
      return { notifications: [], unread_count: 0 };
    }
    try {
      return await request<any>('/notifications');
    } catch {
      return { notifications: [], unread_count: 0 };
    }
  },

  async markNotificationAsRead(id: number): Promise<void> {
    if (!isOfflineMode()) {
      try { await request(`/notifications/${id}/read`, { method: 'PUT' }); } catch {}
    }
  },

  async markAllNotificationsAsRead(): Promise<void> {
    if (!isOfflineMode()) {
      try { await request('/notifications/read-all', { method: 'PUT' }); } catch {}
    }
  },

  async clearNotifications(): Promise<void> {
    if (!isOfflineMode()) {
      try { await request('/notifications', { method: 'DELETE' }); } catch {}
    }
  },

  getServerUrl(): string {
    return localStorage.getItem('earnvoice_server_url') || (
      (typeof window !== 'undefined' && (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:'))
        ? 'http://172.20.10.3:8000'
        : 'http://127.0.0.1:8000'
    );
  },

  setServerUrl(url: string): void {
    if (url && url.trim()) {
      localStorage.setItem('earnvoice_server_url', url.trim());
    } else {
      localStorage.removeItem('earnvoice_server_url');
    }
  },

  async testConnection(testUrl?: string): Promise<{ ok: boolean; message: string; latency?: number }> {
    const base = testUrl ? testUrl.replace(/\/+$/, '') + '/api' : getApiBase();
    const start = performance.now();
    try {
      const res = await fetch(`${base}/dashboard`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4000),
      });
      const latency = Math.round(performance.now() - start);
      if (res.status === 401 || res.status === 200) {
        return { ok: true, message: `Terhubung ke server (${latency}ms)`, latency };
      }
      return { ok: false, message: `Server merespon dengan status ${res.status}` };
    } catch {
      return { ok: false, message: 'Gagal terhubung ke server (Timeout / Network Error).' };
    }
  },
};
