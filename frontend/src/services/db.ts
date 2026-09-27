import { Account, Budget, Category, DashboardSummary, FinancialInsight, SavingsGoal, Transaction } from '@/types';

const DB_NAME = 'earnvoice_offline_db';
const DB_VERSION = 2;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('offline_transactions')) {
        const store = db.createObjectStore('offline_transactions', { keyPath: 'client_id' });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
      }

      if (!db.objectStoreNames.contains('local_transactions')) {
        const store = db.createObjectStore('local_transactions', { keyPath: 'id' });
        store.createIndex('transaction_date', 'transaction_date', { unique: false });
      }

      if (!db.objectStoreNames.contains('local_accounts')) {
        db.createObjectStore('local_accounts', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('local_categories')) {
        db.createObjectStore('local_categories', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('local_budgets')) {
        db.createObjectStore('local_budgets', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('local_savings')) {
        db.createObjectStore('local_savings', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('cached_records')) {
        db.createObjectStore('cached_records', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const DEFAULT_ACCOUNTS: Account[] = [
  { id: 1, name: 'Dompet Tunai', type: 'cash', initial_balance: 500000, current_balance: 500000, color: '#10B981', icon: 'wallet', is_active: true },
  { id: 2, name: 'Rekening Bank', type: 'bank', initial_balance: 2500000, current_balance: 2500000, color: '#3B82F6', icon: 'building-2', is_active: true },
  { id: 3, name: 'E-Wallet', type: 'ewallet', initial_balance: 150000, current_balance: 150000, color: '#8B5CF6', icon: 'smartphone', is_active: true },
];

const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, name: 'Makanan & Minuman', type: 'expense', icon: 'utensils', color: '#EF4444', is_default: true },
  { id: 2, name: 'Transportasi', type: 'expense', icon: 'car', color: '#F59E0B', is_default: true },
  { id: 3, name: 'Belanja', type: 'expense', icon: 'shopping-cart', color: '#8B5CF6', is_default: true },
  { id: 4, name: 'Tagihan & Utilitas', type: 'expense', icon: 'zap', color: '#EC4899', is_default: true },
  { id: 5, name: 'Hiburan', type: 'expense', icon: 'film', color: '#3B82F6', is_default: true },
  { id: 6, name: 'Kesehatan', type: 'expense', icon: 'heart', color: '#14B8A6', is_default: true },
  { id: 7, name: 'Gaji', type: 'income', icon: 'briefcase', color: '#10B981', is_default: true },
  { id: 8, name: 'Bonus & Freelance', type: 'income', icon: 'sparkles', color: '#06B6D4', is_default: true },
  { id: 9, name: 'Investasi', type: 'income', icon: 'trending-up', color: '#8B5CF6', is_default: true },
];

export const offlineDB = {
  // Ensure default accounts and categories exist locally
  async seedInitialDataIfEmpty(): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(['local_accounts', 'local_categories'], 'readwrite');
    const accStore = tx.objectStore('local_accounts');
    const catStore = tx.objectStore('local_categories');

    const accCountReq = accStore.count();
    accCountReq.onsuccess = () => {
      if (accCountReq.result === 0) {
        DEFAULT_ACCOUNTS.forEach(a => accStore.put(a));
      }
    };

    const catCountReq = catStore.count();
    catCountReq.onsuccess = () => {
      if (catCountReq.result === 0) {
        DEFAULT_CATEGORIES.forEach(c => catStore.put(c));
      }
    };

    return new Promise(resolve => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  },

  // 1. Transactions
  async saveLocalTransaction(payload: Partial<Transaction>): Promise<Transaction> {
    await this.seedInitialDataIfEmpty();
    const db = await openDB();

    const id = payload.id || ('loc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
    const client_id = payload.client_id || String(id);
    const amount = Number(payload.amount) || 0;
    const type = payload.type || 'expense';
    const account_id = Number(payload.account_id);
    const to_account_id = payload.to_account_id ? Number(payload.to_account_id) : null;
    const category_id = payload.category_id ? Number(payload.category_id) : null;

    // Get current account and category info for complete record
    const accounts = await this.getLocalAccountsList();
    const categories = await this.getLocalCategories();

    const account = accounts.find(a => a.id === account_id);
    const toAccount = to_account_id ? accounts.find(a => a.id === to_account_id) : undefined;
    const category = category_id ? categories.find(c => c.id === category_id) : undefined;

    const fullRecord: Transaction = {
      id: id as any,
      client_id,
      user_id: 1,
      account_id,
      to_account_id: to_account_id || undefined,
      category_id: category_id || undefined,
      type,
      amount,
      description: payload.description || '',
      transaction_date: payload.transaction_date || new Date().toISOString().split('T')[0],
      input_method: payload.input_method || 'manual',
      voice_text: payload.voice_text || null,
      attachment: payload.attachment || null,
      created_at: new Date().toISOString(),
      synced: false,
      account,
      to_account: toAccount,
      category,
    };

    // Update account balances
    if (account) {
      if (type === 'expense') {
        account.current_balance = Number(account.current_balance) - amount;
      } else if (type === 'income') {
        account.current_balance = Number(account.current_balance) + amount;
      } else if (type === 'transfer') {
        account.current_balance = Number(account.current_balance) - amount;
        if (toAccount) {
          toAccount.current_balance = Number(toAccount.current_balance) + amount;
        }
      }
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['local_transactions', 'offline_transactions', 'local_accounts'], 'readwrite');
      tx.objectStore('local_transactions').put(fullRecord);
      tx.objectStore('offline_transactions').put(fullRecord);

      if (account) {
        tx.objectStore('local_accounts').put(account);
      }
      if (toAccount) {
        tx.objectStore('local_accounts').put(toAccount);
      }

      tx.oncomplete = () => {
        window.dispatchEvent(new Event('earnvoice_offline_tx_added'));
        resolve(fullRecord);
      };
      tx.onerror = () => reject(tx.error);
    });
  },

  async getLocalTransactions(params: Record<string, any> = {}): Promise<{
    data: Transaction[];
    total: number;
    current_page: number;
    last_page: number;
  }> {
    await this.seedInitialDataIfEmpty();
    const db = await openDB();

    return new Promise((resolve) => {
      const tx = db.transaction('local_transactions', 'readonly');
      const req = tx.objectStore('local_transactions').getAll();

      req.onsuccess = () => {
        let list: Transaction[] = req.result || [];

        // Filter by type
        if (params.type && params.type !== 'all') {
          list = list.filter(t => t.type === params.type);
        }

        // Filter by account
        if (params.account_id) {
          const accId = Number(params.account_id);
          list = list.filter(t => t.account_id === accId || t.to_account_id === accId);
        }

        // Filter by category
        if (params.category_id) {
          const catId = Number(params.category_id);
          list = list.filter(t => t.category_id === catId);
        }

        // Filter by search
        if (params.search) {
          const q = params.search.toLowerCase();
          list = list.filter(t =>
            (t.description && t.description.toLowerCase().includes(q)) ||
            (t.voice_text && t.voice_text.toLowerCase().includes(q)) ||
            (t.category && t.category.name.toLowerCase().includes(q))
          );
        }

        // Filter by dates
        if (params.start_date) {
          list = list.filter(t => t.transaction_date >= params.start_date);
        }
        if (params.end_date) {
          list = list.filter(t => t.transaction_date <= params.end_date);
        }

        // Sort descending by date, then id
        list.sort((a, b) => {
          if (b.transaction_date !== a.transaction_date) {
            return b.transaction_date.localeCompare(a.transaction_date);
          }
          return String(b.id).localeCompare(String(a.id));
        });

        resolve({
          data: list,
          total: list.length,
          current_page: 1,
          last_page: 1,
        });
      };

      req.onerror = () => {
        resolve({ data: [], total: 0, current_page: 1, last_page: 1 });
      };
    });
  },

  async deleteLocalTransaction(id: number | string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['local_transactions', 'offline_transactions'], 'readwrite');
      tx.objectStore('local_transactions').delete(id);
      tx.objectStore('offline_transactions').delete(String(id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  // 2. Accounts
  async getLocalAccountsList(): Promise<Account[]> {
    await this.seedInitialDataIfEmpty();
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('local_accounts', 'readonly');
      const req = tx.objectStore('local_accounts').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve(DEFAULT_ACCOUNTS);
    });
  },

  async getLocalAccounts(): Promise<{ accounts: Account[]; total_balance: number }> {
    const accounts = await this.getLocalAccountsList();
    const total_balance = accounts
      .filter(a => a.is_active)
      .reduce((sum, a) => sum + (Number(a.current_balance) || 0), 0);
    return { accounts, total_balance };
  },

  async saveLocalAccount(account: Partial<Account>): Promise<Account> {
    const db = await openDB();
    const id = account.id || Date.now();
    const record: Account = {
      id: id as number,
      name: account.name || 'Dompet Baru',
      type: account.type || 'cash',
      initial_balance: Number(account.initial_balance) || 0,
      current_balance: Number(account.current_balance ?? account.initial_balance) || 0,
      color: account.color || '#10B981',
      icon: account.icon || 'wallet',
      is_active: account.is_active !== undefined ? account.is_active : true,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('local_accounts', 'readwrite');
      tx.objectStore('local_accounts').put(record);
      tx.oncomplete = () => resolve(record);
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteLocalAccount(id: number): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('local_accounts', 'readwrite');
      tx.objectStore('local_accounts').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  // 3. Categories
  async getLocalCategories(): Promise<Category[]> {
    await this.seedInitialDataIfEmpty();
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('local_categories', 'readonly');
      const req = tx.objectStore('local_categories').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve(DEFAULT_CATEGORIES);
    });
  },

  async saveLocalCategory(category: Partial<Category>): Promise<Category> {
    const db = await openDB();
    const id = category.id || Date.now();
    const record: Category = {
      id: id as number,
      name: category.name || 'Kategori Baru',
      type: category.type || 'expense',
      color: category.color || '#3B82F6',
      icon: category.icon || 'tag',
      is_default: false,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('local_categories', 'readwrite');
      tx.objectStore('local_categories').put(record);
      tx.oncomplete = () => resolve(record);
      tx.onerror = () => reject(tx.error);
    });
  },

  // 4. Dashboard Summary Local Calculation
  async getLocalDashboard(period = 'month'): Promise<{
    summary: DashboardSummary;
    chart_data: Array<{ date: string; label: string; income: number; expense: number }>;
    recent_transactions: Transaction[];
    budgets: Budget[];
    insights: FinancialInsight[];
  }> {
    const { accounts, total_balance } = await this.getLocalAccounts();
    const { data: allTx } = await this.getLocalTransactions();

    const now = new Date();
    const currentMonthPrefix = now.toISOString().slice(0, 7); // YYYY-MM

    let month_income = 0;
    let month_expense = 0;

    const chartMap: Record<string, { income: number; expense: number; label: string }> = {};

    // Prepare last 7 days chart labels
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
      chartMap[dateStr] = { income: 0, expense: 0, label };
    }

    allTx.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.transaction_date && t.transaction_date.startsWith(currentMonthPrefix)) {
        if (t.type === 'income') month_income += amt;
        if (t.type === 'expense') month_expense += amt;
      }

      if (chartMap[t.transaction_date]) {
        if (t.type === 'income') chartMap[t.transaction_date].income += amt;
        if (t.type === 'expense') chartMap[t.transaction_date].expense += amt;
      }
    });

    const net_savings = month_income - month_expense;

    const summary: DashboardSummary = {
      current_balance: total_balance,
      total_income_month: month_income,
      total_expense_month: month_expense,
      total_savings: net_savings,
    };

    const chart_data = Object.keys(chartMap).map(k => ({
      date: k,
      label: chartMap[k].label,
      income: chartMap[k].income,
      expense: chartMap[k].expense,
    }));

    const recent_transactions = allTx.slice(0, 6);

    const insights: FinancialInsight[] = [];
    if (month_expense > month_income && month_income > 0) {
      insights.push({
        type: 'warning',
        title: 'Pengeluaran Melebihi Pemasukan',
        description: 'Pengeluaran bulan ini telah melampaui pemasukan Anda.',
        icon: 'alert-triangle',
        color: '#F59E0B',
      });
    } else {
      insights.push({
        type: 'success',
        title: 'Arus Kas Sehat',
        description: 'Pengeluaran masih dalam batas aman terkendali.',
        icon: 'check-circle',
        color: '#10B981',
      });
    }

    return {
      summary,
      chart_data,
      recent_transactions,
      budgets: [],
      insights,
    };
  },

  // 5. Offline sync queue helpers
  async getUnsyncedTransactions(): Promise<any[]> {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('offline_transactions', 'readonly');
      const req = tx.objectStore('offline_transactions').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  },

  async getUnsyncedCount(): Promise<number> {
    const unsynced = await this.getUnsyncedTransactions();
    return unsynced.length;
  },

  async markAsSynced(clientIds: string[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(['offline_transactions', 'local_transactions'], 'readwrite');
      const offStore = tx.objectStore('offline_transactions');
      const locStore = tx.objectStore('local_transactions');

      clientIds.forEach(id => {
        offStore.delete(id);
        const getReq = locStore.get(id);
        getReq.onsuccess = () => {
          if (getReq.result) {
            getReq.result.synced = true;
            locStore.put(getReq.result);
          }
        };
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  },

  // 6. Generic cache
  async setCachedData(key: string, data: any): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction('cached_records', 'readwrite');
      tx.objectStore('cached_records').put({ key, data, updated_at: Date.now() });
    } catch {}
  },

  async getCachedData<T>(key: string): Promise<T | null> {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction('cached_records', 'readonly');
        const req = tx.objectStore('cached_records').get(key);
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  async clearAllCache(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction([
        'cached_records',
        'offline_transactions',
        'local_transactions',
        'local_accounts',
        'local_categories'
      ], 'readwrite');
      tx.objectStore('cached_records').clear();
      tx.objectStore('offline_transactions').clear();
      tx.objectStore('local_transactions').clear();
      tx.objectStore('local_accounts').clear();
      tx.objectStore('local_categories').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  },
};
