<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BudgetController extends Controller
{
    /**
     * Get budgets for a given month with spent calculation.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $month = $request->query('month', Carbon::now()->format('Y-m'));

        $startOfMonth = Carbon::parse($month.'-01')->startOfMonth()->format('Y-m-d');
        $endOfMonth = Carbon::parse($month.'-01')->endOfMonth()->format('Y-m-d');

        $budgets = Budget::with('category')
            ->where('user_id', $user->id)
            ->where('month', $month)
            ->get()
            ->map(function ($budget) use ($user, $startOfMonth, $endOfMonth) {
                $spent = Transaction::where('user_id', $user->id)
                    ->where('category_id', $budget->category_id)
                    ->where('type', 'expense')
                    ->whereBetween('transaction_date', [$startOfMonth, $endOfMonth])
                    ->sum('amount');

                $percentage = $budget->amount > 0 ? round(($spent / $budget->amount) * 100, 1) : 0;
                $remaining = max(0, $budget->amount - $spent);
                $isOver = $spent > $budget->amount;

                return [
                    'id' => $budget->id,
                    'category_id' => $budget->category_id,
                    'category' => $budget->category,
                    'month' => $budget->month,
                    'amount' => (float) $budget->amount,
                    'spent' => (float) $spent,
                    'remaining' => (float) $remaining,
                    'percentage' => $percentage,
                    'alert_threshold' => $budget->alert_threshold,
                    'is_over_budget' => $isOver,
                    'warning_level' => $isOver ? 'danger' : ($percentage >= $budget->alert_threshold ? 'warning' : 'safe'),
                ];
            });

        $totalBudget = $budgets->sum('amount');
        $totalSpent = $budgets->sum('spent');

        return response()->json([
            'month' => $month,
            'budgets' => $budgets,
            'summary' => [
                'total_budget' => (float) $totalBudget,
                'total_spent' => (float) $totalSpent,
                'total_remaining' => (float) max(0, $totalBudget - $totalSpent),
                'overall_percentage' => $totalBudget > 0 ? round(($totalSpent / $totalBudget) * 100, 1) : 0,
            ],
        ]);
    }

    /**
     * Store or update budget for category in month.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'category_id' => 'required|exists:categories,id',
            'amount' => 'required|numeric|min:1',
            'month' => 'required|string|size:7', // YYYY-MM
            'alert_threshold' => 'nullable|integer|min:1|max:100',
        ]);

        $validated['user_id'] = $user->id;
        $validated['alert_threshold'] = $validated['alert_threshold'] ?? 80;

        $budget = Budget::updateOrCreate(
            [
                'user_id' => $user->id,
                'category_id' => $validated['category_id'],
                'month' => $validated['month'],
            ],
            [
                'amount' => $validated['amount'],
                'alert_threshold' => $validated['alert_threshold'],
            ]
        );

        return response()->json([
            'message' => 'Anggaran berhasil disimpan.',
            'budget' => $budget->load('category'),
        ], 201);
    }

    /**
     * Update budget.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $budget = Budget::where('user_id', $request->user()->id)->findOrFail($id);

        $validated = $request->validate([
            'amount' => 'required|numeric|min:1',
            'alert_threshold' => 'nullable|integer|min:1|max:100',
        ]);

        $budget->update($validated);

        return response()->json([
            'message' => 'Anggaran berhasil diperbarui.',
            'budget' => $budget->load('category'),
        ]);
    }

    /**
     * Delete budget.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $budget = Budget::where('user_id', $request->user()->id)->findOrFail($id);
        $budget->delete();

        return response()->json([
            'message' => 'Anggaran berhasil dihapus.',
        ]);
    }
}
