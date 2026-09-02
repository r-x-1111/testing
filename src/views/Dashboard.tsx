import { useEffect, useState } from 'react';
import { Send, ArrowUpRight, ArrowDownLeft, Wallet, ShieldCheck, Zap, Clock, TrendingUp, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Transaction, Recipient } from '@/lib/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface DashboardProps {
  onNavigate: (page: 'send' | 'recipients' | 'history') => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [txRes, recipRes] = await Promise.all([
      supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('recipients').select('*').order('created_at', { ascending: false }),
    ]);
    setTransactions(txRes.data ?? []);
    setRecipients(recipRes.data ?? []);
    setLoading(false);
  }

  const walletBalance = 15420;
  const completedTx = transactions.filter((t) => t.status === 'completed');
  const totalSent = completedTx.reduce((sum, t) => sum + Number(t.amount), 0);
  const inEscrow = transactions.filter((t) => t.status === 'escrow').length;

  if (loading) return <LoadingSpinner label="Loading your dashboard..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero balance card */}
      <div className="relative overflow-hidden glass-card p-6 lg:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sui-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-ink-400 text-sm mb-2">
              <Wallet size={16} />
              <span>Wallet Balance</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl lg:text-5xl font-bold text-white tracking-tight">
                {walletBalance.toLocaleString()}
              </span>
              <span className="text-xl text-ink-400 font-medium">USDC</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-ink-500">
              <span className="font-mono">0x7a3b...e3f2a1b</span>
              <span className="text-ink-600">·</span>
              <span className="text-accent-400">Sui Mainnet</span>
            </div>
          </div>
          <button onClick={() => onNavigate('send')} className="btn-primary flex items-center gap-2 self-start lg:self-auto">
            <Send size={18} />
            Send Money
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Total Sent" value={`${totalSent.toLocaleString()}`} unit="USDC" color="sui" />
        <StatCard icon={ArrowUpRight} label="Transactions" value={`${completedTx.length}`} unit="completed" color="accent" />
        <StatCard icon={Clock} label="In Escrow" value={`${inEscrow}`} unit="SafeSend" color="gold" />
        <StatCard icon={Users} label="Recipients" value={`${recipients.length}`} unit="saved" color="sui" />
      </div>

      {/* Quick send to trusted recipients */}
      {recipients.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ink-200">Quick Send</h3>
            <button onClick={() => onNavigate('recipients')} className="text-xs text-sui-400 hover:text-sui-300 transition-colors">
              Manage recipients
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {recipients.slice(0, 6).map((r) => (
              <button
                key={r.id}
                onClick={() => onNavigate('send')}
                className="flex items-center gap-3 p-3 rounded-xl bg-ink-800/40 hover:bg-ink-800/70 border border-ink-700/50 transition-all duration-200 hover:border-sui-500/30 group"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sui-500/30 to-accent-500/30 flex items-center justify-center text-sm font-semibold text-white">
                  {r.nickname[0].toUpperCase()}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-100 truncate">{r.nickname}</p>
                  <p className="text-xs text-ink-500">
                    {r.usual_amount > 0 ? `${r.usual_amount} USDC usual` : 'New recipient'}
                  </p>
                </div>
                {r.trusted && <ShieldCheck size={14} className="text-accent-400 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ink-200">Recent Activity</h3>
          <button onClick={() => onNavigate('history')} className="text-xs text-sui-400 hover:text-sui-300 transition-colors">
            View all
          </button>
        </div>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-ink-500 text-sm">
            No transactions yet. Send your first payment to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.slice(0, 6).map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-ink-800/40 transition-colors">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  tx.status === 'completed' ? 'bg-accent-500/15' : tx.status === 'escrow' ? 'bg-gold-500/15' : 'bg-ink-700/50'
                }`}>
                  {tx.status === 'completed' ? (
                    <ArrowUpRight size={16} className="text-accent-400" />
                  ) : tx.status === 'escrow' ? (
                    <Clock size={16} className="text-gold-400" />
                  ) : (
                    <ArrowDownLeft size={16} className="text-ink-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-100 truncate">{tx.recipient_name}</p>
                  <p className="text-xs text-ink-500">{tx.purpose || 'No purpose specified'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-ink-100">{Number(tx.amount).toLocaleString()} {tx.token}</p>
                  <StatusBadge status={tx.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, unit, color }: {
  icon: typeof Wallet; label: string; value: string; unit: string; color: 'sui' | 'accent' | 'gold';
}) {
  const colors = {
    sui: 'text-sui-400 bg-sui-500/10',
    accent: 'text-accent-400 bg-accent-500/10',
    gold: 'text-gold-400 bg-gold-500/10',
  };
  return (
    <div className="glass-card p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-ink-400 mt-0.5">{label} · {unit}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    completed: { label: 'Completed', cls: 'badge-success' },
    escrow: { label: 'In Escrow', cls: 'badge-warning' },
    draft: { label: 'Draft', cls: 'badge-neutral' },
    paused: { label: 'Paused', cls: 'badge-danger' },
    awaiting_approval: { label: 'Awaiting Approval', cls: 'badge-warning' },
    authorized: { label: 'Authorized', cls: 'badge-info' },
  };
  const cfg = config[status] ?? { label: status, cls: 'badge-neutral' };
  return <span className={cfg.cls}>{cfg.label}</span>;
}
