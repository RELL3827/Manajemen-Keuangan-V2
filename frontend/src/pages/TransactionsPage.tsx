import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle, ArrowDownRight, ArrowLeftRight, ArrowUpRight,
  CheckCircle2, ChevronLeft, ChevronRight,
  Clock, Loader2, Mic, MicOff, RefreshCw, Repeat2, Search,
  SlidersHorizontal, Trash2, X
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { api, ApiError } from '@/services/api';
import { useSpeechRecognition } from '@/services/speechRecognition';
import { parseVoiceText } from '@/services/voiceParser';
import type { Transaction, VoiceParsedResult } from '@/types';
import { cn, formatCompactRupiah, formatIndonesianDate, formatRupiah } from '@/utils/formatters';

// ─────────────────────────────────────────────
//  TRANSACTION FORM MODAL (Manual)
// ─────────────────────────────────────────────
interface FormModalProps {
  onClose: () => void;
  onSaved: () => void;
  prefill?: Partial<VoiceParsedResult>;
  editTx?: Transaction | null;
}

function TransactionFormModal({ onClose, onSaved, prefill, editTx }: FormModalProps) {
  const { accounts, categories } = useApp();
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    type: editTx?.type ?? prefill?.type ?? 'expense',
    account_id: String(editTx?.account_id ?? prefill?.account_id ?? accounts[0]?.id ?? ''),
    to_account_id: String(editTx?.to_account_id ?? prefill?.to_account_id ?? ''),
    category_id: String(editTx?.category_id ?? prefill?.category_id ?? ''),
    amount: String(editTx?.amount ?? prefill?.amount ?? ''),
    description: editTx?.description ?? prefill?.description ?? '',
    transaction_date: editTx?.transaction_date ?? today,
    input_method: editTx?.input_method ?? (prefill ? 'voice' : 'manual'),
    voice_text: editTx?.voice_text ?? '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const filteredCategories = categories.filter(c => c.type === 'both' || c.type === form.type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.amount || Number(form.amount) <= 0) { setError('Nominal harus lebih dari 0.'); return; }
    if (!form.account_id) { setError('Pilih dompet/rekening sumber.'); return; }
    setLoading(true);

    try {
      const payload: any = {
        type: form.type,
        account_id: Number(form.account_id),
        category_id: form.category_id ? Number(form.category_id) : null,
        amount: Number(form.amount),
        description: form.description,
        transaction_date: form.transaction_date,
        input_method: form.input_method,
        voice_text: form.voice_text || null,
      };
      if (form.type === 'transfer' && form.to_account_id) {
        payload.to_account_id = Number(form.to_account_id);
      }

      if (editTx) {
        await api.updateTransaction(editTx.id, payload);
      } else {
        await api.createTransaction(payload);
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Gagal menyimpan transaksi.');
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
          <div>
            <h2 className="text-sm font-semibold text-fintech-text">{editTx ? 'Edit Transaksi' : 'Catat Transaksi'}</h2>
            <p className="text-[11px] text-fintech-muted">Masukkan detail transaksi finansial</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-fintech-muted hover:text-fintech-text hover:bg-fintech-cardHover transition-colors">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 space-y-3.5">
          {/* Type selector */}
          <div className="flex p-0.5 bg-fintech-bg rounded-xl border border-fintech-border">
            {(['expense', 'income', 'transfer'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => set('type', t)}
                className={cn(
                  'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all text-center',
                  form.type === t
                    ? t === 'expense'
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20 shadow-sm'
                      : t === 'income'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                      : 'bg-blue-500/15 text-blue-400 border border-blue-500/20 shadow-sm'
                    : 'text-fintech-muted hover:text-fintech-text'
                )}
              >
                {t === 'expense' ? 'Pengeluaran' : t === 'income' ? 'Pemasukan' : 'Transfer'}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Nominal (Rp)</label>
            <input
              type="number"
              placeholder="0"
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
              className="input-field text-xl font-bold tracking-tight tabular-nums"
              min={1}
              required
            />
          </div>

          {/* Account */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-fintech-muted mb-1 block">
                {form.type === 'transfer' ? 'Dari Akun' : 'Dompet / Rekening'}
              </label>
              <select value={form.account_id} onChange={e => set('account_id', e.target.value)} className="input-field text-xs" required>
                <option value="">Pilih dompet</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({formatCompactRupiah(a.current_balance)})</option>
                ))}
              </select>
            </div>

            {/* To Account (transfer only) */}
            {form.type === 'transfer' && (
              <div>
                <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Ke Akun</label>
                <select value={form.to_account_id} onChange={e => set('to_account_id', e.target.value)} className="input-field text-xs" required>
                  <option value="">Pilih tujuan</option>
                  {accounts.filter(a => String(a.id) !== form.account_id).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Category (income / expense) */}
            {form.type !== 'transfer' && (
              <div>
                <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Kategori</label>
                <select value={form.category_id} onChange={e => set('category_id', e.target.value)} className="input-field text-xs">
                  <option value="">Pilih kategori</option>
                  {filteredCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Deskripsi / Catatan</label>
            <input
              type="text"
              placeholder="cth. Makan siang nasi padang"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              className="input-field text-xs"
            />
          </div>

          {/* Date */}
          <div>
            <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Tanggal</label>
            <input
              type="date"
              value={form.transaction_date}
              onChange={e => set('transaction_date', e.target.value)}
              className="input-field text-xs"
              required
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 text-rose-400 text-xs">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-2.5 text-xs flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>{loading ? 'Menyimpan...' : editTx ? 'Perbarui Transaksi' : 'Simpan Transaksi'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  VOICE INPUT MODAL (Clean Dictation Experience)
// ─────────────────────────────────────────────
interface VoiceModalProps {
  onClose: () => void;
  onParsed: (result: VoiceParsedResult) => void;
  accounts: ReturnType<typeof useApp>['accounts'];
  categories: ReturnType<typeof useApp>['categories'];
}

function VoiceModal({ onClose, onParsed, accounts, categories }: VoiceModalProps) {
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [parsed, setParsed] = useState<VoiceParsedResult | null>(null);

  const { isSupported, isListening, startListening, stopListening } = useSpeechRecognition({
    onResult: (text: string) => {
      setTranscript(text);
      setStatus('processing');
    },
    onError: (err: string) => {
      setError(err);
      setStatus('error');
    },
  });

  useEffect(() => {
    if (status === 'processing' && transcript) {
      const result = parseVoiceText(transcript, accounts, categories);
      setParsed(result);
      setStatus('done');
    }
  }, [status, transcript, accounts, categories]);

  const handleStart = () => {
    setTranscript('');
    setParsed(null);
    setError('');
    setStatus('listening');
    startListening();
  };

  const handleStop = () => {
    stopListening();
  };

  const handleConfirm = () => {
    if (parsed) onParsed(parsed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 modal-overlay animate-fade-in" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="w-full sm:max-w-md card-clean bottom-sheet sm:rounded-2xl overflow-hidden shadow-2xl p-6"
      >
        <div className="flex items-center justify-between pb-4 border-b border-fintech-border">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-fintech-text">Pencatatan Suara</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-fintech-muted hover:text-fintech-text hover:bg-fintech-cardHover">
            <X size={15} />
          </button>
        </div>

        <div className="py-6 space-y-6 flex flex-col items-center">
          {/* Sleek Mic Action Button */}
          <div className="relative flex items-center justify-center">
            <button
              onClick={isListening ? handleStop : handleStart}
              disabled={!isSupported || status === 'processing'}
              className={cn(
                'w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-md',
                isListening
                  ? 'bg-rose-600 text-white mic-recording ring-4 ring-rose-500/20'
                  : 'bg-blue-600 text-white hover:bg-blue-500',
                (!isSupported || status === 'processing') && 'opacity-50 cursor-not-allowed'
              )}
            >
              {status === 'processing' ? (
                <Loader2 size={28} className="animate-spin" />
              ) : isListening ? (
                <MicOff size={28} />
              ) : (
                <Mic size={28} />
              )}
            </button>
          </div>

          {/* Acoustic Waveform */}
          {isListening && (
            <div className="flex items-center gap-1.5 h-8">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="wave-bar" />
              ))}
            </div>
          )}

          {/* Instructions / State */}
          <div className="text-center space-y-1">
            <p className="text-xs font-medium text-fintech-text">
              {!isSupported
                ? 'Browser tidak mendukung rekaman Web Speech'
                : status === 'idle'
                ? 'Tekan tombol mikrofon lalu bicaralah'
                : status === 'listening'
                ? 'Mendengarkan ucapan Anda...'
                : status === 'processing'
                ? 'Memproses analisis suara...'
                : status === 'error'
                ? 'Gagal menangkap suara'
                : 'Transaksi berhasil dianalisis!'}
            </p>
            {status === 'idle' && (
              <p className="text-[11px] text-fintech-muted italic">
                Contoh: "Beli makan siang 25 ribu dari dompet cash"
              </p>
            )}
            {error && (
              <p className="text-xs text-rose-400 mt-1">{error}</p>
            )}
          </div>

          {/* Real-time transcript preview */}
          {transcript && (
            <div className="w-full p-3 rounded-xl bg-fintech-bg border border-fintech-border text-left">
              <p className="text-[10px] uppercase font-semibold text-fintech-muted tracking-wider mb-1">Hasil Suara</p>
              <p className="text-xs text-fintech-text italic">"{transcript}"</p>
            </div>
          )}

          {/* Parsed Result Breakdown */}
          {parsed && status === 'done' && (
            <div className="w-full space-y-3 pt-2">
              <div className="p-3.5 rounded-xl bg-fintech-bg border border-fintech-border space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-fintech-muted">Tipe Transaksi</span>
                  <span className={cn(
                    'px-2 py-0.5 rounded-md text-[11px] font-semibold border',
                    parsed.type === 'income'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  )}>
                    {parsed.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-fintech-muted">Nominal</span>
                  <span className="font-bold text-fintech-text tabular-nums text-sm">
                    {formatRupiah(parsed.amount || 0)}
                  </span>
                </div>

                {parsed.category && (
                  <div className="flex justify-between items-center">
                    <span className="text-fintech-muted">Kategori</span>
                    <span className="font-medium text-fintech-text">{parsed.category.name}</span>
                  </div>
                )}

                {parsed.description && (
                  <div className="flex justify-between items-center">
                    <span className="text-fintech-muted">Deskripsi</span>
                    <span className="text-fintech-text truncate max-w-[200px]">{parsed.description}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleStart}
                  className="btn-secondary text-xs flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={13} />
                  <span>Ulangi</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="btn-primary text-xs flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={13} />
                  <span>Gunakan Data</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  TRANSACTIONS PAGE MAIN
// ─────────────────────────────────────────────
interface TransactionsPageProps {
  openVoice: boolean;
  openForm: boolean;
  onCloseVoice: () => void;
  onCloseForm: () => void;
}

export default function TransactionsPage({ openVoice, openForm, onCloseVoice, onCloseForm }: TransactionsPageProps) {
  const { accounts, categories } = useApp();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [filters, setFilters] = useState({
    search: '', type: '', account_id: '', category_id: '',
    start_date: '', end_date: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [voicePrefill, setVoicePrefill] = useState<Partial<VoiceParsedResult> | undefined>();
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params: any = { page: p, per_page: 20 };
      if (filters.search) params.search = filters.search;
      if (filters.type) params.type = filters.type;
      if (filters.account_id) params.account_id = filters.account_id;
      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      const data = await api.getTransactions(params);
      setTransactions(data.data);
      setLastPage(data.last_page);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { setPage(1); load(1); }, [filters, load]);
  useEffect(() => { if (page > 1) load(page); }, [page, load]);

  useEffect(() => {
    const handleUpdate = () => { load(1); };
    window.addEventListener('earnvoice_offline_tx_added', handleUpdate);
    window.addEventListener('earnvoice_offline_tx_synced', handleUpdate);
    return () => {
      window.removeEventListener('earnvoice_offline_tx_added', handleUpdate);
      window.removeEventListener('earnvoice_offline_tx_synced', handleUpdate);
    };
  }, [load]);

  useEffect(() => { if (openForm) { setVoicePrefill(undefined); setEditTx(null); setShowForm(true); } }, [openForm]);
  useEffect(() => { if (!openForm) setShowForm(false); }, [openForm]);

  const handleVoiceParsed = (result: VoiceParsedResult) => {
    setVoicePrefill(result);
    onCloseVoice();
    setShowForm(true);
  };

  const handleSaved = () => {
    setShowForm(false);
    onCloseForm();
    setEditTx(null);
    setVoicePrefill(undefined);
    load(1);
  };

  const handleDelete = async (id: number | string) => {
    if (!confirm('Hapus transaksi ini?')) return;
    try {
      await api.deleteTransaction(id);
      load(page);
    } catch {}
  };

  return (
    <div className="space-y-4">
      {/* Top Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fintech-muted" />
          <input
            type="text"
            placeholder="Cari transaksi berdasarkan catatan..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="input-field pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors shrink-0',
              showFilters
                ? 'bg-blue-600/10 border-blue-500/20 text-blue-400'
                : 'border-fintech-border text-fintech-muted hover:text-fintech-text'
            )}
          >
            <SlidersHorizontal size={13} />
            <span>Filter</span>
          </button>

          <button
            onClick={() => { setVoicePrefill(undefined); setEditTx(null); setShowForm(true); }}
            className="btn-primary text-xs flex items-center gap-1.5 py-2 px-3.5 shrink-0"
          >
            <span>+ Catat Baru</span>
          </button>
        </div>
      </div>

      {/* Filter Drawer */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 card-clean space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-[10px] font-medium text-fintech-muted uppercase tracking-wider mb-1 block">Tipe</label>
                  <select className="input-field text-xs" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
                    <option value="">Semua Tipe</option>
                    <option value="income">Pemasukan</option>
                    <option value="expense">Pengeluaran</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-fintech-muted uppercase tracking-wider mb-1 block">Dompet</label>
                  <select className="input-field text-xs" value={filters.account_id} onChange={e => setFilters(f => ({ ...f, account_id: e.target.value }))}>
                    <option value="">Semua Dompet</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-fintech-muted uppercase tracking-wider mb-1 block">Dari</label>
                  <input type="date" className="input-field text-xs" value={filters.start_date} onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-fintech-muted uppercase tracking-wider mb-1 block">Sampai</label>
                  <input type="date" className="input-field text-xs" value={filters.end_date} onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setFilters({ search: '', type: '', account_id: '', category_id: '', start_date: '', end_date: '' })}
                  className="text-xs text-fintech-muted hover:text-rose-400 transition-colors"
                >
                  Reset Filter
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 shimmer rounded-xl" />)}
        </div>
      ) : transactions.length === 0 ? (
        <div className="py-14 text-center card-clean">
          <Clock size={28} className="mx-auto mb-2 text-fintech-muted/40" />
          <p className="text-xs font-medium text-fintech-text">Tidak ada data transaksi</p>
          <p className="text-[11px] text-fintech-muted mt-0.5">Silakan sesuaikan filter atau tambahkan transaksi baru.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              onClick={() => { setEditTx(tx); setVoicePrefill(undefined); setShowForm(true); }}
              className="flex items-center gap-3 p-3 card-clean card-hover cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-fintech-bg border border-fintech-border/80 flex items-center justify-center shrink-0">
                {tx.type === 'income' ? (
                  <ArrowUpRight size={15} className="text-emerald-400" />
                ) : tx.type === 'expense' ? (
                  <ArrowDownRight size={15} className="text-rose-400" />
                ) : (
                  <Repeat2 size={15} className="text-blue-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-fintech-text truncate">
                    {tx.description || tx.category?.name || 'Transaksi'}
                  </p>
                  {tx.synced === false && (
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full shrink-0" title="Offline pending" />
                  )}
                </div>
                <p className="text-[10px] text-fintech-muted mt-0.5">
                  {tx.category?.name ? `${tx.category.name} · ` : ''}{tx.account?.name} · {formatIndonesianDate(tx.transaction_date)}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <p className={cn(
                  'text-xs font-bold tabular-nums',
                  tx.type === 'income' ? 'text-emerald-400' : tx.type === 'expense' ? 'text-rose-400' : 'text-blue-400'
                )}>
                  {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                  {formatCompactRupiah(tx.amount)}
                </p>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(tx.id); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-500/10 text-fintech-muted hover:text-rose-400 transition-all"
                  title="Hapus"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-8 h-8 rounded-lg border border-fintech-border flex items-center justify-center disabled:opacity-30 hover:bg-fintech-cardHover transition-colors text-fintech-muted"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-fintech-muted font-medium px-2">{page} / {lastPage}</span>
          <button
            onClick={() => setPage(p => Math.min(lastPage, p + 1))}
            disabled={page === lastPage}
            className="w-8 h-8 rounded-lg border border-fintech-border flex items-center justify-center disabled:opacity-30 hover:bg-fintech-cardHover transition-colors text-fintech-muted"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {openVoice && (
          <VoiceModal
            key="voice"
            onClose={onCloseVoice}
            onParsed={handleVoiceParsed}
            accounts={accounts}
            categories={categories}
          />
        )}
        {showForm && (
          <TransactionFormModal
            key="form"
            onClose={() => { setShowForm(false); onCloseForm(); setEditTx(null); }}
            onSaved={handleSaved}
            prefill={voicePrefill}
            editTx={editTx}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
