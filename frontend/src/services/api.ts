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

    const isLocalWeb = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port === '5173';
    if (isLocalWeb) return '/api';

    if (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:') {
      return 'http://172.20.10.3:8000/api';
    }
  }
  return 'http://127.0.0.1:8000/api';
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('earnvoice_token');
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  try {
    const base = getApiBase();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const res = await fetch(`${base}${cleanEndpoint}`, config);

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
    if (err instanceof ApiError) {
      throw err;
    }
    // Network error / offline
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
    localStorage.setItem('earnvoice_token', data.token);
    localStorage.setItem('earnvoice_user', JSON.stringify(data.user));
    return data;
  },

  async register(info: { name: string; email: string; password: string; password_confirmation: string }): Promise<{ user: User; token: string }> {
    const data = await request<{ user: User; token: string }>('/register', {
      method: 'POST',
      body: JSON.stringify(info),
    });
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
    try {
      const data = await request<any>(`/dashboard?period=${period}`);
      // Cache data for offline view
      await offlineDB.setCachedData('dashboard', data);
      return data;
    } catch (e) {
      const cached = await offlineDB.getCachedData<any>('dashboard');
      if (cached) return cached;
      throw e;
    }
  },

  // 3. Transactions
  async getTransactions(params: Record<string, any> = {}): Promise<{
    data: Transaction[];
    total: number;
    current_page: number;
    last_page: number;
  }> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });

    try {
      const data = await request<any>(`/transactions?${query.toString()}`);
      await offlineDB.setCachedData('transactions_page', data);
      return data;
    } catch (e) {
      const cached = await offlineDB.getCachedData<any>('transactions_page');
      if (cached) return cached;
      throw e;
    }
  },

  async createTransaction(payload: Partial<Transaction>): Promise<Transaction> {
    try {
      const data = await request<{ transaction: Transaction }>('/transactions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return data.transaction;
    } catch (e: any) {
      // If network fails, queue to IndexedDB for offline background sync
      if (!navigator.onLine || e.status === 0) {
        const client_id = 'off_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        const offlineRecord: any = {
          ...payload,
          client_id,
          id: client_id,
          synced: false,
        };
        await offlineDB.saveOfflineTransaction(offlineRecord);
        window.dispatchEvent(new Event('earnvoice_offline_tx_added'));
        return offlineRecord as Transaction;
      }
      throw e;
    }
  },

  async updateTransaction(id: number | string, payload: Partial<Transaction>): Promise<Transaction> {
    const data = await request<{ transaction: Transaction }>(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return data.transaction;
  },

  async deleteTransaction(id: number | string): Promise<void> {
    await request(`/transactions/${id}`, { method: 'DELETE' });
  },

  async syncOfflineTransactions(): Promise<{ synced_count: number }> {
    const pending = await offlineDB.getUnsyncedTransactions();
    if (!pending || pending.length === 0) {
      return { synced_count: 0 };
    }

    const data = await request<{ synced_count: number; synced: Array<{ client_id: string; server_id: number }> }>('/transactions/sync', {
      method: 'POST',
      body: JSON.stringify({ transactions: pending }),
    });

    if (data.synced && data.synced.length > 0) {
      const syncedIds = data.synced.map((s) => s.client_id).filter(Boolean);
      await offlineDB.markAsSynced(syncedIds);
      window.dispatchEvent(new Event('earnvoice_offline_tx_synced'));
    }

    return { synced_count: data.synced_count };
  },

  // 4. Accounts / Dompet
  async getAccounts(): Promise<{ accounts: Account[]; total_balance: number }> {
    try {
      const data = await request<any>('/accounts');
      await offlineDB.setCachedData('accounts', data);
      return data;
    } catch (e) {
      const cached = await offlineDB.getCachedData<any>('accounts');
      if (cached) return cached;
      throw e;
    }
  },

  async createAccount(payload: Partial<Account>): Promise<Account> {
    const data = await request<{ account: Account }>('/accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.account;
  },

  async updateAccount(id: number, payload: Partial<Account>): Promise<Account> {
    const data = await request<{ account: Account }>(`/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return data.account;
  },

  async deleteAccount(id: number): Promise<void> {
    await request(`/accounts/${id}`, { method: 'DELETE' });
  },

  async transfer(payload: {
    from_account_id: number;
    to_account_id: number;
    amount: number;
    description?: string;
    transaction_date: string;
  }): Promise<Transaction> {
    const data = await request<{ transaction: Transaction }>('/accounts/transfer', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.transaction;
  },

  // 5. Categories
  async getCategories(): Promise<Category[]> {
    try {
      const data = await request<Category[]>('/categories');
      await offlineDB.setCachedData('categories', data);
      return data;
    } catch (e) {
      const cached = await offlineDB.getCachedData<Category[]>('categories');
      if (cached) return cached;
      throw e;
    }
  },

  async createCategory(payload: Partial<Category>): Promise<Category> {
    const data = await request<{ category: Category }>('/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.category;
  },

  async updateCategory(id: number, payload: Partial<Category>): Promise<Category> {
    const data = await request<{ category: Category }>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return data.category;
  },

  async deleteCategory(id: number): Promise<void> {
    await request(`/categories/${id}`, { method: 'DELETE' });
  },

  // 6. Budgets
  async getBudgets(month?: string): Promise<{
    month: string;
    budgets: Budget[];
    summary: { total_budget: number; total_spent: number; total_remaining: number; overall_percentage: number };
  }> {
    const query = month ? `?month=${month}` : '';
    const data = await request<any>(`/budgets${query}`);
    return data;
  },

  async saveBudget(payload: { category_id: number; amount: number; month: string; alert_threshold?: number }): Promise<Budget> {
    const data = await request<{ budget: Budget }>('/budgets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.budget;
  },

  async updateBudget(id: number, payload: { amount: number; alert_threshold?: number }): Promise<Budget> {
    const data = await request<{ budget: Budget }>(`/budgets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return data.budget;
  },

  async deleteBudget(id: number): Promise<void> {
    await request(`/budgets/${id}`, { method: 'DELETE' });
  },

  // 7. Savings Goals
  async getSavingsGoals(): Promise<{
    goals: SavingsGoal[];
    summary: { total_target: number; total_collected: number; total_remaining: number; overall_percentage: number };
  }> {
    return request<any>('/savings-goals');
  },

  async createSavingsGoal(payload: Partial<SavingsGoal>): Promise<SavingsGoal> {
    const data = await request<{ goal: SavingsGoal }>('/savings-goals', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.goal;
  },

  async updateSavingsGoal(id: number, payload: Partial<SavingsGoal>): Promise<SavingsGoal> {
    const data = await request<{ goal: SavingsGoal }>(`/savings-goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return data.goal;
  },

  async depositSavingsGoal(id: number, payload: { amount: number; account_id?: number; notes?: string }): Promise<SavingsGoal> {
    const data = await request<{ goal: SavingsGoal; is_completed: boolean }>(`/savings-goals/${id}/deposit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.goal;
  },

  async deleteSavingsGoal(id: number): Promise<void> {
    await request(`/savings-goals/${id}`, { method: 'DELETE' });
  },

  // 8. Reports
  async getReports(startDate?: string, endDate?: string): Promise<any> {
    const query = new URLSearchParams();
    if (startDate) query.append('start_date', startDate);
    if (endDate) query.append('end_date', endDate);
    return request<any>(`/reports?${query.toString()}`);
  },

  // 9. Voice Server Parser
  async parseVoice(text: string): Promise<{
    raw_text: string;
    parsed: VoiceParsedResult;
    needs_clarification: boolean;
    clarification_questions: string[];
  }> {
    return request<any>('/voice/parse', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  // 10. Notifications
  async getNotifications(): Promise<{ notifications: AppNotification[]; unread_count: number }> {
    return request<any>('/notifications');
  },

  async markNotificationAsRead(id: number): Promise<void> {
    await request(`/notifications/${id}/read`, { method: 'PUT' });
  },

  async markAllNotificationsAsRead(): Promise<void> {
    await request('/notifications/read-all', { method: 'PUT' });
  },

  async clearNotifications(): Promise<void> {
    await request('/notifications', { method: 'DELETE' });
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
