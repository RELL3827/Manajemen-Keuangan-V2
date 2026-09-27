import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Lock,
  Mail, RefreshCw, Server, Sparkles, User, Wallet, Wifi
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { api, ApiError } from '@/services/api';

type Mode = 'login' | 'register' | 'forgot';

export default function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const { setUser } = useApp();
  const [mode, setMode] = useState<Mode>('login');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Server connection state
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrl, setServerUrlInput] = useState(api.getServerUrl());
  const [serverConnected, setServerConnected] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    api.testConnection().then(res => {
      setServerConnected(res.ok);
    });
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await api.testConnection(serverUrl);
    setTesting(false);
    setTestResult(res);
    setServerConnected(res.ok);
  };

  const handleSaveServer = () => {
    api.setServerUrl(serverUrl);
    setTestResult({ ok: true, message: 'Pengaturan server disimpan!' });
  };

  const [form, setForm] = useState({
    name: '',
    email: 'demo@earnvoice.app',
    password: 'password',
    password_confirmation: '',
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const { user } = await api.login({ email: form.email, password: form.password });
        setUser(user);
        onSuccess();
      } else if (mode === 'register') {
        if (form.password !== form.password_confirmation) {
          setError('Konfirmasi password tidak cocok.');
          return;
        }
        const { user } = await api.register({
          name: form.name,
          email: form.email,
          password: form.password,
          password_confirmation: form.password_confirmation,
        });
        setUser(user);
        onSuccess();
      } else {
        const msg = await api.forgotPassword(form.email);
        setSuccessMsg(msg || 'Email instruksi reset telah dikirim.');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan. Periksa koneksi internet Anda.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setForm(f => ({
      ...f,
      email: 'demo@earnvoice.app',
      password: 'password',
    }));
    setError('');
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-fintech-bg text-fintech-text">
      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Wallet size={24} strokeWidth={2.2} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-fintech-text">EarnVoice</h1>
          <p className="text-xs text-fintech-muted mt-1">Catat Keuangan Semudah Bicara</p>
        </div>

        {/* Card */}
        <div className="card-clean p-6">
          {/* Quick Demo Fill Pill */}
          {mode === 'login' && (
            <div className="mb-4 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-blue-400" />
                <span className="text-xs text-blue-300 font-medium">Akun Demo Siap Pakai</span>
              </div>
              <button
                type="button"
                onClick={handleFillDemo}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 hover:underline"
              >
                Gunakan
              </button>
            </div>
          )}

          {/* Mode Tabs */}
          {mode !== 'forgot' && (
            <div className="flex p-0.5 bg-fintech-bg rounded-xl border border-fintech-border mb-5">
              {(['login', 'register'] as Mode[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(''); setSuccessMsg(''); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    mode === m
                      ? 'bg-fintech-card text-fintech-text shadow-sm'
                      : 'text-fintech-muted hover:text-fintech-text'
                  }`}
                >
                  {m === 'login' ? 'Masuk' : 'Daftar Akun'}
                </button>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.12 }}
              onSubmit={handleSubmit}
              className="space-y-3.5"
            >
              {mode === 'register' && (
                <div>
                  <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Nama Lengkap</label>
                  <div className="relative">
                    <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fintech-muted" />
                    <input
                      type="text"
                      placeholder="Nama Anda"
                      value={form.name}
                      onChange={e => set('name', e.target.value)}
                      required
                      className="input-field pl-9 text-xs"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Email</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fintech-muted" />
                  <input
                    type="email"
                    placeholder="nama@email.com"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    required
                    className="input-field pl-9 text-xs"
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div>
                  <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fintech-muted" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                      required
                      className="input-field pl-9 pr-9 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-fintech-muted hover:text-fintech-text"
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'register' && (
                <div>
                  <label className="text-[11px] font-medium text-fintech-muted mb-1 block">Konfirmasi Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fintech-muted" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={form.password_confirmation}
                      onChange={e => set('password_confirmation', e.target.value)}
                      required
                      className="input-field pl-9 text-xs"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 text-rose-400 text-xs">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 text-emerald-400 text-xs">
                  {successMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-2.5 text-xs flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                <span>
                  {loading
                    ? 'Memproses...'
                    : mode === 'login'
                    ? 'Masuk ke Akun'
                    : mode === 'register'
                    ? 'Daftar Sekarang'
                    : 'Kirim Link Reset'}
                </span>
              </button>

              {mode === 'login' && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setError(''); }}
                    className="text-[11px] text-fintech-muted hover:text-blue-400 transition-colors"
                  >
                    Lupa password?
                  </button>
                </div>
              )}

              {mode === 'forgot' && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                    className="text-[11px] text-fintech-muted hover:text-fintech-text transition-colors"
                  >
                    ← Kembali ke Login
                  </button>
                </div>
              )}
            </motion.form>
          </AnimatePresence>
        </div>

        {/* Server Connection Pill & Settings */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setShowServerModal(!showServerModal)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-fintech-card border border-fintech-border text-[11px] text-fintech-muted hover:text-fintech-text hover:border-fintech-muted/40 transition-all shadow-sm"
          >
            <Server size={12} className={serverConnected ? "text-emerald-400" : "text-amber-400"} />
            <span>Koneksi Server</span>
            <span className={`w-1.5 h-1.5 rounded-full ${serverConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
          </button>
        </div>

        {showServerModal && (
          <div className="card-clean p-4 mt-3 border border-blue-500/30 bg-fintech-card/95 text-left text-xs space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-fintech-border">
              <span className="font-semibold text-fintech-text flex items-center gap-1.5">
                <Wifi size={13} className="text-blue-400" /> Pengaturan Server (HP ↔ PC)
              </span>
              <button
                type="button"
                onClick={() => setShowServerModal(false)}
                className="text-[11px] text-fintech-muted hover:text-fintech-text"
              >
                Tutup
              </button>
            </div>

            <div>
              <label className="text-[11px] text-fintech-muted block mb-1">URL Server Backend PC:</label>
              <input
                type="text"
                value={serverUrl}
                onChange={e => setServerUrlInput(e.target.value)}
                placeholder="http://172.20.10.3:8000"
                className="input-clean text-xs py-1.5 font-mono"
              />
              <span className="text-[10px] text-fintech-muted/80 block mt-1">
                Gunakan IP Wi-Fi PC jika membuka dari HP Android.
              </span>
            </div>

            {testResult && (
              <div className={`p-2 rounded-lg text-[11px] flex items-center gap-1.5 ${
                testResult.ok
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {testResult.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                <span>{testResult.message}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={testing}
                onClick={handleTestConnection}
                className="flex-1 py-1.5 px-3 rounded-lg bg-fintech-border/50 hover:bg-fintech-border text-[11px] font-medium text-fintech-text flex items-center justify-center gap-1.5 transition-colors"
              >
                {testing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                <span>Tes Koneksi</span>
              </button>
              <button
                type="button"
                onClick={handleSaveServer}
                className="py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-[11px] font-medium text-white transition-colors"
              >
                Simpan
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-[11px] text-fintech-muted/60 mt-4">
          EarnVoice · PWA Keuangan Pribadi & Keluarga
        </p>
      </div>
    </div>
  );
}
