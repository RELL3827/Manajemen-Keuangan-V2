export type TransactionType = 'income' | 'expense' | 'transfer';
export type AccountType = 'cash' | 'bank' | 'ewallet' | 'savings' | 'investment' | 'other';
export type InputMethod = 'manual' | 'voice';

export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
  currency: string;
  timezone: string;
  language: string;
  created_at?: string;
}

export interface Account {
  id: number;
  user_id?: number;
  name: string;
  type: AccountType;
  initial_balance: number;
  current_balance: number;
  account_number?: string | null;
  color: string;
  icon: string;
  is_active: boolean;
}

export interface Category {
  id: number;
  user_id?: number | null;
  name: string;
  type: 'income' | 'expense' | 'both';
  icon: string;
  color: string;
  is_default: boolean;
}

export interface Transaction {
  id: number | string; // string for local offline temporary IDs
  client_id?: string;
  user_id?: number;
  account_id: number;
  to_account_id?: number | null;
  category_id?: number | null;
  type: TransactionType;
  amount: number;
  description: string;
  transaction_date: string;
  input_method: InputMethod;
  voice_text?: string | null;
  attachment?: string | null;
  category?: Category | null;
  account?: Account | null;
  to_account?: Account | null;
  created_at?: string;
  synced?: boolean; // for offline tracking
}

export interface Budget {
  id: number;
  user_id?: number;
  category_id: number;
  category?: Category;
  amount: number;
  spent: number;
  remaining: number;
  percentage: number;
  month: string; // YYYY-MM
  alert_threshold: number;
  is_over_budget: boolean;
  warning_level?: 'safe' | 'warning' | 'danger';
}

export interface SavingsGoal {
  id: number;
  user_id?: number;
  name: string;
  target_amount: number;
  current_amount: number;
  remaining?: number;
  progress_percentage?: number;
  target_date?: string | null;
  target_date_human?: string | null;
  icon: string;
  color: string;
  notes?: string | null;
  is_completed: boolean;
}

export interface AppNotification {
  id: number;
  user_id?: number;
  type: 'budget_warning' | 'budget_exceeded' | 'savings_reached' | 'reminder' | 'system';
  title: string;
  message: string;
  is_read: boolean;
  data?: any;
  created_at: string;
}

export interface DashboardSummary {
  current_balance: number;
  total_income_month: number;
  total_expense_month: number;
  total_savings: number;
}

export interface CashflowPoint {
  date: string;
  label: string;
  income: number;
  expense: number;
}

export interface FinancialInsight {
  type: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

export interface VoiceParsedResult {
  type: TransactionType;
  amount: number | null;
  category_id: number | null;
  category?: Category | null;
  account_id: number | null;
  account?: Account | null;
  to_account_id?: number | null;
  to_account?: Account | null;
  description: string;
  transaction_date: string;
  confidence: number;
}
