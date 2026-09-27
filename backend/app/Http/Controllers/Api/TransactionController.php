<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Budget;
use App\Models\Category;
use App\Models\Notification;
use App\Models\Transaction;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TransactionController extends Controller
{
    /**
     * Get filtered transaction list.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Transaction::with(['category', 'account', 'toAccount'])
            ->where('user_id', $user->id);

        // Filter by type
        if ($request->filled('type') && $request->type !== 'all') {
            $query->where('type', $request->type);
        }

        // Filter by category
        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        // Filter by account
        if ($request->filled('account_id')) {
            $query->where(function ($q) use ($request) {
                $q->where('account_id', $request->account_id)
                  ->orWhere('to_account_id', $request->account_id);
            });
        }

        // Search in description, category name, or voice text
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhere('voice_text', 'like', "%{$search}%")
                  ->orWhereHas('category', function ($catQuery) use ($search) {
                      $catQuery->where('name', 'like', "%{$search}%");
                  });
            });
        }

        // Date filter
        $now = Carbon::now();
        $dateFilter = $request->query('date_filter', 'all');

        switch ($dateFilter) {
            case 'today':
                $query->whereDate('transaction_date', $now->format('Y-m-d'));
                break;
            case 'this_week':
                $query->whereBetween('transaction_date', [
                    $now->copy()->startOfWeek()->format('Y-m-d'),
                    $now->copy()->endOfWeek()->format('Y-m-d'),
                ]);
                break;
            case 'this_month':
                $query->whereBetween('transaction_date', [
                    $now->copy()->startOfMonth()->format('Y-m-d'),
                    $now->copy()->endOfMonth()->format('Y-m-d'),
                ]);
                break;
            case 'custom':
                if ($request->filled('start_date') && $request->filled('end_date')) {
                    $query->whereBetween('transaction_date', [
                        $request->start_date,
                        $request->end_date,
                    ]);
                }
                break;
        }

        $perPage = $request->query('per_page', 50);
        $transactions = $query->orderBy('transaction_date', 'desc')
            ->orderBy('id', 'desc')
            ->paginate($perPage);

        return response()->json($transactions);
    }

    /**
     * Store a newly created transaction.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'account_id' => 'required|exists:accounts,id',
            'to_account_id' => 'nullable|required_if:type,transfer|exists:accounts,id',
            'category_id' => 'nullable|exists:categories,id',
            'type' => 'required|in:income,expense,transfer',
            'amount' => 'required|numeric|min:1',
            'description' => 'nullable|string|max:500',
            'transaction_date' => 'required|date',
            'input_method' => 'nullable|in:manual,voice',
            'voice_text' => 'nullable|string',
            'attachment' => 'nullable|string',
        ]);

        $validated['user_id'] = $user->id;
        $validated['input_method'] = $validated['input_method'] ?? 'manual';

        DB::beginTransaction();
        try {
            $account = Account::where('id', $validated['account_id'])
                ->where('user_id', $user->id)
                ->firstOrFail();

            // Adjust account balances
            if ($validated['type'] === 'income') {
                $account->increment('current_balance', $validated['amount']);
            } elseif ($validated['type'] === 'expense') {
                $account->decrement('current_balance', $validated['amount']);
            } elseif ($validated['type'] === 'transfer') {
                $toAccount = Account::where('id', $validated['to_account_id'])
                    ->where('user_id', $user->id)
                    ->firstOrFail();

                $account->decrement('current_balance', $validated['amount']);
                $toAccount->increment('current_balance', $validated['amount']);
            }

            $transaction = Transaction::create($validated);

            // Check budget alert if expense
            if ($validated['type'] === 'expense' && ! empty($validated['category_id'])) {
                $this->checkBudgetAlert($user->id, $validated['category_id'], $validated['transaction_date']);
            }

            DB::commit();

            return response()->json([
                'message' => 'Transaksi berhasil disimpan.',
                'transaction' => $transaction->load(['category', 'account', 'toAccount']),
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Gagal menyimpan transaksi: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified transaction.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $transaction = Transaction::with(['category', 'account', 'toAccount'])
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        return response()->json($transaction);
    }

    /**
     * Update the specified transaction.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $transaction = Transaction::where('user_id', $user->id)->findOrFail($id);

        $validated = $request->validate([
            'account_id' => 'required|exists:accounts,id',
            'to_account_id' => 'nullable|required_if:type,transfer|exists:accounts,id',
            'category_id' => 'nullable|exists:categories,id',
            'type' => 'required|in:income,expense,transfer',
            'amount' => 'required|numeric|min:1',
            'description' => 'nullable|string|max:500',
            'transaction_date' => 'required|date',
            'attachment' => 'nullable|string',
        ]);

        DB::beginTransaction();
        try {
            // Revert old transaction balances
            $oldAccount = Account::find($transaction->account_id);
            if ($oldAccount) {
                if ($transaction->type === 'income') {
                    $oldAccount->decrement('current_balance', $transaction->amount);
                } elseif ($transaction->type === 'expense') {
                    $oldAccount->increment('current_balance', $transaction->amount);
                } elseif ($transaction->type === 'transfer' && $transaction->to_account_id) {
                    $oldAccount->increment('current_balance', $transaction->amount);
                    $oldToAccount = Account::find($transaction->to_account_id);
                    if ($oldToAccount) {
                        $oldToAccount->decrement('current_balance', $transaction->amount);
                    }
                }
            }

            // Apply new transaction balances
            $newAccount = Account::where('id', $validated['account_id'])
                ->where('user_id', $user->id)
                ->firstOrFail();

            if ($validated['type'] === 'income') {
                $newAccount->increment('current_balance', $validated['amount']);
            } elseif ($validated['type'] === 'expense') {
                $newAccount->decrement('current_balance', $validated['amount']);
            } elseif ($validated['type'] === 'transfer') {
                $newToAccount = Account::where('id', $validated['to_account_id'])
                    ->where('user_id', $user->id)
                    ->firstOrFail();

                $newAccount->decrement('current_balance', $validated['amount']);
                $newToAccount->increment('current_balance', $validated['amount']);
            }

            $transaction->update($validated);

            DB::commit();

            return response()->json([
                'message' => 'Transaksi berhasil diperbarui.',
                'transaction' => $transaction->fresh(['category', 'account', 'toAccount']),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Gagal memperbarui transaksi: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove the specified transaction.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $transaction = Transaction::where('user_id', $user->id)->findOrFail($id);

        DB::beginTransaction();
        try {
            // Revert account balances
            $account = Account::find($transaction->account_id);
            if ($account) {
                if ($transaction->type === 'income') {
                    $account->decrement('current_balance', $transaction->amount);
                } elseif ($transaction->type === 'expense') {
                    $account->increment('current_balance', $transaction->amount);
                } elseif ($transaction->type === 'transfer' && $transaction->to_account_id) {
                    $account->increment('current_balance', $transaction->amount);
                    $toAccount = Account::find($transaction->to_account_id);
                    if ($toAccount) {
                        $toAccount->decrement('current_balance', $transaction->amount);
                    }
                }
            }

            $transaction->delete();
            DB::commit();

            return response()->json([
                'message' => 'Transaksi berhasil dihapus.',
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Gagal menghapus transaksi: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Batch sync offline transactions recorded in IndexedDB.
     */
    public function sync(Request $request): JsonResponse
    {
        $user = $request->user();
        $items = $request->input('transactions', []);

        if (! is_array($items) || empty($items)) {
            return response()->json([
                'message' => 'Tidak ada transaksi yang perlu disinkronkan.',
                'synced_count' => 0,
            ]);
        }

        $synced = [];
        $errors = [];

        DB::beginTransaction();
        try {
            foreach ($items as $item) {
                // Ensure default account if missing
                if (empty($item['account_id'])) {
                    $defaultAcc = Account::where('user_id', $user->id)->first();
                    $item['account_id'] = $defaultAcc ? $defaultAcc->id : null;
                }

                if (! $item['account_id']) {
                    continue;
                }

                $account = Account::where('id', $item['account_id'])
                    ->where('user_id', $user->id)
                    ->first();

                if (! $account) {
                    continue;
                }

                $amount = (float) ($item['amount'] ?? 0);
                $type = $item['type'] ?? 'expense';

                if ($type === 'income') {
                    $account->increment('current_balance', $amount);
                } elseif ($type === 'expense') {
                    $account->decrement('current_balance', $amount);
                } elseif ($type === 'transfer' && ! empty($item['to_account_id'])) {
                    $toAccount = Account::where('id', $item['to_account_id'])
                        ->where('user_id', $user->id)
                        ->first();
                    if ($toAccount) {
                        $account->decrement('current_balance', $amount);
                        $toAccount->increment('current_balance', $amount);
                    }
                }

                $tx = Transaction::create([
                    'user_id' => $user->id,
                    'account_id' => $item['account_id'],
                    'to_account_id' => $item['to_account_id'] ?? null,
                    'category_id' => $item['category_id'] ?? null,
                    'type' => $type,
                    'amount' => $amount,
                    'description' => $item['description'] ?? 'Offline Voice Transaction',
                    'transaction_date' => $item['transaction_date'] ?? Carbon::now()->format('Y-m-d'),
                    'input_method' => $item['input_method'] ?? 'voice',
                    'voice_text' => $item['voice_text'] ?? null,
                    'attachment' => $item['attachment'] ?? null,
                ]);

                $synced[] = [
                    'client_id' => $item['client_id'] ?? null,
                    'server_id' => $tx->id,
                ];
            }

            DB::commit();

            return response()->json([
                'message' => count($synced).' transaksi offline berhasil disinkronkan.',
                'synced_count' => count($synced),
                'synced' => $synced,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Sinkronisasi gagal: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Check budget threshold and fire alert notification if exceeded.
     */
    private function checkBudgetAlert(int $userId, int $categoryId, string $date): void
    {
        $month = Carbon::parse($date)->format('Y-m');
        $budget = Budget::where('user_id', $userId)
            ->where('category_id', $categoryId)
            ->where('month', $month)
            ->first();

        if (! $budget) {
            return;
        }

        $startOfMonth = Carbon::parse($date)->startOfMonth()->format('Y-m-d');
        $endOfMonth = Carbon::parse($date)->endOfMonth()->format('Y-m-d');

        $totalSpent = Transaction::where('user_id', $userId)
            ->where('category_id', $categoryId)
            ->where('type', 'expense')
            ->whereBetween('transaction_date', [$startOfMonth, $endOfMonth])
            ->sum('amount');

        $category = Category::find($categoryId);
        $catName = $category ? $category->name : 'Kategori';

        if ($totalSpent > $budget->amount) {
            Notification::create([
                'user_id' => $userId,
                'type' => 'budget_exceeded',
                'title' => "Budget {$catName} Terlampaui!",
                'message' => "Pengeluaran kategori {$catName} sudah melewati budget. Total terpakai: Rp " . number_format($totalSpent, 0, ',', '.') . " dari budget Rp " . number_format($budget->amount, 0, ',', '.') . ".",
                'is_read' => false,
                'data' => ['category_id' => $categoryId, 'spent' => $totalSpent, 'budget' => $budget->amount],
            ]);
        } elseif ($budget->amount > 0 && ($totalSpent / $budget->amount) * 100 >= $budget->alert_threshold) {
            $percentage = round(($totalSpent / $budget->amount) * 100);
            Notification::create([
                'user_id' => $userId,
                'type' => 'budget_warning',
                'title' => "Peringatan Budget {$catName}",
                'message' => "Budget {$catName} sudah terpakai {$percentage}%.",
                'is_read' => false,
                'data' => ['category_id' => $categoryId, 'percentage' => $percentage],
            ]);
        }
    }
}
