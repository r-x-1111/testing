import { useEffect, useState } from 'react';
import { ArrowUpRight, Clock, Check, X, Eye, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Transaction, Receipt } from '@/lib/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Modal } from '@/components/Modal';

export function History() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Transaction | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
    setTransactions(data ?? []);
    setLoading(false);
  }

  if (loading) return <LoadingSpinner label="Loading transaction history..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Transaction History</h1>
        <p className="text-sm text-ink-400 mt-1">All your verified remittance payments and their on-chain receipts.</p>
      </div>

      {transactions.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-ink-400">No transactions yet. Send your first payment to see it here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div key={tx.id} className="glass-card p-4 hover:border-ink-600 transition-all">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  tx.status === 'completed' ? 'bg-accent-500/15' : tx.status === 'escrow' ? 'bg-gold-500/15' : 'bg-ink-700/50'
                }`}>
                  {tx.status === 'completed' ? <ArrowUpRight size={18} className="text-accent-400" /> :
                   tx.status === 'escrow' ? <Clock size={18} className="text-gold-400" /> :
                   <X size={18} className="text-ink-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-ink-100">{tx.recipient_name}</p>
                    <StatusBadge status={tx.status} />
                  </div>
                  <p className="text-xs text-ink-500 mt-0.5">
                    {tx.purpose || 'No purpose'} · {formatDate(tx.created_at)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-white">{Number(tx.amount).toLocaleString()} {tx.token}</p>
                  {tx.execution_method === 'safesend' && <p className="text-[10px] text-gold-400 mt-0.5">SafeSend</p>}
                </div>
                <button
                  onClick={() => setSelected(tx)}
                  className="ml-2 p-2 rounded-lg hover:bg-ink-800/50 text-ink-500 hover:text-sui-400 transition-colors shrink-0"
                >
                  <Eye size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Verified Payment Receipt" maxWidth="max-w-xl">
        {selected && <ReceiptDetail tx={selected} />}
      </Modal>
    </div>
  );
}

function ReceiptDetail({ tx }: { tx: Transaction }) {
  const receipt = tx.receipt as Receipt | null;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 rounded-xl bg-ink-800/40 border border-ink-700/50">
        <div>
          <p className="text-xs text-ink-400">Recipient</p>
          <p className="text-base font-semibold text-white">{tx.recipient_name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-400">Amount</p>
          <p className="text-base font-bold text-white">{Number(tx.amount).toLocaleString()} {tx.token}</p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-ink-800/40 border border-ink-700/50 space-y-0">
        {receipt && (
          <>
            <DetailRow label="Intent Hash" value={receipt.intent_hash} mono />
            <DetailRow label="Purpose Hash" value={receipt.purpose_hash} mono />
            <DetailRow label="Gonka Request IDs" value={receipt.gonka_ids?.join(', ') ?? 'N/A'} mono />
            <DetailRow label="Recipient Confirmed" value={receipt.recipient_confirmed ? 'Yes' : 'No'} />
            <DetailRow label="User Authorized" value={receipt.user_authorized ? 'Yes' : 'No'} />
            <DetailRow label="Execution" value={receipt.execution === 'safesend' ? 'SafeSend (Escrow)' : 'Instant'} />
            <DetailRow label="Sui Transaction Digest" value={receipt.sui_digest} mono />
            <DetailRow label="Status" value={receipt.status} highlight={receipt.status === 'SUCCESS' ? 'accent' : 'gold'} />
          </>
        )}
        {!receipt && (
          <>
            <DetailRow label="Status" value={tx.status} />
            <DetailRow label="Execution Method" value={tx.execution_method} />
            {tx.sui_digest && <DetailRow label="Sui Digest" value={tx.sui_digest} mono />}
            {tx.intent_hash && <DetailRow label="Intent Hash" value={tx.intent_hash} mono />}
          </>
        )}
      </div>

      {tx.instruction && (
        <div className="p-4 rounded-xl bg-ink-800/40 border border-ink-700/50">
          <p className="text-xs text-ink-400 mb-1">Original Instruction</p>
          <p className="text-sm text-ink-200 italic">"{tx.instruction}"</p>
        </div>
      )}

      {tx.safety_warnings && Array.isArray(tx.safety_warnings) && tx.safety_warnings.length > 0 && (
        <div className="p-4 rounded-xl bg-gold-500/10 border border-gold-500/20">
          <p className="text-xs text-gold-400 mb-2 font-semibold">Safety Warnings</p>
          {(tx.safety_warnings as Array<{ title: string; detail: string }>).map((w, i) => (
            <div key={i} className="text-xs text-gold-300 mb-1">
              <span className="font-medium">{w.title}:</span> {w.detail}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono, highlight }: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: 'accent' | 'gold';
}) {
  const colorClass = highlight === 'accent' ? 'text-accent-400' : highlight === 'gold' ? 'text-gold-400' : 'text-ink-100';
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-ink-800/50 last:border-0">
      <span className="text-sm text-ink-400">{label}</span>
      <span className={`text-sm ${mono ? 'font-mono' : 'font-medium'} ${colorClass}`}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    completed: { label: 'Completed', cls: 'badge-success' },
    escrow: { label: 'In Escrow', cls: 'badge-warning' },
    draft: { label: 'Draft', cls: 'badge-neutral' },
    paused: { label: 'Paused', cls: 'badge-danger' },
    awaiting_approval: { label: 'Awaiting', cls: 'badge-warning' },
    authorized: { label: 'Authorized', cls: 'badge-info' },
  };
  const cfg = config[status] ?? { label: status, cls: 'badge-neutral' };
  return <span className={cfg.cls}>{cfg.label}</span>;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
