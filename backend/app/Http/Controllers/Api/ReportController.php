<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Category;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    /**
     * Get detailed financial report for analytics and charts.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        if (! $startDate || ! $endDate) {
            $now = Carbon::now();
            $startDate = $now->copy()->startOfMonth()->format('Y-m-d');
            $endDate = $now->copy()->endOfMonth()->format('Y-m-d');
        }

        // Totals
        $totalIncome = Transaction::where('user_id', $user->id)
            ->where('type', 'income')
            ->whereBetween('transaction_date', [$startDate, $endDate])
            ->sum('amount');

        $totalExpense = Transaction::where('user_id', $user->id)
            ->where('type', 'expense')
            ->whereBetween('transaction_date', [$startDate, $endDate])
            ->sum('amount');

        $savingsBalance = Account::where('user_id', $user->id)
            ->where('type', 'savings')
            ->sum('current_balance');

        $investmentBalance = Account::where('user_id', $user->id)
            ->where('type', 'investment')
            ->sum('current_balance');

        // Expense by category breakdown
        $expenseByCategory = Transaction::where('transactions.user_id', $user->id)
            ->where('transactions.type', 'expense')
            ->whereBetween('transaction_date', [$startDate, $endDate])
            ->join('categories', 'transactions.category_id', '=', 'categories.id')
            ->select(
                'categories.id',
                'categories.name',
                'categories.icon',
                'categories.color',
                DB::raw('SUM(transactions.amount) as total'),
                DB::raw('COUNT(transactions.id) as count')
            )
            ->groupBy('categories.id', 'categories.name', 'categories.icon', 'categories.color')
            ->orderBy('total', 'desc')
            ->get()
            ->map(function ($row) use ($totalExpense) {
                return [
                    'id' => $row->id,
                    'name' => $row->name,
                    'icon' => $row->icon,
                    'color' => $row->color,
                    'total' => (float) $row->total,
                    'count' => (int) $row->count,
                    'percentage' => $totalExpense > 0 ? round(($row->total / $totalExpense) * 100, 1) : 0,
                ];
            });

        // Income by category / source breakdown
        $incomeBySource = Transaction::where('transactions.user_id', $user->id)
            ->where('transactions.type', 'income')
            ->whereBetween('transaction_date', [$startDate, $endDate])
            ->leftJoin('categories', 'transactions.category_id', '=', 'categories.id')
            ->select(
                'categories.id',
                DB::raw('COALESCE(categories.name, "Lainnya") as name'),
                DB::raw('COALESCE(categories.icon, "💰") as icon'),
                DB::raw('COALESCE(categories.color, "#22C55E") as color'),
                DB::raw('SUM(transactions.amount) as total'),
                DB::raw('COUNT(transactions.id) as count')
            )
            ->groupBy('categories.id', 'categories.name', 'categories.icon', 'categories.color')
            ->orderBy('total', 'desc')
            ->get()
            ->map(function ($row) use ($totalIncome) {
                return [
                    'id' => $row->id,
                    'name' => $row->name,
                    'icon' => $row->icon,
                    'color' => $row->color,
                    'total' => (float) $row->total,
                    'count' => (int) $row->count,
                    'percentage' => $totalIncome > 0 ? round(($row->total / $totalIncome) * 100, 1) : 0,
                ];
            });

        // Monthly comparison (past 6 months)
        $monthlyTrends = [];
        $currentMonth = Carbon::now();
        for ($i = 5; $i >= 0; $i--) {
            $m = $currentMonth->copy()->subMonths($i);
            $mStart = $m->copy()->startOfMonth()->format('Y-m-d');
            $mEnd = $m->copy()->endOfMonth()->format('Y-m-d');

            $inc = Transaction::where('user_id', $user->id)
                ->where('type', 'income')
                ->whereBetween('transaction_date', [$mStart, $mEnd])
                ->sum('amount');

            $exp = Transaction::where('user_id', $user->id)
                ->where('type', 'expense')
                ->whereBetween('transaction_date', [$mStart, $mEnd])
                ->sum('amount');

            $monthlyTrends[] = [
                'month' => $m->translatedFormat('M Y'),
                'income' => (float) $inc,
                'expense' => (float) $exp,
                'net' => (float) ($inc - $exp),
            ];
        }

        return response()->json([
            'date_range' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
            ],
            'summary' => [
                'total_income' => (float) $totalIncome,
                'total_expense' => (float) $totalExpense,
                'net_savings' => (float) ($totalIncome - $totalExpense),
                'total_savings' => (float) $savingsBalance,
                'total_investment' => (float) $investmentBalance,
                'savings_rate' => $totalIncome > 0 ? round((($totalIncome - $totalExpense) / $totalIncome) * 100, 1) : 0,
            ],
            'expense_by_category' => $expenseByCategory,
            'income_by_source' => $incomeBySource,
            'monthly_trends' => $monthlyTrends,
        ]);
    }

    /**
     * Export transactions as CSV.
     */
    public function exportCsv(Request $request): StreamedResponse
    {
        $user = $request->user();
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        $query = Transaction::with(['category', 'account', 'toAccount'])
            ->where('user_id', $user->id);

        if ($startDate && $endDate) {
            $query->whereBetween('transaction_date', [$startDate, $endDate]);
        }

        $transactions = $query->orderBy('transaction_date', 'asc')->get();

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="laporan_keuangan_'.date('Ymd_His').'.csv"',
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0',
        ];

        return response()->stream(function () use ($transactions) {
            $handle = fopen('php://output', 'w');
            // Add UTF-8 BOM for Excel compatibility
            fprintf($handle, chr(0xEF).chr(0xBB).chr(0xBF));

            fputcsv($handle, [
                'ID',
                'Tanggal',
                'Tipe',
                'Kategori',
                'Akun / Dompet',
                'Akun Tujuan (Transfer)',
                'Nominal (IDR)',
                'Deskripsi',
                'Metode Input',
                'Teks Suara',
            ]);

            foreach ($transactions as $tx) {
                fputcsv($handle, [
                    $tx->id,
                    $tx->transaction_date ? $tx->transaction_date->format('Y-m-d') : '',
                    strtoupper($tx->type),
                    $tx->category ? $tx->category->name : '-',
                    $tx->account ? $tx->account->name : '-',
                    $tx->toAccount ? $tx->toAccount->name : '-',
                    $tx->amount,
                    $tx->description ?? '',
                    $tx->input_method,
                    $tx->voice_text ?? '',
                ]);
            }

            fclose($handle);
        }, 200, $headers);
    }
}
