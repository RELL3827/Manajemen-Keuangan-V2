import { AnimatePresence, motion } from 'framer-motion';
import { Mic, Plus } from 'lucide-react';
import { useState } from 'react';
import { AppProvider, useApp } from '@/contexts/AppContext';
import Layout from '@/components/Layout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import TransactionsPage from '@/pages/TransactionsPage';
import { AccountsPage } from '@/pages/AccountsPage';
import BudgetsPage from '@/pages/BudgetsPage';
import SavingsPage from '@/pages/SavingsPage';
import ReportsPage from '@/pages/ReportsPage';
import SettingsPage from '@/pages/SettingsPage';
import './index.css';

// ─────────────────────────────────────────────
//  Inner App (requires AppContext)
// ─────────────────────────────────────────────
function InnerApp() {
  const { user, setUser } = useApp();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [openVoice, setOpenVoice] = useState(false);
  const [openForm, setOpenForm] = useState(false);

  if (!user) {
    return <LoginPage onSuccess={() => {}} />;
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardPage
            onAddTransaction={() => { setActiveTab('transactions'); setOpenForm(true); }}
            onVoiceInput={() => { setActiveTab('transactions'); setOpenVoice(true); }}
            onNavigate={setActiveTab}
          />
        );
      case 'transactions':
        return (
          <TransactionsPage
            openVoice={openVoice}
            openForm={openForm}
            onCloseVoice={() => setOpenVoice(false)}
            onCloseForm={() => setOpenForm(false)}
          />
        );
      case 'accounts':
        return <AccountsPage />;
      case 'budgets':
        return <BudgetsPage />;
      case 'savings':
        return <SavingsPage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
      case 'profile':
        return <SettingsPage />;
      default:
        return null;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={(tab) => {
      setActiveTab(tab);
      setOpenVoice(false);
      setOpenForm(false);
    }}>
      {/* Page content with clean transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          {renderPage()}
        </motion.div>
      </AnimatePresence>

      {/* ── FLOATING ACTION BUTTONS (Mobile) ── */}
      {activeTab !== 'reports' && activeTab !== 'settings' && activeTab !== 'profile' && (
        <div className="fixed bottom-20 right-4 z-30 flex items-center gap-2.5 md:hidden">
          {/* Voice FAB */}
          <button
            onClick={() => { setActiveTab('transactions'); setOpenVoice(true); }}
            className="w-11 h-11 rounded-full bg-fintech-card border border-fintech-border text-blue-400 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            title="Catat Suara"
          >
            <Mic size={18} />
          </button>

          {/* Add Transaction FAB */}
          <button
            onClick={() => { setActiveTab('transactions'); setOpenForm(true); }}
            className="h-11 px-3.5 rounded-full bg-blue-600 text-white flex items-center gap-1.5 shadow-lg active:scale-95 transition-transform font-medium text-xs"
            title="Tambah Transaksi"
          >
            <Plus size={16} />
            <span>Catat</span>
          </button>
        </div>
      )}
    </Layout>
  );
}

// ─────────────────────────────────────────────
//  Root App
// ─────────────────────────────────────────────
export default function App() {
  return (
    <AppProvider>
      <InnerApp />
    </AppProvider>
  );
}
