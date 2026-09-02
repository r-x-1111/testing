import { useEffect, useState } from 'react';
import { Plus, ShieldCheck, Trash2, Languages, Wallet, X, Check, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Recipient } from '@/lib/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Modal } from '@/components/Modal';

export function Recipients() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ nickname: '', wallet_address: '', usual_amount: '', language: 'English' });

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('recipients').select('*').order('created_at', { ascending: false });
    setRecipients(data ?? []);
    setLoading(false);
  }

  async function addRecipient() {
    if (!form.nickname.trim() || !form.wallet_address.trim()) return;
    await supabase.from('recipients').insert({
      nickname: form.nickname,
      wallet_address: form.wallet_address,
      usual_amount: form.usual_amount ? Number(form.usual_amount) : 0,
      language: form.language,
      trusted: false,
      wallet_confirmed: false,
    });
    setForm({ nickname: '', wallet_address: '', usual_amount: '', language: 'English' });
    setShowAdd(false);
    load();
  }

  async function toggleTrust(r: Recipient) {
    await supabase.from('recipients').update({ trusted: !r.trusted }).eq('id', r.id);
    load();
  }

  async function deleteRecipient(id: string) {
    await supabase.from('recipients').delete().eq('id', id);
    load();
  }

  if (loading) return <LoadingSpinner label="Loading recipients..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Recipients</h1>
          <p className="text-sm text-ink-400 mt-1">Manage your saved recipients and their trust status.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Add Recipient
        </button>
      </div>

      {recipients.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-ink-400">No recipients yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recipients.map((r) => (
            <div key={r.id} className="glass-card p-5">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sui-500/30 to-accent-500/30 flex items-center justify-center text-lg font-semibold text-white shrink-0">
                  {r.nickname[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-white">{r.nickname}</h3>
                    {r.trusted && <span className="badge-success"><ShieldCheck size={12} /> Trusted</span>}
                  </div>
                  <p className="text-xs font-mono text-ink-500 mt-1 truncate">{r.wallet_address}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-ink-400">
                    <span className="flex items-center gap-1">
                      <Wallet size={12} /> {r.wallet_confirmed ? 'Confirmed' : 'Unconfirmed'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Languages size={12} /> {r.language}
                    </span>
                    {r.usual_amount > 0 && <span>{r.usual_amount} {r.usual_token} usual</span>}
                  </div>
                </div>
                <button onClick={() => deleteRecipient(r.id)} className="text-ink-600 hover:text-red-400 transition-colors shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
              <button
                onClick={() => toggleTrust(r)}
                className={`w-full mt-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                  r.trusted
                    ? 'bg-ink-800/50 text-ink-400 hover:text-red-400 border border-ink-700/50'
                    : 'bg-accent-500/10 text-accent-400 hover:bg-accent-500/20 border border-accent-500/20'
                }`}
              >
                {r.trusted ? <><X size={14} /> Remove Trust</> : <><Check size={14} /> Mark as Trusted</>}
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Recipient">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-ink-400 mb-1 block">Nickname</label>
            <input
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              placeholder="e.g. Ahmad"
              className="input-field"
            />
          </div>
          <div>
            <label className="text-xs text-ink-400 mb-1 block">Wallet Address</label>
            <input
              value={form.wallet_address}
              onChange={(e) => setForm({ ...form, wallet_address: e.target.value })}
              placeholder="0x..."
              className="input-field font-mono text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-400 mb-1 block">Usual Amount (optional)</label>
              <input
                type="number"
                value={form.usual_amount}
                onChange={(e) => setForm({ ...form, usual_amount: e.target.value })}
                placeholder="200"
                className="input-field"
              />
            </div>
            <div>
              <label className="text-xs text-ink-400 mb-1 block">Language</label>
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                className="input-field"
              >
                <option>English</option>
                <option>Bahasa Melayu</option>
                <option>Bengali</option>
                <option>Indonesian</option>
                <option>Arabic</option>
                <option>Hindi</option>
              </select>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-start gap-2">
            <AlertTriangle size={16} className="text-gold-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gold-300">New recipients are untrusted by default. You can mark them as trusted after verifying their wallet.</p>
          </div>
          <button onClick={addRecipient} className="btn-primary w-full">Add Recipient</button>
        </div>
      </Modal>
    </div>
  );
}
