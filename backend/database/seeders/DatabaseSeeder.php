<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\Budget;
use App\Models\Category;
use App\Models\Notification;
use App\Models\SavingsGoal;
use App\Models\Setting;
use App\Models\Transaction;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Create Demo User
        $user = User::create([
            'name' => 'Budi Santoso',
            'email' => 'demo@earnvoice.app',
            'password' => Hash::make('password'),
            'avatar' => null,
            'currency' => 'IDR',
            'timezone' => 'Asia/Jakarta',
            'language' => 'id',
        ]);

        // 2. Default Categories
        $categoriesData = [
            ['name' => 'Makanan & Minuman', 'type' => 'expense', 'icon' => '🍔', 'color' => '#EF4444'],
            ['name' => 'Transportasi', 'type' => 'expense', 'icon' => '🚗', 'color' => '#F97316'],
            ['name' => 'Belanja', 'type' => 'expense', 'icon' => '🛍️', 'color' => '#EC4899'],
            ['name' => 'Rumah & Tempat Tinggal', 'type' => 'expense', 'icon' => '🏠', 'color' => '#8B5CF6'],
            ['name' => 'Tagihan & Utilitas', 'type' => 'expense', 'icon' => '💡', 'color' => '#06B6D4'],
            ['name' => 'Pendidikan', 'type' => 'expense', 'icon' => '🎓', 'color' => '#3B82F6'],
            ['name' => 'Kesehatan', 'type' => 'expense', 'icon' => '💊', 'color' => '#10B981'],
            ['name' => 'Hiburan', 'type' => 'expense', 'icon' => '🎮', 'color' => '#F59E0B'],
            ['name' => 'Gaji Pokok', 'type' => 'income', 'icon' => '💰', 'color' => '#22C55E'],
            ['name' => 'Freelance', 'type' => 'income', 'icon' => '💼', 'color' => '#14B8A6'],
            ['name' => 'Investasi & Dividen', 'type' => 'both', 'icon' => '📈', 'color' => '#6366F1'],
            ['name' => 'Tabungan', 'type' => 'both', 'icon' => '🏦', 'color' => '#0EA5E9'],
            ['name' => 'Bisnis & Penjualan', 'type' => 'income', 'icon' => '📦', 'color' => '#84CC16'],
            ['name' => 'Paket Data & Internet', 'type' => 'expense', 'icon' => '📱', 'color' => '#A855F7'],
            ['name' => 'Token & Listrik PLN', 'type' => 'expense', 'icon' => '⚡', 'color' => '#EAB308'],
            ['name' => 'Lainnya', 'type' => 'both', 'icon' => '✨', 'color' => '#64748B'],
        ];

        $categories = [];
        foreach ($categoriesData as $cat) {
            $categories[$cat['name']] = Category::create([
                'user_id' => $user->id,
                'name' => $cat['name'],
                'type' => $cat['type'],
                'icon' => $cat['icon'],
                'color' => $cat['color'],
                'is_default' => true,
            ]);
        }

        // 3. User Accounts (Dompet)
        $accCash = Account::create([
            'user_id' => $user->id,
            'name' => 'Dompet Tunai (Cash)',
            'type' => 'cash',
            'initial_balance' => 500000,
            'current_balance' => 500000,
            'account_number' => null,
            'color' => '#10B981',
            'icon' => 'Banknote',
            'is_active' => true,
        ]);

        $accBCA = Account::create([
            'user_id' => $user->id,
            'name' => 'Bank BCA',
            'type' => 'bank',
            'initial_balance' => 2500000,
            'current_balance' => 2500000,
            'account_number' => '8210982341',
            'color' => '#2563EB',
            'icon' => 'Landmark',
            'is_active' => true,
        ]);

        $accDana = Account::create([
            'user_id' => $user->id,
            'name' => 'DANA E-Wallet',
            'type' => 'ewallet',
            'initial_balance' => 350000,
            'current_balance' => 350000,
            'account_number' => '081234567890',
            'color' => '#0284C7',
            'icon' => 'Smartphone',
            'is_active' => true,
        ]);

        $accSavings = Account::create([
            'user_id' => $user->id,
            'name' => 'Rekening Tabungan',
            'type' => 'savings',
            'initial_balance' => 1500000,
            'current_balance' => 1500000,
            'account_number' => '501928374',
            'color' => '#8B5CF6',
            'icon' => 'PiggyBank',
            'is_active' => true,
        ]);

        // 4. Sample Transactions
        $today = Carbon::today();
        $thisMonth = $today->format('Y-m');

        $sampleTransactions = [
            [
                'account_id' => $accBCA->id,
                'category_id' => $categories['Gaji Pokok']->id,
                'type' => 'income',
                'amount' => 6000000,
                'description' => 'Gaji bulanan PT Solusi Digital',
                'date' => $today->copy()->startOfMonth()->addDays(1)->format('Y-m-d'),
                'input_method' => 'manual',
                'voice_text' => null,
            ],
            [
                'account_id' => $accBCA->id,
                'category_id' => $categories['Freelance']->id,
                'type' => 'income',
                'amount' => 1000000,
                'description' => 'Pembayaran project landing page UI/UX',
                'date' => $today->copy()->subDays(6)->format('Y-m-d'),
                'input_method' => 'voice',
                'voice_text' => 'dapat uang dari freelance satu juta',
            ],
            [
                'account_id' => $accCash->id,
                'category_id' => $categories['Makanan & Minuman']->id,
                'type' => 'expense',
                'amount' => 25000,
                'description' => 'Makan siang nasi padang',
                'date' => $today->format('Y-m-d'),
                'input_method' => 'voice',
                'voice_text' => 'Saya mengeluarkan 25 ribu untuk makan siang',
            ],
            [
                'account_id' => $accBCA->id,
                'category_id' => $categories['Token & Listrik PLN']->id,
                'type' => 'expense',
                'amount' => 150000,
                'description' => 'Beli token listrik rumah',
                'date' => $today->copy()->subDays(2)->format('Y-m-d'),
                'input_method' => 'voice',
                'voice_text' => 'Bayar listrik 150 ribu',
            ],
            [
                'account_id' => $accCash->id,
                'category_id' => $categories['Transportasi']->id,
                'type' => 'expense',
                'amount' => 50000,
                'description' => 'Isi bensin pertalite',
                'date' => $today->copy()->subDays(3)->format('Y-m-d'),
                'input_method' => 'voice',
                'voice_text' => 'bayar bensin 50 ribu',
            ],
            [
                'account_id' => $accDana->id,
                'category_id' => $categories['Paket Data & Internet']->id,
                'type' => 'expense',
                'amount' => 150000,
                'description' => 'Langganan internet WiFi bulanan',
                'date' => $today->copy()->subDays(8)->format('Y-m-d'),
                'input_method' => 'manual',
                'voice_text' => null,
            ],
            [
                'account_id' => $accBCA->id,
                'category_id' => $categories['Belanja']->id,
                'type' => 'expense',
                'amount' => 450000,
                'description' => 'Belanja bulanan supermarket',
                'date' => $today->copy()->subDays(10)->format('Y-m-d'),
                'input_method' => 'manual',
                'voice_text' => null,
            ],
            [
                'account_id' => $accCash->id,
                'category_id' => $categories['Makanan & Minuman']->id,
                'type' => 'expense',
                'amount' => 20000,
                'description' => 'Beli nasi ayam geprek',
                'date' => $today->copy()->subDays(4)->format('Y-m-d'),
                'input_method' => 'voice',
                'voice_text' => 'tadi beli nasi 20 ribu',
            ],
            [
                'account_id' => $accBCA->id,
                'category_id' => $categories['Hiburan']->id,
                'type' => 'expense',
                'amount' => 65000,
                'description' => 'Nonton bioskop XXI',
                'date' => $today->copy()->subDays(5)->format('Y-m-d'),
                'input_method' => 'manual',
                'voice_text' => null,
            ],
        ];

        foreach ($sampleTransactions as $tx) {
            Transaction::create([
                'user_id' => $user->id,
                'account_id' => $tx['account_id'],
                'category_id' => $tx['category_id'],
                'type' => $tx['type'],
                'amount' => $tx['amount'],
                'description' => $tx['description'],
                'transaction_date' => $tx['date'],
                'input_method' => $tx['input_method'],
                'voice_text' => $tx['voice_text'],
            ]);
        }

        // Transfer transaction: Transfer BCA to Tabungan
        Transaction::create([
            'user_id' => $user->id,
            'account_id' => $accBCA->id,
            'to_account_id' => $accSavings->id,
            'category_id' => $categories['Tabungan']->id,
            'type' => 'transfer',
            'amount' => 500000,
            'description' => 'Sisihkan dana ke tabungan masa depan',
            'transaction_date' => $today->copy()->subDays(5)->format('Y-m-d'),
            'input_method' => 'voice',
            'voice_text' => 'transfer ke tabungan 500 ribu',
        ]);

        // 5. Budgets for current month
        Budget::create([
            'user_id' => $user->id,
            'category_id' => $categories['Makanan & Minuman']->id,
            'amount' => 800000,
            'month' => $thisMonth,
            'alert_threshold' => 80,
        ]);

        Budget::create([
            'user_id' => $user->id,
            'category_id' => $categories['Transportasi']->id,
            'amount' => 500000,
            'month' => $thisMonth,
            'alert_threshold' => 80,
        ]);

        Budget::create([
            'user_id' => $user->id,
            'category_id' => $categories['Belanja']->id,
            'amount' => 500000,
            'month' => $thisMonth,
            'alert_threshold' => 80,
        ]);

        Budget::create([
            'user_id' => $user->id,
            'category_id' => $categories['Tagihan & Utilitas']->id,
            'amount' => 400000,
            'month' => $thisMonth,
            'alert_threshold' => 85,
        ]);

        // 6. Savings Goals
        SavingsGoal::create([
            'user_id' => $user->id,
            'name' => 'Laptop Baru',
            'target_amount' => 8000000,
            'current_amount' => 3500000,
            'target_date' => '2026-12-31',
            'icon' => 'Laptop',
            'color' => '#2563EB',
            'notes' => 'Upgrade laptop untuk produktivitas kerja',
            'is_completed' => false,
        ]);

        SavingsGoal::create([
            'user_id' => $user->id,
            'name' => 'Dana Darurat 6 Bulan',
            'target_amount' => 15000000,
            'current_amount' => 7500000,
            'target_date' => '2027-06-30',
            'icon' => 'ShieldCheck',
            'color' => '#10B981',
            'notes' => 'Simpanan darurat aman',
            'is_completed' => false,
        ]);

        // 7. Notifications
        Notification::create([
            'user_id' => $user->id,
            'type' => 'budget_warning',
            'title' => 'Peringatan Anggaran',
            'message' => 'Budget kategori Makanan sudah terpakai 85%. Tetap jaga pengeluaran Anda.',
            'is_read' => false,
            'data' => ['category' => 'Makanan & Minuman', 'percentage' => 85],
        ]);

        Notification::create([
            'user_id' => $user->id,
            'type' => 'savings_reached',
            'title' => 'Progress Tabungan',
            'message' => 'Target tabungan Laptop Baru telah terkumpul 43.75%! Tinggal Rp 4.500.000 lagi.',
            'is_read' => true,
            'data' => ['goal' => 'Laptop Baru', 'progress' => 43.75],
        ]);

        Notification::create([
            'user_id' => $user->id,
            'type' => 'reminder',
            'title' => 'Catat Keuangan Harian',
            'message' => 'Gunakan suara untuk mencatat transaksi hari ini dengan cepat: "Catat pengeluaran..."',
            'is_read' => false,
            'data' => [],
        ]);

        // 8. User Settings
        Setting::create([
            'user_id' => $user->id,
            'key' => 'currency',
            'value' => 'IDR',
        ]);
        Setting::create([
            'user_id' => $user->id,
            'key' => 'theme',
            'value' => 'dark',
        ]);
    }
}
