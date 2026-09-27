import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle, Calendar, CheckCircle2, Loader2,
  Pencil, PiggyBank, Plus, Target, Trash2, X
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { api, ApiError } from '@/services/api';
import type { SavingsGoal } from '@/types';
import { cn, formatCompactRupiah, formatIndonesianDate, formatRupiah } from '@/utils/formatters';
import confetti from 'canvas-confetti';

const GOAL_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6', '#06B6D4'];

interface GoalFormProps {
  goal?: SavingsGoal | null;
  onClose: () => void;
  onSaved: () => void;
}

function GoalFormModal({ goal, onClose, onSaved }: GoalFormProps) {
  const [form, setForm] = useState({
    name: goal?.name ?? '',
    target_amount: String(goal?.target_amount ?? ''),
    current_amount: String(goal?.current_amount ?? '0'),
    target_date: goal?.target_date ?? '',
    color: goal?.color ?? GOAL_COLORS[0],
    notes: goal?.notes ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        target_amount: Number(form.target_amount),
        current_amount: Number(form.current_amount),
        target_date: form.target_date || null,
        icon: 'Target',
        color: form.color,
        notes: form.notes || null,
      };
      if (goal) await api.updateSavingsGoal(goal.id, payload);
      else await api.createSavingsGoal(payload);
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Gagal menyimpan target tabungan.');
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
          <h2 className="text-sm font-semibold text-fintech-text">{goal ? 'Edit Target Tabungan' : 'Buat Target Impian Baru'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-fintech-muted hover:text-fintech-text hover:bg-fintech-cardHover"><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 space-y-3.5">
          {/* Color accent */}
          <div>
            <label className="text-[11px] font-medium text-fintech-muted mb-1.5 block">Warna Aksen</label>
            <div className="flex gap-2">
              {GOAL_COLORS.map(c => (
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
            <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Nama Target</label>
            <input
              type="text"
              placeholder="cth. DP Rumah, Dana Darurat, Liburan"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="input-field text-xs"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Nominal Target (Rp)</label>
            <input
              type="number"
              placeholder="0"
              value={form.target_amount}
              onChange={e => set('target_amount', e.target.value)}
              className="input-field text-lg font-bold tabular-nums"
              min="1"
              required
            />
          </div>

          {!goal && (
            <div>
              <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Tabungan Awal (Rp)</label>
              <input
                type="number"
                placeholder="0"
                value={form.current_amount}
                onChange={e => set('current_amount', e.target.value)}
                className="input-field text-xs tabular-nums"
                min="0"
              />
            </div>
          )}

          <div>
            <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Tenggat Waktu (opsional)</label>
            <input
              type="date"
              value={form.target_date}
              onChange={e => set('target_date', e.target.value)}
              className="input-field text-xs"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Catatan Tambahan</label>
            <textarea
              placeholder="Catatan motivasi atau rencana menabung..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              className="input-field text-xs"
              rows={2}
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
              <span>{loading ? 'Menyimpan...' : goal ? 'Simpan Perubahan' : 'Buat Target'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  DEPOSIT MODAL
// ─────────────────────────────────────────────
function DepositModal({ goal, onClose, onSaved }: { goal: SavingsGoal; onClose: () => void; onSaved: () => void }) {
  const { accounts } = useApp();
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id ? String(accounts[0].id) : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) { setError('Masukkan nominal setoran valid.'); return; }
    setLoading(true);
    try {
      const res = await api.depositSavingsGoal(goal.id, {
        amount: Number(amount),
        account_id: accountId ? Number(accountId) : undefined,
      });

      if (res.is_completed) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Gagal melakukan setoran.');
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
        className="w-full sm:max-w-md card-clean bottom-sheet sm:rounded-2xl shadow-2xl p-4"
      >
        <div className="flex items-center justify-between pb-3 border-b border-fintech-border">
          <div>
            <h2 className="text-sm font-semibold text-fintech-text">Setor ke: {goal.name}</h2>
            <p className="text-[11px] text-fintech-muted">Tambah saldo tabungan impian Anda</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-fintech-muted hover:text-fintech-text"><X size={15} /></button>
        </div>

        <form onSubmit={handleDeposit} className="py-3 space-y-3.5">
          <div>
            <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Nominal Setoran (Rp)</label>
            <input
              type="number"
              placeholder="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="input-field text-lg font-bold tabular-nums"
              min="1"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Potong dari Dompet (opsional)</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)} className="input-field text-xs">
              <option value="">Jangan potong dompet</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({formatCompactRupiah(a.current_balance)})</option>)}
            </select>
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
              <span>{loading ? 'Menyetor...' : 'Konfirmasi Setoran'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  SAVINGS PAGE MAIN
// ─────────────────────────────────────────────
export default function SavingsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [summary, setSummary] = useState<{ total_target: number; total_collected: number; overall_percentage: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState<SavingsGoal | null>(null);
  const [depositGoal, setDepositGoal] = useState<SavingsGoal | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getSavingsGoals();
      setGoals(data.goals ?? []);
      setSummary(data.summary ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus target tabungan ini?')) return;
    try { await api.deleteSavingsGoal(id); load(); } catch {}
  };

  const pct = (g: SavingsGoal) => Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
  const remaining = (g: SavingsGoal) => Math.max(0, g.target_amount - g.current_amount);

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-fintech-muted">Target Tabungan</h2>
          <p className="text-xs text-fintech-text">{goals.length} target impian</p>
        </div>
        <button
          onClick={() => { setEditGoal(null); setShowForm(true); }}
          className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
        >
          <Plus size={14} />
          <span>Target Baru</span>
        </button>
      </div>

      {/* Aggregate Progress */}
      {summary && (
        <div className="card-clean p-4 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-fintech-muted">Total Tabungan Terkumpul</span>
            <span className="font-bold tabular-nums text-emerald-400">
              {formatRupiah(summary.total_collected)}
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill bg-emerald-500"
              style={{ width: `${Math.min(summary.overall_percentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-fintech-muted tabular-nums">
            <span>{summary.overall_percentage.toFixed(0)}% dari target</span>
            <span>Target Total: {formatCompactRupiah(summary.total_target)}</span>
          </div>
        </div>
      )}

      {/* Goal Cards */}
      {loading ? (
        <div className="space-y-2.5">
          {[1, 2].map(i => <div key={i} className="h-32 shimmer rounded-xl" />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="py-14 text-center card-clean">
          <PiggyBank size={28} className="mx-auto mb-2 text-fintech-muted/40" />
          <p className="text-xs font-medium text-fintech-text">Belum ada target tabungan</p>
          <p className="text-[11px] text-fintech-muted mt-0.5">Rencanakan tujuan masa depan Anda mulai hari ini.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary text-xs mt-3">
            Buat Target Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {goals.map((g) => {
            const progress = pct(g);
            const done = g.is_completed;
            return (
              <div
                key={g.id}
                className="card-clean p-4 relative group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: g.color || '#2563EB' }}
                    >
                      <Target size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-semibold text-fintech-text">{g.name}</h3>
                        {done && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-medium">
                            Tercapai
                          </span>
                        )}
                      </div>
                      {g.target_date && (
                        <p className="text-[10px] text-fintech-muted flex items-center gap-1 mt-0.5">
                          <Calendar size={10} />
                          <span>Target: {formatIndonesianDate(g.target_date)}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditGoal(g); setShowForm(true); }}
                      className="w-6 h-6 rounded flex items-center justify-center text-fintech-muted hover:text-fintech-text hover:bg-fintech-cardHover"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(g.id)}
                      className="w-6 h-6 rounded flex items-center justify-center text-fintech-muted hover:text-rose-400 hover:bg-rose-500/10"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 mb-3">
                  <div className="flex justify-between text-[11px] tabular-nums">
                    <span className="font-semibold text-white">{formatRupiah(g.current_amount)}</span>
                    <span className="text-fintech-muted">dari {formatRupiah(g.target_amount)}</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: done ? '#10B981' : (g.color || '#2563EB')
                      }}
                    />
                  </div>
                  {!done && (
                    <p className="text-[10px] text-fintech-muted">
                      Tersisa {formatCompactRupiah(remaining(g))} ({progress}%)
                    </p>
                  )}
                </div>

                {!done && (
                  <button
                    onClick={() => setDepositGoal(g)}
                    className="w-full btn-secondary text-xs py-1.5 flex items-center justify-center gap-1.5"
                  >
                    <Plus size={13} />
                    <span>Setor Tabungan</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showForm && (
          <GoalFormModal
            key="goal-form"
            goal={editGoal}
            onClose={() => { setShowForm(false); setEditGoal(null); }}
            onSaved={() => { setShowForm(false); setEditGoal(null); load(); }}
          />
        )}
        {depositGoal && (
          <DepositModal
            key="deposit"
            goal={depositGoal}
            onClose={() => setDepositGoal(null)}
            onSaved={() => { setDepositGoal(null); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
