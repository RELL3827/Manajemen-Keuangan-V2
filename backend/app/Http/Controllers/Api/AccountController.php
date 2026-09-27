<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccountController extends Controller
{
    /**
     * Get all user accounts.
     */
    public function index(Request $request): JsonResponse
    {
        $accounts = Account::where('user_id', $request->user()->id)
            ->orderBy('id', 'asc')
            ->get();

        $totalBalance = $accounts->where('is_active', true)->sum('current_balance');

        return response()->json([
            'accounts' => $accounts,
            'total_balance' => (float) $totalBalance,
        ]);
    }

    /**
     * Store new account.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'type' => 'required|in:cash,bank,ewallet,savings,investment,other',
            'initial_balance' => 'nullable|numeric|min:0',
            'account_number' => 'nullable|string|max:100',
            'color' => 'nullable|string|max:20',
            'icon' => 'nullable|string|max:50',
        ]);

        $validated['user_id'] = $request->user()->id;
        $validated['initial_balance'] = $validated['initial_balance'] ?? 0;
        $validated['current_balance'] = $validated['initial_balance'];
        $validated['color'] = $validated['color'] ?? '#2563EB';
        $validated['icon'] = $validated['icon'] ?? 'Wallet';

        $account = Account::create($validated);

        return response()->json([
            'message' => 'Akun dompet berhasil ditambahkan.',
            'account' => $account,
        ], 201);
    }

    /**
     * Update account.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $account = Account::where('user_id', $request->user()->id)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'type' => 'required|in:cash,bank,ewallet,savings,investment,other',
            'account_number' => 'nullable|string|max:100',
            'color' => 'nullable|string|max:20',
            'icon' => 'nullable|string|max:50',
            'is_active' => 'nullable|boolean',
        ]);

        $account->update($validated);

        return response()->json([
            'message' => 'Akun dompet berhasil diperbarui.',
            'account' => $account,
        ]);
    }

    /**
     * Delete account.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $account = Account::where('user_id', $request->user()->id)->findOrFail($id);

        // Prevent deletion if it has transactions
        $hasTransactions = Transaction::where('account_id', $id)
            ->orWhere('to_account_id', $id)
            ->exists();

        if ($hasTransactions) {
            // Soft deactivate instead
            $account->update(['is_active' => false]);
            return response()->json([
                'message' => 'Akun dinonaktifkan karena memiliki riwayat transaksi.',
                'account' => $account,
            ]);
        }

        $account->delete();

        return response()->json([
            'message' => 'Akun dompet berhasil dihapus.',
        ]);
    }

    /**
     * Quick transfer between accounts.
     */
    public function transfer(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'from_account_id' => 'required|exists:accounts,id',
            'to_account_id' => 'required|exists:accounts,id|different:from_account_id',
            'amount' => 'required|numeric|min:1',
            'description' => 'nullable|string|max:255',
            'transaction_date' => 'required|date',
        ]);

        $fromAccount = Account::where('id', $validated['from_account_id'])
            ->where('user_id', $user->id)
            ->firstOrFail();

        $toAccount = Account::where('id', $validated['to_account_id'])
            ->where('user_id', $user->id)
            ->firstOrFail();

        DB::beginTransaction();
        try {
            $fromAccount->decrement('current_balance', $validated['amount']);
            $toAccount->increment('current_balance', $validated['amount']);

            $tx = Transaction::create([
                'user_id' => $user->id,
                'account_id' => $fromAccount->id,
                'to_account_id' => $toAccount->id,
                'category_id' => null,
                'type' => 'transfer',
                'amount' => $validated['amount'],
                'description' => $validated['description'] ?? "Transfer dari {$fromAccount->name} ke {$toAccount->name}",
                'transaction_date' => $validated['transaction_date'],
                'input_method' => 'manual',
            ]);

            DB::commit();

            return response()->json([
                'message' => 'Transfer dana berhasil dicatat.',
                'transaction' => $tx->load(['account', 'toAccount']),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Transfer gagal: '.$e->getMessage()], 500);
        }
    }
}
