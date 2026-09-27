import { Transaction } from '@/types';

const DB_NAME = 'earnvoice_offline_db';
const DB_VERSION = 1;

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

      if (!db.objectStoreNames.contains('cached_records')) {
        db.createObjectStore('cached_records', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const offlineDB = {
  // Save an offline transaction
  async saveOfflineTransaction(transaction: Omit<Transaction, 'id'> & { client_id: string }): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_transactions', 'readwrite');
      const store = tx.objectStore('offline_transactions');
      const record = {
        ...transaction,
        synced: false,
        created_at: new Date().toISOString(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  // Get all pending unsynced transactions
  async getUnsyncedTransactions(): Promise<any[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_transactions', 'readonly');
      const store = tx.objectStore('offline_transactions');
      const req = store.getAll();
      req.onsuccess = () => {
        const results = req.result.filter((item: any) => !item.synced);
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  },

  // Count unsynced transactions
  async getUnsyncedCount(): Promise<number> {
    const unsynced = await this.getUnsyncedTransactions();
    return unsynced.length;
  },

  // Mark items as synced or remove them
  async markAsSynced(clientIds: string[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_transactions', 'readwrite');
      const store = tx.objectStore('offline_transactions');
      clientIds.forEach((id) => {
        store.delete(id);
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  // Cache any general data (e.g. categories, accounts, dashboard) for offline reading
  async setCachedData(key: string, data: any): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction('cached_records', 'readwrite');
      tx.objectStore('cached_records').put({ key, data, updated_at: Date.now() });
    } catch (e) {
      console.warn('Failed to cache data to IndexedDB:', e);
    }
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
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['cached_records', 'offline_transactions'], 'readwrite');
      tx.objectStore('cached_records').clear();
      tx.objectStore('offline_transactions').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};
