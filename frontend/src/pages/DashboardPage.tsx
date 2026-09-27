import { motion } from 'framer-motion';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight,
  ChevronRight, Eye, EyeOff, Lightbulb,
  Mic, Plus, RefreshCw, Repeat2,
  TrendingDown, TrendingUp, Wallet
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '@/contexts/AppContext';
import { api } from '@/services/api';
import type { Budget, DashboardSummary, FinancialInsight, Transaction } from '@/types';
import { cn, formatCompactRupiah, formatIndonesianDate, formatRupiah } from '@/utils/formatters';

interface DashboardProps {
  onAddTransaction: () => void;
  onVoiceInput: () => void;
  onNavigate: (tab: string) => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-fintech-card border border-fintech-border rounded-xl p-3 shadow-fintech text-xs">
      <p className="text-fintech-muted mb-1.5 font-medium">{label}</p>
      {payload.map((e: any) => (
        <div key={e.name} className="flex items-center justify-between gap-4 py-0.5">
          <span className="text-fintech-muted flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: e.color }} />
            {e.name === 'income' ? 'Pemasukan' : 'Pengeluaran'}
          </span>
          <span className="font-semibold text-fintech-text tabular-nums">
            {formatRupiah(e.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function DashboardPage({ onAddTransaction, onVoiceInput, onNavigate }: DashboardProps) {
  const { user } = useApp();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [insights, setInsights] = useState<FinancialInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideBalance, setHideBalance] = useState(false);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDashboard(period);
      setSummary(data.summary);
      setChartData(data.chart_data || []);
      setTransactions(data.recent_transactions || []);
      setBudgets(data.budgets || []);
      setInsights(data.insights || []);
    } catch {
      // Handled via offline cache in api client
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const typeColor = (type: string) => ({
    income: 'text-emerald-400',
    expense: 'text-rose-400',
    transfer: 'text-blue-400',
  }[type] || 'text-fintech-muted');

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-44 shimmer rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 shimmer rounded-xl" />
          <div className="h-20 shimmer rounded-xl" />
        </div>
        <div className="h-56 shimmer rounded-2xl" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 shimmer rounded-xl" />)}
        </div>
      </div>
    );
  }

  const net = (summary?.total_income_month ?? 0) - (summary?.total_expense_month ?? 0);

  return (
    <div className="space-y-5 pb-6">
      {/* ── HERO BALANCE CARD ── */}
      <div className="balance-card-modern rounded-2xl p-6 relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Saldo Aktif</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">IDR</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setHideBalance(v => !v)}
              title={hideBalance ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            >
              {hideBalance ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
            <button
              onClick={load}
              title="Perbarui data"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Big Balance Number */}
        <div className="mb-4">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white tabular-nums">
            {hideBalance ? '••••••••' : formatRupiah(summary?.current_balance ?? 0)}
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <div className={cn(
              'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border',
              net >= 0
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            )}>
              {net >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{net >= 0 ? '+' : ''}{formatCompactRupiah(net)} bulan ini</span>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <ArrowUpRight size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-medium">Pemasukan</p>
              <p className="text-sm font-semibold text-white tabular-nums truncate">
                {hideBalance ? '••••' : formatCompactRupiah(summary?.total_income_month ?? 0)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <ArrowDownRight size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-medium">Pengeluaran</p>
              <p className="text-sm font-semibold text-white tabular-nums truncate">
                {hideBalance ? '••••' : formatCompactRupiah(summary?.total_expense_month ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onVoiceInput}
          className="flex items-center gap-3 p-3.5 card-clean card-hover text-left group"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
            <Mic size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-fintech-text group-hover:text-blue-400 transition-colors">Catat Suara</p>
            <p className="text-[11px] text-fintech-muted truncate">Cukup sebutkan transaksi</p>
          </div>
        </button>

        <button
          onClick={onAddTransaction}
          className="flex items-center gap-3 p-3.5 card-clean card-hover text-left group"
        >
          <div className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 flex items-center justify-center group-hover:border-slate-600 group-hover:text-white transition-all shrink-0">
            <Plus size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-fintech-text">Catat Manual</p>
            <p className="text-[11px] text-fintech-muted truncate">Input form lengkap</p>
          </div>
        </button>
      </div>

      {/* ── CASHFLOW CHART ── */}
      <div className="card-clean p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-xs text-fintech-text uppercase tracking-wider">Arus Kas</h3>
            <p className="text-[11px] text-fintech-muted">Perbandingan pemasukan dan pengeluaran</p>
          </div>
          <div className="flex gap-1 bg-fintech-bg/70 p-0.5 rounded-lg border border-fintech-border">
            {(['week', 'month', 'year'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all',
                  period === p
                    ? 'bg-fintech-card text-fintech-text shadow-sm'
                    : 'text-fintech-muted hover:text-fintech-text'
                )}
              >
                {p === 'week' ? 'Mingguan' : p === 'month' ? 'Bulanan' : 'Tahunan'}
              </button>
            ))}
          </div>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={175}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="income-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expense-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke="#1E2638" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={v => formatCompactRupiah(v).replace('Rp ', '')} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="income" stroke="#10B981" fill="url(#income-grad)" strokeWidth={1.8} dot={false} />
              <Area type="monotone" dataKey="expense" stroke="#F43F5E" fill="url(#expense-grad)" strokeWidth={1.8} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-40 flex items-center justify-center text-fintech-muted text-xs">
            Belum ada data arus kas untuk periode ini
          </div>
        )}

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-fintech-border/50 text-xs">
          <div className="flex items-center gap-1.5 text-fintech-muted">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Pemasukan</span>
          </div>
          <div className="flex items-center gap-1.5 text-fintech-muted">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Pengeluaran</span>
          </div>
        </div>
      </div>

      {/* ── FINANCIAL INSIGHTS ── */}
      {insights.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Lightbulb size={14} className="text-amber-400" />
            <h3 className="font-semibold text-xs text-fintech-text uppercase tracking-wider">Insight Finansial</h3>
          </div>
          <div className="space-y-2">
            {insights.slice(0, 3).map((ins, i) => (
              <div key={i} className="p-3.5 card-clean flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Lightbulb size={14} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-fintech-text">{ins.title}</p>
                  <p className="text-[11px] text-fintech-muted mt-0.5 leading-relaxed">{ins.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BUDGET ALERTS ── */}
      {budgets.filter(b => b.warning_level !== 'safe').length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-xs text-fintech-text uppercase tracking-wider">Peringatan Anggaran</h3>
            <button onClick={() => onNavigate('budgets')} className="text-xs text-blue-400 hover:underline flex items-center gap-0.5">
              Lihat semua <ChevronRight size={13} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {budgets.filter(b => b.warning_level !== 'safe').slice(0, 2).map(b => (
              <div key={b.id} className="p-3.5 card-clean">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-fintech-text">{b.category?.name}</span>
                  <span className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                    b.warning_level === 'danger'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  )}>
                    {b.percentage.toFixed(0)}%
                  </span>
                </div>
                <div className="progress-bar mb-2">
                  <div
                    className={cn('progress-fill', b.warning_level === 'danger' ? 'budget-danger' : 'budget-warning')}
                    style={{ width: `${Math.min(b.percentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-fintech-muted tabular-nums">
                  <span>{formatCompactRupiah(b.spent)}</span>
                  <span>dari {formatCompactRupiah(b.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RECENT TRANSACTIONS ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-xs text-fintech-text uppercase tracking-wider">Transaksi Terkini</h3>
          <button onClick={() => onNavigate('transactions')} className="text-xs text-blue-400 hover:underline flex items-center gap-0.5">
            Lihat semua <ChevronRight size={13} />
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 text-center card-clean">
            <Wallet size={28} className="mx-auto mb-2 text-fintech-muted/40" />
            <p className="text-xs font-medium text-fintech-text">Belum ada transaksi</p>
            <p className="text-[11px] text-fintech-muted mt-0.5">Gunakan tombol catat atau suara untuk memulai.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {transactions.slice(0, 6).map((tx) => (
              <div
                key={tx.id}
                onClick={() => onNavigate('transactions')}
                className="flex items-center gap-3 p-3 card-clean card-hover cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-fintech-bg border border-fintech-border/80 flex items-center justify-center text-xs shrink-0">
                  {tx.type === 'income' ? (
                    <ArrowUpRight size={15} className="text-emerald-400" />
                  ) : tx.type === 'expense' ? (
                    <ArrowDownRight size={15} className="text-rose-400" />
                  ) : (
                    <Repeat2 size={15} className="text-blue-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-fintech-text truncate">
                    {tx.description || tx.category?.name || 'Transaksi'}
                  </p>
                  <p className="text-[10px] text-fintech-muted mt-0.5">
                    {tx.category?.name ?? '-'} • {formatIndonesianDate(tx.transaction_date)}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className={cn('text-xs font-bold tabular-nums', typeColor(tx.type))}>
                    {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                    {formatCompactRupiah(tx.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
