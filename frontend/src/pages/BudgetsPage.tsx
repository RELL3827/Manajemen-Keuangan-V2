import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle, ChevronLeft, ChevronRight,
  Loader2, PieChart, Plus, Trash2, X
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { api, ApiError } from '@/services/api';
import type { Budget } from '@/types';
import { cn, formatCompactRupiah, formatRupiah, getMonthName } from '@/utils/formatters';

interface BudgetFormProps {
  budget?: Budget | null;
  onClose: () => void;
  onSaved: () => void;
  currentMonth: string;
}

function BudgetFormModal({ budget, onClose, onSaved, currentMonth }: BudgetFormProps) {
  const { categories } = useApp();
  const expenseCategories = categories.filter(c => c.type === 'expense' || c.type === 'both');

  const [form, setForm] = useState({
    category_id: String(budget?.category_id ?? ''),
    amount: String(budget?.amount ?? ''),
    month: currentMonth,
    alert_threshold: String(budget?.alert_threshold ?? '80'),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        category_id: Number(form.category_id),
        amount: Number(form.amount),
        month: form.month,
        alert_threshold: Number(form.alert_threshold),
      };
      if (budget) {
        await api.updateBudget(budget.id, { amount: payload.amount, alert_threshold: payload.alert_threshold });
      } else {
        await api.saveBudget(payload);
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Gagal menyimpan anggaran.');
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
          <h2 className="text-sm font-semibold text-fintech-text">{budget ? 'Edit Alokasi Anggaran' : 'Tetapkan Anggaran Baru'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-fintech-muted hover:text-fintech-text hover:bg-fintech-cardHover"><X size={15} /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 space-y-3.5">
          {!budget && (
            <div>
              <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Kategori Pengeluaran</label>
              <select value={form.category_id} onChange={e => set('category_id', e.target.value)} className="input-field text-xs" required>
                <option value="">Pilih kategori</option>
                {expenseCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Batas Maksimal Anggaran (Rp)</label>
            <input
              type="number"
              placeholder="0"
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
              className="input-field text-lg font-bold tabular-nums"
              min={1}
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Ambang Peringatan ({form.alert_threshold}%)</label>
            <input
              type="range"
              value={form.alert_threshold}
              onChange={e => set('alert_threshold', e.target.value)}
              className="w-full accent-blue-600"
              min={50}
              max={100}
            />
            <p className="text-[10px] text-fintech-muted mt-1">Notifikasi dikirim saat pemakaian mencapai {form.alert_threshold}%</p>
          </div>

          {!budget && (
            <div>
              <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Bulan Berlaku</label>
              <input type="month" value={form.month} onChange={e => set('month', e.target.value)} className="input-field text-xs" required />
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
              <span>{loading ? 'Menyimpan...' : budget ? 'Perbarui Anggaran' : 'Pasang Anggaran'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  BUDGETS PAGE MAIN
// ─────────────────────────────────────────────
export default function BudgetsPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [summary, setSummary] = useState<{ total_budget: number; total_spent: number; total_remaining: number; overall_percentage: number } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBudgets(month);
      setBudgets(data.budgets ?? []);
      setSummary(data.summary ?? null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const navigateMonth = (dir: -1 | 1) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus anggaran kategori ini?')) return;
    try { await api.deleteBudget(id); load(); } catch {}
  };

  const warnBadge = (level?: string) => {
    if (level === 'danger') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    if (level === 'warning') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  };

  const warnLabel = (level?: string) => {
    if (level === 'danger') return 'Melampaui';
    if (level === 'warning') return 'Waspada';
    return 'Terkendali';
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-fintech-muted">Alokasi Anggaran</h2>
          <p className="text-xs text-fintech-text">{budgets.length} pos anggaran aktif</p>
        </div>
        <button
          onClick={() => { setEditBudget(null); setShowForm(true); }}
          className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
        >
          <Plus size={14} />
          <span>Pasang Anggaran</span>
        </button>
      </div>

      {/* Month Navigator */}
      <div className="card-clean p-3 flex items-center justify-between">
        <button
          onClick={() => navigateMonth(-1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-fintech-muted hover:text-fintech-text hover:bg-fintech-cardHover transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <p className="font-semibold text-xs text-fintech-text">{getMonthName(month)}</p>
          {summary && (
            <p className="text-[11px] text-fintech-muted tabular-nums mt-0.5">
              Terpakai: {formatCompactRupiah(summary.total_spent)} dari {formatCompactRupiah(summary.total_budget)}
            </p>
          )}
        </div>
        <button
          onClick={() => navigateMonth(1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-fintech-muted hover:text-fintech-text hover:bg-fintech-cardHover transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Overall Progress Summary */}
      {summary && (
        <div className="card-clean p-4 space-y-2.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-fintech-muted">Total Realisasi Anggaran</span>
            <span className="font-bold tabular-nums text-fintech-text">{summary.overall_percentage.toFixed(0)}%</span>
          </div>
          <div className="progress-bar">
            <div
              className={cn(
                'progress-fill',
                summary.overall_percentage >= 100 ? 'budget-danger' : summary.overall_percentage >= 80 ? 'budget-warning' : 'budget-safe'
              )}
              style={{ width: `${Math.min(summary.overall_percentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-fintech-muted tabular-nums">
            <span>Sisa: {formatCompactRupiah(summary.total_remaining)}</span>
            <span>Total: {formatRupiah(summary.total_budget)}</span>
          </div>
        </div>
      )}

      {/* Budget List */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => <div key={i} className="h-24 shimmer rounded-xl" />)}
        </div>
      ) : budgets.length === 0 ? (
        <div className="py-14 text-center card-clean">
          <PieChart size={28} className="mx-auto mb-2 text-fintech-muted/40" />
          <p className="text-xs font-medium text-fintech-text">Belum ada anggaran untuk bulan ini</p>
          <button onClick={() => setShowForm(true)} className="btn-primary text-xs mt-3">
            Tetapkan Anggaran
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {budgets.map((b) => (
            <div
              key={b.id}
              className="card-clean p-3.5 card-hover cursor-pointer group"
              onClick={() => { setEditBudget(b); setShowForm(true); }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-fintech-text">{b.category?.name}</span>
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.2 rounded border', warnBadge(b.warning_level))}>
                    {warnLabel(b.warning_level)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold tabular-nums text-fintech-text">{b.percentage.toFixed(0)}%</span>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(b.id); }}
                    className="w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 text-fintech-muted hover:text-rose-400 hover:bg-rose-500/10"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="progress-bar mb-2">
                <div
                  className={cn(
                    'progress-fill',
                    b.warning_level === 'danger' ? 'budget-danger' : b.warning_level === 'warning' ? 'budget-warning' : 'budget-safe'
                  )}
                  style={{ width: `${Math.min(b.percentage, 100)}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-fintech-muted tabular-nums">
                <span className={b.warning_level === 'danger' ? 'text-rose-400 font-semibold' : ''}>
                  {formatCompactRupiah(b.spent)} terpakai
                </span>
                <span>Sisa {formatCompactRupiah(b.remaining)} dari {formatCompactRupiah(b.amount)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showForm && (
          <BudgetFormModal
            key="budget-form"
            budget={editBudget}
            currentMonth={month}
            onClose={() => { setShowForm(false); setEditBudget(null); }}
            onSaved={() => { setShowForm(false); setEditBudget(null); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
