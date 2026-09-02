import { useEffect, useState } from 'react';
import { Plus, Trash2, UserCheck, Shield, Check, X, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { PaymentPolicy, Guardian } from '@/lib/types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Modal } from '@/components/Modal';

export function Settings() {
  const [policies, setPolicies] = useState<PaymentPolicy[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddGuardian, setShowAddGuardian] = useState(false);
  const [showAddPolicy, setShowAddPolicy] = useState(false);
  const [guardianForm, setGuardianForm] = useState({ name: '', relationship: '' });
  const [policyForm, setPolicyForm] = useState({ rule_type: 'amount_threshold', threshold: '', guardian_id: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    const [polRes, guardRes] = await Promise.all([
      supabase.from('payment_policies').select('*').order('created_at', { ascending: false }),
      supabase.from('guardians').select('*').order('created_at', { ascending: false }),
    ]);
    setPolicies(polRes.data ?? []);
    setGuardians(guardRes.data ?? []);
    setLoading(false);
  }

  async function addGuardian() {
    if (!guardianForm.name.trim()) return;
    await supabase.from('guardians').insert({
      name: guardianForm.name,
      relationship: guardianForm.relationship || null,
    });
    setGuardianForm({ name: '', relationship: '' });
    setShowAddGuardian(false);
    load();
  }

  async function addPolicy() {
    const insert: Record<string, unknown> = {
      rule_type: policyForm.rule_type,
      enabled: true,
    };
    if (policyForm.rule_type === 'amount_threshold' && policyForm.threshold) {
      insert.threshold = Number(policyForm.threshold);
    }
    if (policyForm.guardian_id) {
      insert.guardian_id = policyForm.guardian_id;
    }
    await supabase.from('payment_policies').insert(insert);
    setPolicyForm({ rule_type: 'amount_threshold', threshold: '', guardian_id: '' });
    setShowAddPolicy(false);
    load();
  }

  async function togglePolicy(p: PaymentPolicy) {
    await supabase.from('payment_policies').update({ enabled: !p.enabled }).eq('id', p.id);
    load();
  }

  async function deletePolicy(id: string) {
    await supabase.from('payment_policies').delete().eq('id', id);
    load();
  }

  async function deleteGuardian(id: string) {
    await supabase.from('guardians').delete().eq('id', id);
    load();
  }

  if (loading) return <LoadingSpinner label="Loading settings..." />;

  const ruleLabels: Record<string, string> = {
    amount_threshold: 'Amount Threshold',
    new_recipient: 'New Recipient',
    changed_wallet: 'Changed Wallet',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-ink-400 mt-1">Configure second-person approval policies and trusted guardians.</p>
      </div>

      {/* Guardians */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserCheck size={18} className="text-sui-400" />
            <h2 className="text-base font-semibold text-white">Guardians</h2>
          </div>
          <button onClick={() => setShowAddGuardian(true)} className="btn-secondary flex items-center gap-2 text-sm py-2">
            <Plus size={14} /> Add Guardian
          </button>
        </div>
        <p className="text-xs text-ink-400 mb-4">Trusted people who can approve payments that match your policies.</p>
        {guardians.length === 0 ? (
          <p className="text-sm text-ink-500 text-center py-4">No guardians added yet.</p>
        ) : (
          <div className="space-y-2">
            {guardians.map((g) => (
              <div key={g.id} className="flex items-center gap-3 p-3 rounded-xl bg-ink-800/40 border border-ink-700/50">
                <div className="w-9 h-9 rounded-full bg-sui-500/15 flex items-center justify-center text-sm font-semibold text-sui-300">
                  {g.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink-100">{g.name}</p>
                  {g.relationship && <p className="text-xs text-ink-500">{g.relationship}</p>}
                </div>
                <button onClick={() => deleteGuardian(g.id)} className="text-ink-600 hover:text-red-400 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Policies */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-accent-400" />
            <h2 className="text-base font-semibold text-white">Payment Policies</h2>
          </div>
          <button onClick={() => setShowAddPolicy(true)} className="btn-secondary flex items-center gap-2 text-sm py-2">
            <Plus size={14} /> Add Policy
          </button>
        </div>
        <p className="text-xs text-ink-400 mb-4">Rules that require a second approval before certain payments can proceed.</p>
        {policies.length === 0 ? (
          <p className="text-sm text-ink-500 text-center py-4">No policies configured. All payments proceed without second approval.</p>
        ) : (
          <div className="space-y-2">
            {policies.map((p) => {
              const guardian = guardians.find((g) => g.id === p.guardian_id);
              return (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-ink-800/40 border border-ink-700/50">
                  <div className={`w-2 h-2 rounded-full ${p.enabled ? 'bg-accent-400' : 'bg-ink-600'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink-100">{ruleLabels[p.rule_type] ?? p.rule_type}</p>
                    <p className="text-xs text-ink-500">
                      {p.rule_type === 'amount_threshold' && p.threshold ? `Above ${Number(p.threshold).toLocaleString()} USDC` : ''}
                      {p.rule_type === 'new_recipient' ? 'Any new recipient' : ''}
                      {p.rule_type === 'changed_wallet' ? 'Any wallet change' : ''}
                      {guardian ? ` · ${guardian.name}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => togglePolicy(p)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      p.enabled ? 'bg-accent-500/10 text-accent-400 hover:bg-accent-500/20' : 'bg-ink-700/50 text-ink-500'
                    }`}
                  >
                    {p.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button onClick={() => deletePolicy(p.id)} className="text-ink-600 hover:text-red-400 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-4 p-3 rounded-lg bg-sui-500/10 border border-sui-500/20 flex items-start gap-2">
          <Info size={16} className="text-sui-400 shrink-0 mt-0.5" />
          <p className="text-xs text-sui-300">
            Second-person approval adds a human safeguard to high-value or high-risk payments. The rule is checked before the payment proceeds to final authorization.
          </p>
        </div>
      </div>

      {/* Add Guardian Modal */}
      <Modal open={showAddGuardian} onClose={() => setShowAddGuardian(false)} title="Add Guardian">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-ink-400 mb-1 block">Name</label>
            <input value={guardianForm.name} onChange={(e) => setGuardianForm({ ...guardianForm, name: e.target.value })} placeholder="e.g. Omar" className="input-field" />
          </div>
          <div>
            <label className="text-xs text-ink-400 mb-1 block">Relationship (optional)</label>
            <input value={guardianForm.relationship} onChange={(e) => setGuardianForm({ ...guardianForm, relationship: e.target.value })} placeholder="e.g. Brother" className="input-field" />
          </div>
          <button onClick={addGuardian} className="btn-primary w-full">Add Guardian</button>
        </div>
      </Modal>

      {/* Add Policy Modal */}
      <Modal open={showAddPolicy} onClose={() => setShowAddPolicy(false)} title="Add Payment Policy">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-ink-400 mb-1 block">Rule Type</label>
            <select value={policyForm.rule_type} onChange={(e) => setPolicyForm({ ...policyForm, rule_type: e.target.value })} className="input-field">
              <option value="amount_threshold">Amount Threshold — require approval above a certain amount</option>
              <option value="new_recipient">New Recipient — require approval for any new recipient</option>
              <option value="changed_wallet">Changed Wallet — require approval when wallet address changes</option>
            </select>
          </div>
          {policyForm.rule_type === 'amount_threshold' && (
            <div>
              <label className="text-xs text-ink-400 mb-1 block">Threshold (USDC)</label>
              <input type="number" value={policyForm.threshold} onChange={(e) => setPolicyForm({ ...policyForm, threshold: e.target.value })} placeholder="1000" className="input-field" />
            </div>
          )}
          <div>
            <label className="text-xs text-ink-400 mb-1 block">Assign Guardian</label>
            <select value={policyForm.guardian_id} onChange={(e) => setPolicyForm({ ...policyForm, guardian_id: e.target.value })} className="input-field">
              <option value="">No specific guardian</option>
              {guardians.map((g) => (
                <option key={g.id} value={g.id}>{g.name}{g.relationship ? ` (${g.relationship})` : ''}</option>
              ))}
            </select>
          </div>
          <button onClick={addPolicy} className="btn-primary w-full">Add Policy</button>
        </div>
      </Modal>
    </div>
  );
}
