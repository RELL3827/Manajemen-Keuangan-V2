import { motion } from 'framer-motion';
import {
  CheckCircle2, Database, Loader2, Lock,
  Moon, Save, Sun, Trash2, User
} from 'lucide-react';
import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { api, ApiError } from '@/services/api';

export default function SettingsPage() {
  const { user, setUser, theme, toggleTheme } = useApp();
  const [activeSection, setActiveSection] = useState<'profile' | 'password' | 'data'>('profile');

  // Profile form
  const [profile, setProfile] = useState({ name: user?.name ?? '', email: user?.email ?? '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password form
  const [pw, setPw] = useState({ current_password: '', new_password: '', new_password_confirmation: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

  // Cache clear
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState('');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileMsg('');
    setProfileLoading(true);
    try {
      const updated = await api.updateProfile({ name: profile.name });
      setUser(updated);
      setProfileMsg('Profil berhasil diperbarui.');
    } catch (err) {
      if (err instanceof ApiError) setProfileError(err.message);
      else setProfileError('Gagal memperbarui profil.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwMsg('');
    if (pw.new_password !== pw.new_password_confirmation) {
      setPwError('Konfirmasi password baru tidak cocok.');
      return;
    }
    setPwLoading(true);
    try {
      await api.updatePassword({
        current_password: pw.current_password,
        password: pw.new_password,
        password_confirmation: pw.new_password_confirmation,
      });
      setPwMsg('Password berhasil diubah.');
      setPw({ current_password: '', new_password: '', new_password_confirmation: '' });
    } catch (err) {
      if (err instanceof ApiError) setPwError(err.message);
      else setPwError('Password saat ini salah atau gagal diubah.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Hapus seluruh cache data offline?')) return;
    setClearing(true);
    try {
      const { offlineDB } = await import('@/services/db');
      await offlineDB.clearAllCache();
      setClearMsg('Cache offline berhasil dibersihkan.');
    } catch {
      setClearMsg('Cache dibersihkan.');
    } finally {
      setClearing(false);
    }
  };

  const sections = [
    { id: 'profile', label: 'Profil Akun', Icon: User },
    { id: 'password', label: 'Keamanan Sandi', Icon: Lock },
    { id: 'data', label: 'Data & Offline', Icon: Database },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-fintech-muted">Pengaturan</h2>
        <p className="text-xs text-fintech-text">Kelola profil, keamanan, dan preferensi aplikasi</p>
      </div>

      {/* User Info Card */}
      <div className="card-clean p-4 flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-xl bg-blue-600/15 border border-blue-500/25 flex items-center justify-center text-base font-bold text-blue-400 shrink-0">
          {user?.name?.[0]?.toUpperCase() ?? 'U'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-fintech-text truncate">{user?.name}</p>
          <p className="text-xs text-fintech-muted truncate">{user?.email}</p>
        </div>
      </div>

      {/* Theme Preference */}
      <div className="card-clean p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {theme === 'dark' ? <Moon size={16} className="text-blue-400" /> : <Sun size={16} className="text-amber-400" />}
          <div>
            <p className="text-xs font-semibold text-fintech-text">Mode Tampilan</p>
            <p className="text-[11px] text-fintech-muted">{theme === 'dark' ? 'Tema Gelap aktif' : 'Tema Terang aktif'}</p>
          </div>
        </div>
        <button
          onClick={toggleTheme}
          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          <span>{theme === 'dark' ? 'Ganti ke Terang' : 'Ganti ke Gelap'}</span>
        </button>
      </div>

      {/* Section Tabs */}
      <div className="flex p-0.5 bg-fintech-bg rounded-xl border border-fintech-border">
        {sections.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === id ? 'bg-fintech-card text-fintech-text shadow-sm' : 'text-fintech-muted hover:text-fintech-text'
            }`}
          >
            <Icon size={13} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Profile Section */}
      {activeSection === 'profile' && (
        <motion.form
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSaveProfile}
          className="card-clean p-4 space-y-3.5"
        >
          <div>
            <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Nama Lengkap</label>
            <input
              type="text"
              value={profile.name}
              onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
              className="input-field text-xs"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Alamat Email</label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="input-field text-xs opacity-50 cursor-not-allowed"
            />
            <p className="text-[10px] text-fintech-muted mt-0.5">Email akun tidak dapat diubah</p>
          </div>

          {profileMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 text-emerald-400 text-xs flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              <span>{profileMsg}</span>
            </div>
          )}

          {profileError && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 text-rose-400 text-xs">
              {profileError}
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={profileLoading}
              className="btn-primary text-xs flex items-center gap-1.5 py-2 px-4"
            >
              {profileLoading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span>Simpan Profil</span>
            </button>
          </div>
        </motion.form>
      )}

      {/* Password Section */}
      {activeSection === 'password' && (
        <motion.form
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleChangePassword}
          className="card-clean p-4 space-y-3.5"
        >
          <div>
            <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Password Saat Ini</label>
            <input
              type="password"
              placeholder="••••••••"
              value={pw.current_password}
              onChange={e => setPw(p => ({ ...p, current_password: e.target.value }))}
              className="input-field text-xs"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Password Baru</label>
            <input
              type="password"
              placeholder="Minimal 8 karakter"
              value={pw.new_password}
              onChange={e => setPw(p => ({ ...p, new_password: e.target.value }))}
              className="input-field text-xs"
              minLength={8}
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Konfirmasi Password Baru</label>
            <input
              type="password"
              placeholder="Ulangi password baru"
              value={pw.new_password_confirmation}
              onChange={e => setPw(p => ({ ...p, new_password_confirmation: e.target.value }))}
              className="input-field text-xs"
              required
            />
          </div>

          {pwMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 text-emerald-400 text-xs flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              <span>{pwMsg}</span>
            </div>
          )}

          {pwError && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 text-rose-400 text-xs">
              {pwError}
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={pwLoading}
              className="btn-primary text-xs flex items-center gap-1.5 py-2 px-4"
            >
              {pwLoading ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
              <span>Ubah Password</span>
            </button>
          </div>
        </motion.form>
      )}

      {/* Data & Privacy Section */}
      {activeSection === 'data' && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-clean p-4 space-y-4"
        >
          <div>
            <p className="text-xs font-semibold text-fintech-text">Penyimpanan Offline (IndexedDB)</p>
            <p className="text-[11px] text-fintech-muted mt-0.5 leading-relaxed">
              EarnVoice menyimpan salinan lokal transaksi agar dapat diakses tanpa koneksi internet. Anda dapat membersihkan cache sewaktu-waktu.
            </p>
          </div>

          {clearMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 text-emerald-400 text-xs flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              <span>{clearMsg}</span>
            </div>
          )}

          <div>
            <button
              onClick={handleClearCache}
              disabled={clearing}
              className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 text-rose-400 hover:text-rose-300"
            >
              <Trash2 size={13} />
              <span>{clearing ? 'Membersihkan...' : 'Bersihkan Cache Offline'}</span>
            </button>
          </div>

          <div className="pt-3 border-t border-fintech-border/50 text-[11px] text-fintech-muted/70">
            EarnVoice v1.0.0 · Progressive Web App
          </div>
        </motion.div>
      )}
    </div>
  );
}
