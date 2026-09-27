import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle, ArrowRightLeft, CheckCircle2,
  CreditCard, Loader2, Pencil, Plus, Trash2, Wallet, X
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { api, ApiError, isOfflineMode } from '@/services/api';
import { offlineDB } from '@/services/db';
import type { Account } from '@/types';
import { cn, formatCompactRupiah, formatRupiah } from '@/utils/formatters';

const ACCOUNT_COLORS = [
  '#2563EB', '#10B981', '#F59E0B', '#F43F5E',
  '#8B5CF6', '#06B6D4', '#64748B', '#EC4899',
];

interface AccountFormProps {
  account?: Account | null;
  onClose: () => void;
  onSaved: () => void;
}

function AccountFormModal({ account, onClose, onSaved }: AccountFormProps) {
  const [form, setForm] = useState({
    name: account?.name ?? '',
    type: account?.type ?? 'cash',
    initial_balance: String(account?.initial_balance ?? '0'),
    account_number: account?.account_number ?? '',
    color: account?.color ?? ACCOUNT_COLORS[0],
    icon: account?.icon ?? 'Wallet',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { ...form, initial_balance: Number(form.initial_balance) };
      if (account) {
        await api.updateAccount(account.id, payload);
      } else {
        await api.createAccount(payload);
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Gagal menyimpan akun.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 modal-overlay animate-fade-in" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="w-full sm:max-w-md card-clean bottom-sheet sm:rounded-2xl max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-fintech-border shrink-0">
          <h2 className="text-sm font-semibold text-fintech-text">{account ? 'Edit Dompet' : 'Tambah Dompet / Rekening'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-fintech-muted hover:text-fintech-text hover:bg-fintech-cardHover"><X size={15} /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 space-y-3.5">
          {/* Color accent selection */}
          <div>
            <label className="text-[11px] font-medium text-fintech-muted mb-1.5 block">Warna Aksen</label>
            <div className="flex gap-2">
              {ACCOUNT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('color', c)}
                  className={cn(
                    'w-7 h-7 rounded-lg transition-transform',
                    form.color === c ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-fintech-card' : 'hover:scale-105'
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Nama Akun / Dompet</label>
            <input
              type="text"
              placeholder="cth. BCA Utama, GoPay, Dompet Tunai"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="input-field text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Tipe Akun</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} className="input-field text-xs">
                <option value="bank">Rekening Bank</option>
                <option value="ewallet">E-Wallet</option>
                <option value="cash">Uang Tunai (Cash)</option>
                <option value="savings">Tabungan Khusus</option>
                <option value="investment">Investasi</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Nomor Rekening (opsional)</label>
              <input
                type="text"
                placeholder="cth. 123456789"
                value={form.account_number}
                onChange={e => set('account_number', e.target.value)}
                className="input-field text-xs"
              />
            </div>
          </div>

          {!account && (
            <div>
              <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Saldo Awal (Rp)</label>
              <input
                type="number"
                placeholder="0"
                value={form.initial_balance}
                onChange={e => set('initial_balance', e.target.value)}
                className="input-field text-sm font-semibold tabular-nums"
                min="0"
                required
              />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 text-rose-400 text-xs">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2">
            <button type="submit" disabled={loading} className="w-full btn-primary py-2.5 text-xs flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>{loading ? 'Menyimpan...' : account ? 'Simpan Perubahan' : 'Tambah Akun'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  TRANSFER MODAL
// ─────────────────────────────────────────────
function TransferModal({ accounts, onClose, onSaved }: { accounts: Account[]; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    from_account_id: accounts[0]?.id ? String(accounts[0].id) : '',
    to_account_id: accounts[1]?.id ? String(accounts[1].id) : '',
    amount: '',
    description: '',
    transaction_date: today
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.from_account_id === form.to_account_id) {
      setError('Akun asal dan tujuan tidak boleh sama.');
      return;
    }
    setLoading(true);
    try {
      await api.transfer({
        from_account_id: Number(form.from_account_id),
        to_account_id: Number(form.to_account_id),
        amount: Number(form.amount),
        description: form.description,
        transaction_date: form.transaction_date,
      });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Transfer gagal dilakukan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 modal-overlay animate-fade-in" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="w-full sm:max-w-md card-clean bottom-sheet sm:rounded-2xl shadow-2xl overflow-hidden p-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-fintech-border">
          <h2 className="text-sm font-semibold text-fintech-text">Transfer Saldo Antar Akun</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-fintech-muted hover:text-fintech-text"><X size={15} /></button>
        </div>

        <form onSubmit={handleSubmit} className="py-3 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Dari Akun</label>
              <select value={form.from_account_id} onChange={e => set('from_account_id', e.target.value)} className="input-field text-xs" required>
                <option value="">Pilih asal</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Ke Akun</label>
              <select value={form.to_account_id} onChange={e => set('to_account_id', e.target.value)} className="input-field text-xs" required>
                <option value="">Pilih tujuan</option>
                {accounts.filter(a => String(a.id) !== form.from_account_id).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Nominal Transfer (Rp)</label>
            <input
              type="number"
              placeholder="0"
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
              className="input-field text-lg font-bold tabular-nums"
              min="1"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Catatan / Deskripsi</label>
            <input
              type="text"
              placeholder="cth. Pindah saldo untuk jajan"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              className="input-field text-xs"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 text-rose-400 text-xs">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2">
            <button type="submit" disabled={loading} className="w-full btn-primary py-2.5 text-xs flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>{loading ? 'Memproses Transfer...' : 'Konfirmasi Transfer'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  ACCOUNTS PAGE MAIN
// ─────────────────────────────────────────────
export function AccountsPage() {
  const { accounts, refreshAccounts } = useApp();
  const [loading, setLoading] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  const load = useCallback(async () => {
    // 1. Instantly read from local IndexedDB
    try {
      const local = await offlineDB.getLocalAccounts();
      if (local && local.accounts) {
        setTotalBalance(local.total_balance);
        setLoading(false);
      }
    } catch {}

    // 2. In background, revalidate from server if online
    if (!isOfflineMode()) {
      try {
        const res = await api.getAccounts();
        setTotalBalance(res.total_balance);
        await refreshAccounts();
      } catch {}
    }
    setLoading(false);
  }, [refreshAccounts]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handleUpdate = () => { load(); };
    window.addEventListener('earnvoice_offline_tx_added', handleUpdate);
    window.addEventListener('earnvoice_offline_tx_synced', handleUpdate);
    return () => {
      window.removeEventListener('earnvoice_offline_tx_added', handleUpdate);
      window.removeEventListener('earnvoice_offline_tx_synced', handleUpdate);
    };
  }, [load]);

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus akun ini? Riwayat transaksi akun ini akan tetap tersimpan.')) return;
    try { await api.deleteAccount(id); load(); } catch {}
  };

  const typeLabel = (type: string) => ({
    cash: 'Uang Tunai', bank: 'Rekening Bank', ewallet: 'E-Wallet',
    savings: 'Tabungan', investment: 'Investasi', other: 'Lainnya',
  }[type] ?? type);

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-fintech-muted">Daftar Dompet</h2>
          <p className="text-xs text-fintech-text">{accounts.length} sumber dana aktif</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTransfer(true)}
            className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
          >
            <ArrowRightLeft size={13} />
            <span>Transfer</span>
          </button>
          <button
            onClick={() => { setEditAccount(null); setShowForm(true); }}
            className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
          >
            <Plus size={14} />
            <span>Tambah</span>
          </button>
        </div>
      </div>

      {/* Aggregate Balance Banner */}
      <div className="balance-card-modern rounded-2xl p-5">
        <p className="text-xs font-medium text-slate-400 mb-1">Total Saldo Terkonsolidasi</p>
        <p className="text-3xl font-bold tracking-tight text-white tabular-nums">{formatRupiah(totalBalance)}</p>
      </div>

      {/* Accounts Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 shimmer rounded-xl" />)}
        </div>
      ) : accounts.length === 0 ? (
        <div className="py-14 text-center card-clean">
          <Wallet size={28} className="mx-auto mb-2 text-fintech-muted/40" />
          <p className="text-xs font-medium text-fintech-text">Belum ada akun terdaftar</p>
          <button onClick={() => setShowForm(true)} className="btn-primary text-xs mt-3">
            Tambah Akun Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="card-clean p-4 relative group cursor-pointer hover:border-slate-700 transition-colors"
              onClick={() => { setEditAccount(acc); setShowForm(true); }}
            >
              {/* Top Accent line */}
              <div
                className="absolute top-0 left-4 right-4 h-[2px] rounded-full"
                style={{ backgroundColor: acc.color || '#2563EB' }}
              />

              <div className="flex items-start justify-between mb-3 mt-1">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: acc.color || '#2563EB' }}
                  >
                    <Wallet size={15} />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-fintech-text">{acc.name}</h3>
                    <p className="text-[10px] text-fintech-muted flex items-center gap-1">
                      <CreditCard size={10} />
                      <span>{typeLabel(acc.type)}</span>
                      {acc.account_number && <span className="text-fintech-muted/60">· {acc.account_number}</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => { e.stopPropagation(); setEditAccount(acc); setShowForm(true); }}
                    className="w-6 h-6 rounded flex items-center justify-center text-fintech-muted hover:text-fintech-text hover:bg-fintech-cardHover"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(acc.id); }}
                    className="w-6 h-6 rounded flex items-center justify-center text-fintech-muted hover:text-rose-400 hover:bg-rose-500/10"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div>
                <p className="text-lg font-bold text-white tabular-nums tracking-tight">
                  {formatRupiah(acc.current_balance)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showForm && (
          <AccountFormModal
            key="account-form"
            account={editAccount}
            onClose={() => { setShowForm(false); setEditAccount(null); }}
            onSaved={() => { setShowForm(false); setEditAccount(null); load(); }}
          />
        )}
        {showTransfer && (
          <TransferModal
            key="transfer"
            accounts={accounts}
            onClose={() => setShowTransfer(false)}
            onSaved={() => { setShowTransfer(false); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
export default AccountsPage;
