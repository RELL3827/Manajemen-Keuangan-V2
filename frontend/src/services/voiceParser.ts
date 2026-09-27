import { Account, Category, TransactionType, VoiceParsedResult } from '@/types';

export function parseVoiceText(
  rawText: string,
  accounts: Account[] = [],
  categories: Category[] = []
): VoiceParsedResult {
  const { parsed } = parseIndonesianVoice(rawText, categories);
  if (accounts && accounts.length > 0) {
    const lower = rawText.toLowerCase();
    for (const acc of accounts) {
      if (lower.includes(acc.name.toLowerCase())) {
        parsed.account_id = acc.id;
        break;
      }
    }
  }
  return parsed;
}

export function parseIndonesianVoice(
  rawText: string,
  categories: Category[] = []
): {
  parsed: VoiceParsedResult;
  needsClarification: boolean;
  clarificationQuestions: string[];
} {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  // 1. Determine Type
  let type: TransactionType = 'expense';
  if (/\b(transfer|kirim|pindah|oper|setor)\b/i.test(lower)) {
    type = 'transfer';
  } else if (/\b(masuk|dapat|gaji|terima|pemasukan|penjualan|untung|cair|honor|freelance|bonus|hadiah|hasil|omzet)\b/i.test(lower)) {
    type = 'income';
  } else if (/\b(keluar|beli|bayar|ongkos|makan|bensin|belanja|jajan|pengeluaran|tagihan|isi|sewa|tarik)\b/i.test(lower)) {
    type = 'expense';
  }

  // 2. Extract Amount
  const amount = extractAmount(lower);

  // 3. Match Category
  const matchedCategory = matchCategory(lower, categories, type);

  // 4. Clean Description
  const description = cleanDescription(text);

  // 5. Today's date YYYY-MM-DD
  const today = new Date().toISOString().split('T')[0];

  // 6. Clarification check
  const questions: string[] = [];
  if (!amount || amount <= 0) {
    questions.push('Berapa nominal transaksinya?');
  }
  if (!matchedCategory && type !== 'transfer') {
    questions.push('Transaksi ini termasuk kategori apa?');
  }

  const confidence = (amount && (matchedCategory || type === 'transfer')) ? 0.95 : (amount ? 0.75 : 0.5);

  return {
    parsed: {
      type,
      amount,
      category_id: matchedCategory ? matchedCategory.id : null,
      category: matchedCategory || null,
      account_id: null,
      to_account_id: null,
      description,
      transaction_date: today,
      confidence,
    },
    needsClarification: questions.length > 0,
    clarificationQuestions: questions,
  };
}

function extractAmount(text: string): number | null {
  // Phrase dictionary
  const phraseMap: Record<string, number> = {
    'setengah juta': 500000,
    'sejuta': 1000000,
    'seribu': 1000,
    'dua puluh lima ribu': 25000,
    'lima puluh ribu': 50000,
    'tiga puluh ribu': 30000,
    'tujuh puluh lima ribu': 75000,
    'seratus ribu': 100000,
    'dua ratus ribu': 200000,
    'tiga ratus ribu': 300000,
    'lima ratus ribu': 500000,
    'satu juta': 1000000,
    'dua juta': 2000000,
    'tiga juta': 3000000,
    'empat juta': 4000000,
    'lima juta': 5000000,
    'sepuluh juta': 10000000,
  };

  for (const [phrase, val] of Object.entries(phraseMap)) {
    if (text.includes(phrase)) {
      return val;
    }
  }

  // Regex patterns:
  // "1.5 juta", "1,5 juta", "2 juta", "3.2 jt"
  const jtMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:juta|jt|jutaan)\b/i);
  if (jtMatch) {
    const num = parseFloat(jtMatch[1].replace(',', '.'));
    return Math.round(num * 1000000);
  }

  // "500k", "25k"
  const kMatch = text.match(/(\d+(?:[.,]\d+)?)\s*k\b/i);
  if (kMatch) {
    const num = parseFloat(kMatch[1].replace(',', '.'));
    return Math.round(num * 1000);
  }

  // "25 ribu", "25rb", "50 ribu"
  const rbMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:ribu|rb)\b/i);
  if (rbMatch) {
    const num = parseFloat(rbMatch[1].replace(',', '.'));
    return Math.round(num * 1000);
  }

  // "Rp 50.000", "Rp. 50.000", "Rp25000"
  const rpMatch = text.match(/(?:rp\.?|idr)\s*([\d.,]+)/i);
  if (rpMatch) {
    const clean = rpMatch[1].replace(/[^\d]/g, '');
    const num = parseInt(clean, 10);
    if (!isNaN(num) && num > 0) return num;
  }

  // Standalone dot formatted number: "50.000" or "150.000"
  const dotMatch = text.match(/\b\d{1,3}(?:\.\d{3})+\b/);
  if (dotMatch) {
    const clean = dotMatch[0].replace(/\./g, '');
    return parseInt(clean, 10);
  }

  // Standalone 4+ digit number: "25000", "500000"
  const numMatch = text.match(/\b(\d{4,9})\b/);
  if (numMatch) {
    return parseInt(numMatch[1], 10);
  }

  return null;
}

