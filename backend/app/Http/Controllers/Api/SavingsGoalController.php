<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Notification;
use App\Models\SavingsGoal;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SavingsGoalController extends Controller
{
    /**
     * Get all savings goals with progress calculations.
     */
    public function index(Request $request): JsonResponse
    {
        $goals = SavingsGoal::where('user_id', $request->user()->id)
            ->orderBy('is_completed', 'asc')
            ->orderBy('target_date', 'asc')
            ->get()
            ->map(function ($goal) {
                $percentage = $goal->target_amount > 0
                    ? min(100, round(($goal->current_amount / $goal->target_amount) * 100, 1))
                    : 0;

                $remaining = max(0, $goal->target_amount - $goal->current_amount);

                return [
                    'id' => $goal->id,
                    'name' => $goal->name,
                    'target_amount' => (float) $goal->target_amount,
                    'current_amount' => (float) $goal->current_amount,
                    'remaining' => (float) $remaining,
                    'progress_percentage' => $percentage,
                    'target_date' => $goal->target_date ? $goal->target_date->format('Y-m-d') : null,
                    'target_date_human' => $goal->target_date ? $goal->target_date->translatedFormat('F Y') : null,
                    'icon' => $goal->icon,
                    'color' => $goal->color,
                    'notes' => $goal->notes,
                    'is_completed' => (bool) $goal->is_completed,
                ];
            });

        $totalTarget = $goals->sum('target_amount');
        $totalCollected = $goals->sum('current_amount');

        return response()->json([
            'goals' => $goals,
            'summary' => [
                'total_target' => (float) $totalTarget,
                'total_collected' => (float) $totalCollected,
                'total_remaining' => (float) max(0, $totalTarget - $totalCollected),
                'overall_percentage' => $totalTarget > 0 ? round(($totalCollected / $totalTarget) * 100, 1) : 0,
            ],
        ]);
    }

    /**
     * Store new savings goal.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'target_amount' => 'required|numeric|min:1',
            'current_amount' => 'nullable|numeric|min:0',
            'target_date' => 'nullable|date',
            'icon' => 'nullable|string|max:50',
            'color' => 'nullable|string|max:20',
            'notes' => 'nullable|string|max:500',
        ]);

        $validated['user_id'] = $request->user()->id;
        $validated['current_amount'] = $validated['current_amount'] ?? 0;
        $validated['icon'] = $validated['icon'] ?? 'Target';
        $validated['color'] = $validated['color'] ?? '#2563EB';

        $goal = SavingsGoal::create($validated);

        return response()->json([
            'message' => 'Target tabungan berhasil dibuat.',
            'goal' => $goal,
        ], 201);
    }

    /**
     * Update savings goal.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $goal = SavingsGoal::where('user_id', $request->user()->id)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'target_amount' => 'required|numeric|min:1',
            'target_date' => 'nullable|date',
            'icon' => 'nullable|string|max:50',
            'color' => 'nullable|string|max:20',
            'notes' => 'nullable|string|max:500',
            'is_completed' => 'nullable|boolean',
        ]);

        $goal->update($validated);

        return response()->json([
            'message' => 'Target tabungan berhasil diperbarui.',
            'goal' => $goal,
        ]);
    }

    /**
     * Add deposit/funds into savings goal.
     */
    public function deposit(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $goal = SavingsGoal::where('user_id', $user->id)->findOrFail($id);

        $validated = $request->validate([
            'amount' => 'required|numeric|min:1',
            'account_id' => 'nullable|exists:accounts,id',
            'notes' => 'nullable|string|max:255',
        ]);

        DB::beginTransaction();
        try {
            $amount = $validated['amount'];

            // Optionally deduct from chosen account
            if (! empty($validated['account_id'])) {
                $account = Account::where('id', $validated['account_id'])
                    ->where('user_id', $user->id)
                    ->first();
                if ($account) {
                    $account->decrement('current_balance', $amount);
                }
            }

            $newAmount = $goal->current_amount + $amount;
            $isCompleted = $newAmount >= $goal->target_amount;

            $goal->update([
                'current_amount' => $newAmount,
                'is_completed' => $isCompleted,
            ]);

            if ($isCompleted) {
                Notification::create([
                    'user_id' => $user->id,
                    'type' => 'savings_reached',
                    'title' => '🎉 Target Tabungan Tercapai!',
                    'message' => "Selamat! Target tabungan '{$goal->name}' sebesar Rp " . number_format($goal->target_amount, 0, ',', '.') . " telah berhasil Anda capai!",
                    'is_read' => false,
                    'data' => ['goal_id' => $goal->id],
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => 'Tabungan berhasil ditambahkan.',
                'goal' => $goal,
                'is_completed' => $isCompleted,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Gagal menambah tabungan: '.$e->getMessage()], 500);
        }
    }

    /**
     * Delete goal.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $goal = SavingsGoal::where('user_id', $request->user()->id)->findOrFail($id);
        $goal->delete();

        return response()->json([
            'message' => 'Target tabungan berhasil dihapus.',
        ]);
    }
}
