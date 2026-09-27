<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Category;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VoiceParserController extends Controller
{
    /**
     * Parse Indonesian spoken sentence into structured transaction preview.
     */
    public function parse(Request $request): JsonResponse
    {
        $request->validate([
            'text' => 'required|string|max:500',
        ]);

        $user = $request->user();
        $text = trim($request->text);
        $lower = strtolower($text);

        // 1. Determine Type (income, expense, transfer)
        $type = 'expense'; // default
        if (preg_match('/\b(transfer|kirim|pindah|oper)\b/i', $lower)) {
            $type = 'transfer';
        } elseif (preg_match('/\b(masuk|dapat|gaji|terima|pemasukan|penjualan|untung|cair|honor|freelance|bonus|hadiah|hasil)\b/i', $lower)) {
            $type = 'income';
        } elseif (preg_match('/\b(keluar|beli|bayar|ongkos|makan|bensin|belanja|jajan|pengeluaran|tagihan|isi|sewa|tarik)\b/i', $lower)) {
            $type = 'expense';
        }

        // 2. Extract Amount
        $amount = $this->extractAmount($lower);

        // 3. Match Category
        $categories = Category::where('user_id', $user->id)
            ->orWhereNull('user_id')
            ->get();

        $matchedCategory = $this->matchCategory($lower, $categories, $type);

        // 4. Determine Accounts
        $accounts = Account::where('user_id', $user->id)
            ->where('is_active', true)
            ->get();

        $defaultAccount = $accounts->firstWhere('type', 'cash') ?? $accounts->first();
        $toAccount = null;

        if ($type === 'transfer') {
            // Find target account (e.g., tabungan, bca, dana)
            foreach ($accounts as $acc) {
                if (stripos($lower, strtolower($acc->name)) !== false || stripos($lower, strtolower($acc->type)) !== false) {
                    $toAccount = $acc;
                    break;
                }
            }
            if (! $toAccount) {
                $toAccount = $accounts->firstWhere('type', 'savings') ?? $accounts->last();
            }
        }

        // 5. Build Description
        $description = $this->cleanDescription($text, $amount);

        // 6. Check for Clarifications
        $questions = [];
        if (! $amount || $amount <= 0) {
            $questions[] = 'Berapa nominal transaksinya?';
        }
        if (! $matchedCategory && $type !== 'transfer') {
            $questions[] = 'Transaksi ini termasuk kategori apa?';
        }

        return response()->json([
            'raw_text' => $text,
            'parsed' => [
                'type' => $type,
                'amount' => $amount,
                'category_id' => $matchedCategory ? $matchedCategory->id : null,
                'category' => $matchedCategory,
                'account_id' => $defaultAccount ? $defaultAccount->id : null,
                'account' => $defaultAccount,
                'to_account_id' => $toAccount ? $toAccount->id : null,
                'to_account' => $toAccount,
                'description' => $description,
                'transaction_date' => Carbon::now()->format('Y-m-d'),
                'confidence' => ($amount > 0 && ($matchedCategory || $type === 'transfer')) ? 0.95 : 0.60,
            ],
            'needs_clarification' => ! empty($questions),
            'clarification_questions' => $questions,
        ]);
    }

    /**
     * Extract nominal rupiah from text.
     */
    private function extractAmount(string $text): ?float
    {
        // Replace Indonesian words with numbers
        $wordMap = [
            'setengah juta' => '500000',
            'sejuta' => '1000000',
            'seribu' => '1000',
            'dua puluh lima ribu' => '25000',
            'lima puluh ribu' => '50000',
            'tiga puluh ribu' => '30000',
            'tujuh puluh lima ribu' => '75000',
            'seratus ribu' => '100000',
            'dua ratus ribu' => '200000',
            'tiga ratus ribu' => '300000',
            'lima ratus ribu' => '500000',
            'satu juta' => '1000000',
            'dua juta' => '2000000',
            'tiga juta' => '3000000',
            'empat juta' => '4000000',
            'lima juta' => '5000000',
            'sepuluh juta' => '10000000',
        ];

        foreach ($wordMap as $word => $val) {
            if (str_contains($text, $word)) {
                return (float) $val;
            }
        }

        // Pattern: "1.5 juta" or "1,5 juta" or "2 juta"
        if (preg_match('/(\d+(?:[\.,]\d+)?)\s*(?:juta|jt|jutaan)\b/i', $text, $matches)) {
            $num = (float) str_replace(',', '.', $matches[1]);
            return $num * 1000000;
        }

        // Pattern: "500k" or "25k"
        if (preg_match('/(\d+(?:[\.,]\d+)?)\s*k\b/i', $text, $matches)) {
            $num = (float) str_replace(',', '.', $matches[1]);
            return $num * 1000;
        }

        // Pattern: "25 ribu" or "25rb" or "50 ribu"
        if (preg_match('/(\d+(?:[\.,]\d+)?)\s*(?:ribu|rb)\b/i', $text, $matches)) {
            $num = (float) str_replace(',', '.', $matches[1]);
            return $num * 1000;
        }

        // Pattern: "Rp 50.000" or "Rp. 50.000" or "Rp25000"
        if (preg_match('/(?:rp\.?|idr)\s*([\d\.,]+)/i', $text, $matches)) {
            $clean = preg_replace('/[^\d]/', '', $matches[1]);
            if (is_numeric($clean)) {
                return (float) $clean;
            }
        }

        // Pattern standalone formatted number: "50.000" or "150000"
        if (preg_match('/\b\d{1,3}(?:\.\d{3})+\b/', $text, $matches)) {
            return (float) str_replace('.', '', $matches[0]);
        }

        if (preg_match('/\b(\d{4,9})\b/', $text, $matches)) {
            return (float) $matches[1];
        }

        return null;
    }

    /**
     * Match text against categories.
     */
    private function matchCategory(string $text, $categories, string $type)
    {
        $keywordsMap = [
            'Makanan & Minuman' => ['makan', 'minum', 'nasi', 'kopi', 'sarapan', 'siang', 'malam', 'ayam', 'bakso', 'resto', 'warung', 'cafe', 'food', 'snack', 'jajan', 'kuliner', 'gofood', 'shopeefood', 'grabfood'],
            'Transportasi' => ['bensin', 'pertalite', 'pertamax', 'solar', 'parkir', 'tol', 'gojek', 'grab', 'ojol', 'taksi', 'kereta', 'krl', 'mrt', 'busway', 'angkot', 'kendaraan', 'motor', 'mobil', 'tambal ban'],
            'Token & Listrik PLN' => ['listrik', 'pln', 'token'],
            'Paket Data & Internet' => ['internet', 'wifi', 'indihome', 'pulsa', 'kuota', 'paket data', 'telkomsel', 'xl', 'indosat', 'biznet', 'firstmedia'],
            'Belanja' => ['belanja', 'supermarket', 'mall', 'baju', 'celana', 'sepatu', 'tokopedia', 'shopee', 'lazada', 'tiktok shop', 'minimarket', 'indomaret', 'alfamart'],
            'Rumah & Tempat Tinggal' => ['rumah', 'kost', 'kontrakan', 'sewa', 'pdam', 'air', 'ipl', 'renovasi', 'genteng', 'kasur'],
            'Tagihan & Utilitas' => ['tagihan', 'iuran', 'pajak', 'bpjs', 'asuransi', 'cicilan', 'kartu kredit'],
            'Kesehatan' => ['obat', 'dokter', 'klinik', 'rumah sakit', 'vitamin', 'apotek', 'periksa', 'gigi', 'medis'],
            'Pendidikan' => ['sekolah', 'kursus', 'kuliah', 'spp', 'buku', 'seminar', 'pelatihan', 'ujian', 'les'],
            'Hiburan' => ['nonton', 'bioskop', 'game', 'steam', 'netflix', 'spotify', 'jalan-jalan', 'liburan', 'karaoke', 'wisata'],
            'Gaji Pokok' => ['gaji', 'salary', 'payroll', 'upah', 'bulanan masuk'],
            'Freelance' => ['freelance', 'proyek', 'project', 'klien', 'client', 'side job', 'desain', 'coding'],
            'Bisnis & Penjualan' => ['bisnis', 'jualan', 'omzet', 'toko', 'laba', 'dagang', 'penjualan'],
            'Investasi & Dividen' => ['investasi', 'dividen', 'reksadana', 'saham', 'crypto', 'emas', 'sukuk', 'obligasi', 'bibit', 'bareksa'],
            'Tabungan' => ['tabungan', 'nabung', 'simpanan', 'deposito'],
        ];

        foreach ($keywordsMap as $categoryName => $words) {
            foreach ($words as $word) {
                if (preg_match('/\b' . preg_quote($word, '/') . '\b/i', $text)) {
                    $found = $categories->first(function ($c) use ($categoryName) {
                        return stripos($c->name, $categoryName) !== false || stripos($categoryName, $c->name) !== false;
                    });
                    if ($found) {
                        return $found;
                    }
                }
            }
        }

        // Direct match with category name
        foreach ($categories as $cat) {
            if (stripos($text, strtolower($cat->name)) !== false) {
                return $cat;
            }
        }

        // Default category fallback based on type
        if ($type === 'income') {
            return $categories->firstWhere('type', 'income') ?? $categories->firstWhere('name', 'Lainnya');
        }

        return $categories->firstWhere('name', 'Lainnya') ?? $categories->first();
    }

    /**
     * Clean and format readable transaction description.
     */
    private function cleanDescription(string $text, ?float $amount): string
    {
        $desc = $text;

        // Remove prefix phrases like "Saya mengeluarkan", "tadi", "tolong catat"
        $desc = preg_replace('/^(saya\s+(mengeluarkan|dapat|bayar|beli)|tadi\s+|tolong\s+catat\s+|catat\s+)/i', '', $desc);
        $desc = trim($desc);

        return ucfirst($desc);
    }
}