function matchCategory(text: string, categories: Category[], type: TransactionType): Category | null {
  const keywordsMap: Record<string, string[]> = {
    'Makanan & Minuman': ['makan', 'minum', 'nasi', 'kopi', 'sarapan', 'siang', 'malam', 'ayam', 'bakso', 'resto', 'warung', 'cafe', 'food', 'snack', 'jajan', 'kuliner', 'gofood', 'shopeefood', 'grabfood'],
    'Transportasi': ['bensin', 'pertalite', 'pertamax', 'solar', 'parkir', 'tol', 'gojek', 'grab', 'ojol', 'taksi', 'kereta', 'krl', 'mrt', 'busway', 'angkot', 'kendaraan', 'motor', 'mobil', 'tambal ban'],
    'Token & Listrik PLN': ['listrik', 'pln', 'token'],
    'Paket Data & Internet': ['internet', 'wifi', 'indihome', 'pulsa', 'kuota', 'paket data', 'telkomsel', 'xl', 'indosat', 'biznet', 'firstmedia'],
    'Belanja': ['belanja', 'supermarket', 'mall', 'baju', 'celana', 'sepatu', 'tokopedia', 'shopee', 'lazada', 'tiktok shop', 'minimarket', 'indomaret', 'alfamart'],
    'Rumah & Tempat Tinggal': ['rumah', 'kost', 'kontrakan', 'sewa', 'pdam', 'air', 'ipl', 'renovasi', 'genteng', 'kasur'],
    'Tagihan & Utilitas': ['tagihan', 'iuran', 'pajak', 'bpjs', 'asuransi', 'cicilan', 'kartu kredit'],
    'Kesehatan': ['obat', 'dokter', 'klinik', 'rumah sakit', 'vitamin', 'apotek', 'periksa', 'gigi', 'medis'],
    'Pendidikan': ['sekolah', 'kursus', 'kuliah', 'spp', 'buku', 'seminar', 'pelatihan', 'ujian', 'les'],
    'Hiburan': ['nonton', 'bioskop', 'game', 'steam', 'netflix', 'spotify', 'jalan-jalan', 'liburan', 'karaoke', 'wisata'],
    'Gaji Pokok': ['gaji', 'salary', 'payroll', 'upah', 'bulanan masuk'],
    'Freelance': ['freelance', 'proyek', 'project', 'klien', 'client', 'side job', 'desain', 'coding'],
    'Bisnis & Penjualan': ['bisnis', 'jualan', 'omzet', 'toko', 'laba', 'dagang', 'penjualan'],
    'Investasi & Dividen': ['investasi', 'dividen', 'reksadana', 'saham', 'crypto', 'emas', 'sukuk', 'obligasi', 'bibit', 'bareksa'],
    'Tabungan': ['tabungan', 'nabung', 'simpanan', 'deposito'],
  };

  for (const [categoryName, keywords] of Object.entries(keywordsMap)) {
    for (const kw of keywords) {
      const reg = new RegExp(`\\b${kw}\\b`, 'i');
      if (reg.test(text)) {
        const found = categories.find((c) =>
          c.name.toLowerCase().includes(categoryName.toLowerCase()) ||
          categoryName.toLowerCase().includes(c.name.toLowerCase())
        );
        if (found) return found;
      }
    }
  }

  // Exact category name substring match
  for (const cat of categories) {
    if (text.toLowerCase().includes(cat.name.toLowerCase())) {
      return cat;
    }
  }

  // Fallbacks
  if (type === 'income') {
    return categories.find((c) => c.type === 'income') || categories.find((c) => c.name.includes('Lainnya')) || null;
  }

  return categories.find((c) => c.name.includes('Lainnya')) || (categories.length > 0 ? categories[0] : null);
}

function cleanDescription(text: string): string {
  let desc = text;
  // Clean prefixes
  desc = desc.replace(/^(saya\s+(mengeluarkan|dapat|bayar|beli)|tadi\s+|tolong\s+catat\s+|catat\s+)/i, '');
  desc = desc.trim();
  if (!desc) return 'Transaksi';
  return desc.charAt(0).toUpperCase() + desc.slice(1);
}
