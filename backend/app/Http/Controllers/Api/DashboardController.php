<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Budget;
use App\Models\Category;
use App\Models\SavingsGoal;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * Get dashboard financial summary, charts, and smart insights.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $period = $request->query('period', 'month'); // 7days, 30days, month, 3months, 1year

        $now = Carbon::now();
        $startOfMonth = $now->copy()->startOfMonth();
        $endOfMonth = $now->copy()->endOfMonth();

        // 1. Current Total Balance (sum of active accounts)
        $currentBalance = Account::where('user_id', $user->id)
            ->where('is_active', true)
            ->sum('current_balance');

        // 2. Total Income & Expense this month
        $monthlyIncome = Transaction::where('user_id', $user->id)
            ->where('type', 'income')
            ->whereBetween('transaction_date', [$startOfMonth->format('Y-m-d'), $endOfMonth->format('Y-m-d')])
            ->sum('amount');

        $monthlyExpense = Transaction::where('user_id', $user->id)
            ->where('type', 'expense')
            ->whereBetween('transaction_date', [$startOfMonth->format('Y-m-d'), $endOfMonth->format('Y-m-d')])
            ->sum('amount');

        // 3. Total Savings (savings accounts + savings goals)
        $savingsAccountBalance = Account::where('user_id', $user->id)
            ->where('type', 'savings')
            ->where('is_active', true)
            ->sum('current_balance');

        $savingsGoalsBalance = SavingsGoal::where('user_id', $user->id)
            ->sum('current_amount');

        $totalSavings = max($savingsAccountBalance, $savingsGoalsBalance);

        // 4. Cashflow Chart Data based on period
        $chartData = $this->generateCashflowChart($user->id, $period);

        // 5. Recent Transactions
        $recentTransactions = Transaction::with(['category', 'account', 'toAccount'])
            ->where('user_id', $user->id)
            ->orderBy('transaction_date', 'desc')
            ->orderBy('id', 'desc')
            ->limit(6)
            ->get();

        // 6. Budgets overview for current month
        $thisMonthStr = $now->format('Y-m');
        $budgets = Budget::with('category')
            ->where('user_id', $user->id)
            ->where('month', $thisMonthStr)
            ->get()
            ->map(function ($budget) use ($user, $startOfMonth, $endOfMonth) {
                $spent = Transaction::where('user_id', $user->id)
                    ->where('category_id', $budget->category_id)
                    ->where('type', 'expense')
                    ->whereBetween('transaction_date', [$startOfMonth->format('Y-m-d'), $endOfMonth->format('Y-m-d')])
                    ->sum('amount');

                $percentage = $budget->amount > 0 ? round(($spent / $budget->amount) * 100, 1) : 0;
                $remaining = max(0, $budget->amount - $spent);

                return [
                    'id' => $budget->id,
                    'category' => $budget->category,
                    'amount' => (float) $budget->amount,
                    'spent' => (float) $spent,
                    'remaining' => (float) $remaining,
                    'percentage' => $percentage,
                    'is_over_budget' => $spent > $budget->amount,
                ];
            });

        // 7. Automated Smart Insights
        $insights = $this->generateInsights($user->id, $now);

        return response()->json([
            'summary' => [
                'current_balance' => (float) $currentBalance,
                'total_income_month' => (float) $monthlyIncome,
                'total_expense_month' => (float) $monthlyExpense,
                'total_savings' => (float) $totalSavings,
            ],
            'chart_data' => $chartData,
            'recent_transactions' => $recentTransactions,
            'budgets' => $budgets,
            'insights' => $insights,
        ]);
    }

    /**
     * Generate cashflow chart points for given period.
     */
    private function generateCashflowChart(int $userId, string $period): array
    {
        $now = Carbon::now();
        $chartPoints = [];

        switch ($period) {
            case '7days':
                $startDate = $now->copy()->subDays(6)->startOfDay();
                $periodDays = 7;
                for ($i = 0; $i < $periodDays; $i++) {
                    $day = $startDate->copy()->addDays($i);
                    $dateStr = $day->format('Y-m-d');
                    $label = $day->translatedFormat('D, d M');

                    $income = Transaction::where('user_id', $userId)
                        ->where('type', 'income')
                        ->whereDate('transaction_date', $dateStr)
                        ->sum('amount');

                    $expense = Transaction::where('user_id', $userId)
                        ->where('type', 'expense')
                        ->whereDate('transaction_date', $dateStr)
                        ->sum('amount');

                    $chartPoints[] = [
                        'date' => $dateStr,
                        'label' => $label,
                        'income' => (float) $income,
                        'expense' => (float) $expense,
                    ];
                }
                break;

            case '30days':
                $startDate = $now->copy()->subDays(29)->startOfDay();
                for ($i = 0; $i < 30; $i += 3) {
                    $periodStart = $startDate->copy()->addDays($i);
                    $periodEnd = $periodStart->copy()->addDays(2);
                    $label = $periodStart->format('d M');

                    $income = Transaction::where('user_id', $userId)
                        ->where('type', 'income')
                        ->whereBetween('transaction_date', [$periodStart->format('Y-m-d'), $periodEnd->format('Y-m-d')])
                        ->sum('amount');

                    $expense = Transaction::where('user_id', $userId)
                        ->where('type', 'expense')
                        ->whereBetween('transaction_date', [$periodStart->format('Y-m-d'), $periodEnd->format('Y-m-d')])
                        ->sum('amount');

                    $chartPoints[] = [
                        'date' => $periodStart->format('Y-m-d'),
                        'label' => $label,
                        'income' => (float) $income,
                        'expense' => (float) $expense,
                    ];
                }
                break;

            case '3months':
                for ($i = 2; $i >= 0; $i--) {
                    $m = $now->copy()->subMonths($i);
                    $start = $m->copy()->startOfMonth()->format('Y-m-d');
                    $end = $m->copy()->endOfMonth()->format('Y-m-d');
                    $label = $m->translatedFormat('F Y');

                    $income = Transaction::where('user_id', $userId)
                        ->where('type', 'income')
                        ->whereBetween('transaction_date', [$start, $end])
                        ->sum('amount');

                    $expense = Transaction::where('user_id', $userId)
                        ->where('type', 'expense')
                        ->whereBetween('transaction_date', [$start, $end])
                        ->sum('amount');

                    $chartPoints[] = [
                        'date' => $start,
                        'label' => $label,
                        'income' => (float) $income,
                        'expense' => (float) $expense,
                    ];
                }
                break;

            case '1year':
                for ($i = 11; $i >= 0; $i--) {
                    $m = $now->copy()->subMonths($i);
                    $start = $m->copy()->startOfMonth()->format('Y-m-d');
                    $end = $m->copy()->endOfMonth()->format('Y-m-d');
                    $label = $m->translatedFormat('M Y');

                    $income = Transaction::where('user_id', $userId)
                        ->where('type', 'income')
                        ->whereBetween('transaction_date', [$start, $end])
                        ->sum('amount');

                    $expense = Transaction::where('user_id', $userId)
                        ->where('type', 'expense')
                        ->whereBetween('transaction_date', [$start, $end])
                        ->sum('amount');

                    $chartPoints[] = [
                        'date' => $start,
                        'label' => $label,
                        'income' => (float) $income,
                        'expense' => (float) $expense,
                    ];
                }
                break;

            case 'month':
            default:
                // Divide month into 4 weeks
                $daysInMonth = $now->daysInMonth;
                $steps = [
                    ['start' => 1, 'end' => 7, 'label' => 'Mgg 1 (1-7)'],
                    ['start' => 8, 'end' => 14, 'label' => 'Mgg 2 (8-14)'],
                    ['start' => 15, 'end' => 21, 'label' => 'Mgg 3 (15-21)'],
                    ['start' => 22, 'end' => $daysInMonth, 'label' => 'Mgg 4 (22-'.$daysInMonth.')'],
                ];

                foreach ($steps as $step) {
                    $startDate = $now->copy()->setDay($step['start'])->format('Y-m-d');
                    $endDate = $now->copy()->setDay($step['end'])->format('Y-m-d');

                    $income = Transaction::where('user_id', $userId)
                        ->where('type', 'income')
                        ->whereBetween('transaction_date', [$startDate, $endDate])
                        ->sum('amount');

                    $expense = Transaction::where('user_id', $userId)
                        ->where('type', 'expense')
                        ->whereBetween('transaction_date', [$startDate, $endDate])
                        ->sum('amount');

                    $chartPoints[] = [
                        'date' => $startDate,
                        'label' => $step['label'],
                        'income' => (float) $income,
                        'expense' => (float) $expense,
                    ];
                }
                break;
        }

        return $chartPoints;
    }

    /**
     * Generate automated financial insights.
     */
    private function generateInsights(int $userId, Carbon $now): array
    {
        $startOfMonth = $now->copy()->startOfMonth()->format('Y-m-d');
        $endOfMonth = $now->copy()->endOfMonth()->format('Y-m-d');

        $startOfLastMonth = $now->copy()->subMonth()->startOfMonth()->format('Y-m-d');
        $endOfLastMonth = $now->copy()->subMonth()->endOfMonth()->format('Y-m-d');

        $insights = [];

        // 1. Largest category expense this month
        $topExpense = Transaction::where('transactions.user_id', $userId)
            ->where('transactions.type', 'expense')
            ->whereBetween('transaction_date', [$startOfMonth, $endOfMonth])
            ->join('categories', 'transactions.category_id', '=', 'categories.id')
            ->select('categories.name', DB::raw('SUM(transactions.amount) as total'))
            ->groupBy('categories.id', 'categories.name')
            ->orderBy('total', 'desc')
            ->first();

        $totalExpenseMonth = Transaction::where('user_id', $userId)
            ->where('type', 'expense')
            ->whereBetween('transaction_date', [$startOfMonth, $endOfMonth])
            ->sum('amount');

        if ($topExpense && $totalExpenseMonth > 0) {
            $percentage = round(($topExpense->total / $totalExpenseMonth) * 100);
            $insights[] = [
                'type' => 'top_category',
                'title' => 'Pengeluaran Terbesar',
                'description' => "Pengeluaran terbesar bulan ini adalah {$topExpense->name} sebesar Rp " . number_format($topExpense->total, 0, ',', '.') . " ({$percentage}% dari total pengeluaran).",
                'icon' => 'TrendingUp',
                'color' => '#EF4444',
            ];
        }

        // 2. Month-over-month comparison
        $lastMonthExpense = Transaction::where('user_id', $userId)
            ->where('type', 'expense')
            ->whereBetween('transaction_date', [$startOfLastMonth, $endOfLastMonth])
            ->sum('amount');

        if ($lastMonthExpense > 0 && $totalExpenseMonth > 0) {
            $diff = $totalExpenseMonth - $lastMonthExpense;
            $diffPercentage = round(abs($diff) / $lastMonthExpense * 100, 1);
            if ($diff < 0) {
                $insights[] = [
                    'type' => 'trend',
                    'title' => 'Tren Pengeluaran Positif',
                    'description' => "Pengeluaran bulan ini turun {$diffPercentage}% dibanding bulan lalu.",
                    'icon' => 'TrendingDown',
                    'color' => '#10B981',
                ];
            } else {
                $insights[] = [
                    'type' => 'trend',
                    'title' => 'Kenaikan Pengeluaran',
                    'description' => "Pengeluaran bulan ini naik {$diffPercentage}% dibanding bulan lalu.",
                    'icon' => 'AlertCircle',
                    'color' => '#F59E0B',
                ];
            }
        }

        // 3. Daily average spending
        $dayPassed = max(1, $now->day);
        $avgDaily = round($totalExpenseMonth / $dayPassed);
        $insights[] = [
            'type' => 'daily_avg',
            'title' => 'Rata-rata Harian',
            'description' => "Anda menghabiskan rata-rata Rp " . number_format($avgDaily, 0, ',', '.') . " per hari di bulan ini.",
            'icon' => 'Calendar',
            'color' => '#3B82F6',
        ];

        // 4. Savings rate insight
        $monthlyIncome = Transaction::where('user_id', $userId)
            ->where('type', 'income')
            ->whereBetween('transaction_date', [$startOfMonth, $endOfMonth])
            ->sum('amount');

        if ($monthlyIncome > 0) {
            $savingsRate = round((($monthlyIncome - $totalExpenseMonth) / $monthlyIncome) * 100, 1);
            $insights[] = [
                'type' => 'savings_rate',
                'title' => 'Rasio Arus Kas Bersih',
                'description' => "Surplus arus kas Anda berada di angka {$savingsRate}% dari total pemasukan.",
                'icon' => 'PiggyBank',
                'color' => '#8B5CF6',
            ];
        }

        return $insights;
    }
}
