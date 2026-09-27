import { motion } from 'framer-motion';
import {
  BarChart3, FileSpreadsheet, FileText,
  Loader2, TrendingDown, TrendingUp
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { api } from '@/services/api';
import { cn, formatCompactRupiah, formatRupiah } from '@/utils/formatters';

const PIE_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6', '#06B6D4', '#EC4899', '#64748B'];

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const today = new Date();
  const [range, setRange] = useState({
    start: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0],
    end: today.toISOString().split('T')[0],
  });
  const [exportLoading, setExportLoading] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getReports(range.start, range.end);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const handleExportPDF = async () => {
    setExportLoading('pdf');
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text('Laporan Keuangan - EarnVoice', 14, 20);
      doc.setFontSize(10);
      doc.text(`Periode: ${range.start} s.d. ${range.end}`, 14, 28);

      if (data?.summary) {
        doc.setFontSize(12);
        doc.text('Ringkasan Arus Kas', 14, 40);
        autoTable(doc, {
          startY: 45,
          head: [['Keterangan', 'Jumlah']],
          body: [
            ['Total Pemasukan', formatRupiah(data.summary.total_income)],
            ['Total Pengeluaran', formatRupiah(data.summary.total_expense)],
            ['Selisih (Net)', formatRupiah(data.summary.net)],
          ],
          styles: { fontSize: 10 },
        });
      }

      if (data?.transactions?.length > 0) {
        const lastY = (doc as any).lastAutoTable?.finalY ?? 90;
        doc.setFontSize(12);
        doc.text('Daftar Transaksi', 14, lastY + 12);
        autoTable(doc, {
          startY: lastY + 17,
          head: [['Tanggal', 'Jenis', 'Kategori', 'Akun', 'Nominal', 'Deskripsi']],
          body: data.transactions.map((t: any) => [
            t.transaction_date,
            t.type === 'income' ? 'Masuk' : t.type === 'expense' ? 'Keluar' : 'Transfer',
            t.category?.name ?? '-',
            t.account?.name ?? '-',
            formatRupiah(t.amount),
            t.description || '-',
          ]),
          styles: { fontSize: 9 },
        });
      }

      doc.save(`EarnVoice_Laporan_${range.start}_${range.end}.pdf`);
    } catch (e) {
      alert('Gagal mengekspor PDF.');
    } finally {
      setExportLoading('');
    }
  };

  const handleExportXLSX = async () => {
    setExportLoading('xlsx');
    try {
      const { utils, writeFile } = await import('xlsx');
      const wb = utils.book_new();

      if (data?.summary) {
        const sumData = [
          ['Keterangan', 'Nilai'],
          ['Total Pemasukan', data.summary.total_income],
          ['Total Pengeluaran', data.summary.total_expense],
          ['Selisih Bersih (Net)', data.summary.net],
        ];
        const wsSummary = utils.aoa_to_sheet(sumData);
        utils.book_append_sheet(wb, wsSummary, 'Ringkasan');
      }

      if (data?.transactions?.length > 0) {
        const txRows = data.transactions.map((t: any) => ({
          'ID': t.id,
          'Tanggal': t.transaction_date,
          'Jenis': t.type,
          'Kategori': t.category?.name ?? '',
          'Akun': t.account?.name ?? '',
          'Nominal (Rp)': t.amount,
          'Deskripsi': t.description ?? '',
        }));
        const wsTx = utils.json_to_sheet(txRows);
        utils.book_append_sheet(wb, wsTx, 'Transaksi');
      }

      writeFile(wb, `EarnVoice_${range.start}_${range.end}.xlsx`);
    } catch (e) {
      alert('Gagal mengekspor Excel.');
    } finally {
      setExportLoading('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Export Tools */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-fintech-muted">Laporan Keuangan</h2>
          <p className="text-xs text-fintech-text">Statistik arus kas dan analisis kategori</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportXLSX}
            disabled={!!exportLoading}
            className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
          >
            {exportLoading === 'xlsx' ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
            <span>Ekspor Excel</span>
          </button>
          <button
            onClick={handleExportPDF}
            disabled={!!exportLoading}
            className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
          >
            {exportLoading === 'pdf' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
            <span>Ekspor PDF</span>
          </button>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="card-clean p-3.5 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="text-[10px] font-medium text-fintech-muted uppercase tracking-wider mb-1 block">Dari Tanggal</label>
          <input
            type="date"
            value={range.start}
            onChange={e => setRange(r => ({ ...r, start: e.target.value }))}
            className="input-field text-xs"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] font-medium text-fintech-muted uppercase tracking-wider mb-1 block">Sampai Tanggal</label>
          <input
            type="date"
            value={range.end}
            onChange={e => setRange(r => ({ ...r, end: e.target.value }))}
            className="input-field text-xs"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-20 shimmer rounded-xl" />
          <div className="h-56 shimmer rounded-xl" />
        </div>
      ) : !data ? (
        <div className="py-14 text-center card-clean">
          <BarChart3 size={28} className="mx-auto mb-2 text-fintech-muted/40" />
          <p className="text-xs font-medium text-fintech-text">Tidak ada data untuk rentang tanggal ini</p>
        </div>
      ) : (
        <>
          {/* Summary Metric Cards */}
          {data.summary && (
            <div className="grid grid-cols-3 gap-2.5">
              <div className="card-clean p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp size={13} className="text-emerald-400" />
                  <span className="text-[10px] text-fintech-muted uppercase font-medium">Pemasukan</span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-emerald-400 tabular-nums">
                  {formatCompactRupiah(data.summary.total_income)}
                </p>
              </div>

              <div className="card-clean p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingDown size={13} className="text-rose-400" />
                  <span className="text-[10px] text-fintech-muted uppercase font-medium">Pengeluaran</span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-rose-400 tabular-nums">
                  {formatCompactRupiah(data.summary.total_expense)}
                </p>
              </div>

              <div className="card-clean p-3.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] text-fintech-muted uppercase font-medium">Arus Kas Bersih</span>
                </div>
                <p className={cn(
                  'text-xs sm:text-sm font-bold tabular-nums',
                  data.summary.net >= 0 ? 'text-emerald-400' : 'text-rose-400'
                )}>
                  {formatCompactRupiah(data.summary.net)}
                </p>
              </div>
            </div>
          )}

          {/* Bar Chart: Cashflow Breakdown */}
          {data.monthly_data?.length > 0 && (
            <div className="card-clean p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-fintech-muted mb-3">Tren Periode</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.monthly_data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" stroke="#1E2638" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={v => formatCompactRupiah(v).replace('Rp ', '')} />
                  <Tooltip
                    contentStyle={{ background: '#101522', border: '1px solid #1E2638', borderRadius: 10, fontSize: 11 }}
                    formatter={(val: any) => [formatRupiah(val)]}
                  />
                  <Legend formatter={v => (v === 'income' ? 'Pemasukan' : 'Pengeluaran')} />
                  <Bar dataKey="income" fill="#10B981" radius={[3, 3, 0, 0]} name="income" />
                  <Bar dataKey="expense" fill="#F43F5E" radius={[3, 3, 0, 0]} name="expense" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Category Breakdown */}
          {data.expense_by_category?.length > 0 && (
            <div className="card-clean p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-fintech-muted mb-3">Sebaran Pengeluaran per Kategori</h3>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <ResponsiveContainer width={180} height={160}>
                  <PieChart>
                    <Pie
                      data={data.expense_by_category}
                      dataKey="total"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={68}
                      paddingAngle={3}
                    >
                      {data.expense_by_category.map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [formatRupiah(val)]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5 w-full">
                  {data.expense_by_category.slice(0, 6).map((c: any, i: number) => (
                    <div key={c.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="truncate text-fintech-text">{c.name}</span>
                      </div>
                      <span className="font-semibold tabular-nums text-fintech-muted shrink-0 ml-2">{formatCompactRupiah(c.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
