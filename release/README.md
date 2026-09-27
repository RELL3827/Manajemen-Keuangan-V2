# Panduan Instalasi & Penggunaan EarnVoice (Android & Windows)

Aplikasi **EarnVoice** telah berhasil dikompilasi ke dalam versi standalone untuk **Android** dan **Windows**.

---

## 📱 1. Versi Android (APK)

### File Lokasi:
- **`release/EarnVoice-Android.apk`** (atau `release/android/EarnVoice.apk`)
- Ukuran: ~4.4 MB

### Cara Install di HP / Tablet Android:
1. **Transfer File APK** ke perangkat Android Anda (melalui kabel USB, WhatsApp Web, Google Drive, atau Bluetooth).
2. Di HP Android, buka file manager dan ketuk **`EarnVoice-Android.apk`**.
3. Jika muncul peringatan *"Install from unknown sources"* (Instal dari sumber tidak dikenal), izinkan untuk browser / file manager Anda.
4. Klik **Install** dan buka aplikasinya.
5. **Izin Mikrofon:** Saat pertama kali menggunakan fitur suara / voice note, izinkan akses Mikrofon agar aplikasi dapat mendengarkan ucapan transaksi Anda secara real-time.

### Koneksi ke Backend:
- Aplikasi Android sudah diatur untuk otomatis terhubung ke IP Wi-Fi lokal PC Anda (`http://172.20.10.3:8000/api`).
- Pastikan HP Android terhubung ke jaringan Wi-Fi yang sama dengan PC tempat backend berjalan.
- **Mode Offline:** Jika tidak ada jaringan atau server sedang mati, EarnVoice tetap dapat digunakan secara offline dengan penyimpanan lokal (IndexedDB) dan akan sinkronisasi otomatis saat terhubung kembali.

---

## 💻 2. Versi Windows (Desktop App)

### File Lokasi:
- **`release/windows/EarnVoice.exe`**
- Folder pendukung: `release/windows/app/`

### Cara Menjalankan:
1. Buka folder `release\windows\`.
2. Klik ganda pada **`EarnVoice.exe`**.
3. Aplikasi akan langsung terbuka dalam jendela desktop mandiri (*Standalone Window*, tanpa address bar / toolbar browser).
4. **Opsional (Buat Shortcut Desktop):**
   - Klik ganda file **`Install-Shortcut.bat`** di folder `release\windows\`.
   - Shortcut **EarnVoice** dengan icon resmi akan langsung dibuat di **Desktop** dan **Start Menu** Windows Anda!

---

## 🌐 3. Menjalankan Server Backend

Pastikan backend Laravel tetap berjalan saat menggunakan aplikasi:
```powershell
cd backend
php artisan serve --host=0.0.0.0 --port=8000
```
*(Catatan: `EarnVoice.exe` di Windows juga dapat secara otomatis menyalakan backend di latar belakang jika belum aktif).*
