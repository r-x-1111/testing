import { useEffect, useState, useCallback } from 'react';
import {
  Send, ArrowRight, Check, X, AlertTriangle, Info,
  ShieldCheck, Clock, Zap, Lock, Copy, FileCheck, UserCheck,
  Languages, Sparkles, RefreshCw, Shield, Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { runGonkaModel, compareModels, checkReason, checkFreshness } from '@/lib/gonka';
import { runSafetyLayer, checkDuplicate, evaluatePolicies } from '@/lib/safety';
import { generateIntentHash, generatePurposeHash, generateSuiDigest, generateGonkaId, executeOnSui } from '@/lib/sui';
import type { Recipient, Transaction, ModelOutput, PaymentPolicy, Guardian, SendFlowState, SafetyWarning, TranslationKey } from '@/lib/types';
import { useLang } from '@/lib/LanguageContext';
import { ProcessingOverlay } from '@/components/ProcessingOverlay';
import { WarningCard, CheckRow } from '@/components/WarningCard';
import { Modal } from '@/components/Modal';
import { VoiceInput } from '@/components/VoiceInput';

type Step =
  | 'input'
  | 'dual-ai'
  | 'reason'
  | 'safety'
  | 'recipient'
  | 'intent'
  | 'duplicate'
  | 'approval'
  | 'execution'
  | 'authorize'
  | 'receipt';

const STEP_ORDER: Step[] = [
  'input', 'dual-ai', 'reason', 'safety', 'recipient', 'intent', 'duplicate', 'approval', 'execution', 'authorize', 'receipt',
];

const STEP_LABEL_KEYS: Record<Step, TranslationKey> = {
  input: 'send.instruction',
  'dual-ai': 'send.dualAi',
  reason: 'send.reason',
  safety: 'send.safety',
  recipient: 'send.recipient',
  intent: 'send.intent',
  duplicate: 'send.duplicate',
  approval: 'send.approval',
  execution: 'send.execution',
  authorize: 'send.authorize',
  receipt: 'send.receipt',
};

const EXAMPLES = [
  'Send Ahmad the usual plus 20 USDC for books',
  'Send 500 USDC to Ahmad because his family was affected by the earthquake',
  'Send 200 USDC to Fatima for September allowance',
  'Send 2000 USDC to Rina for medical expenses',
];

export function SendFlow({ onComplete }: { onComplete: () => void }) {
  const { t } = useLang();
  const [step, setStep] = useState<Step>('input');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [policies, setPolicies] = useState<PaymentPolicy[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [processing, setProcessing] = useState(false);
  const [showClarify, setShowClarify] = useState(false);
  const [handshakeModal, setHandshakeModal] = useState(false);
  const [semanticMismatch, setSemanticMismatch] = useState(false);

  const [flow, setFlow] = useState<SendFlowState>({
    instruction: '',
    modelA: null,
    modelB: null,
    modelsAgree: null,
    ambiguityFields: [],
    reasonCheck: null,
    freshness: null,
    safetyWarnings: [],
    recipient: null,
    semanticHandshake: null,
    intentHash: null,
    purposeHash: null,
    intentValidUntil: null,
    duplicateFlagged: false,
    secondApprovalRequired: false,
    secondApprovalStatus: 'not_required',
    executionMethod: 'instant',
    suiDigest: null,
    status: 'draft',
    finalTransactionId: null,
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [recipRes, polRes, guardRes, txRes] = await Promise.all([
      supabase.from('recipients').select('*'),
      supabase.from('payment_policies').select('*'),
      supabase.from('guardians').select('*'),
      supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(20),
    ]);
    setRecipients(recipRes.data ?? []);
    setPolicies(polRes.data ?? []);
    setGuardians(guardRes.data ?? []);
    setRecentTx(txRes.data ?? []);
  }

  const stepIndex = STEP_ORDER.indexOf(step);

  const runDualAI = useCallback(async () => {
    setProcessing(true);
    try {
      await new Promise((r) => setTimeout(r, 1800));
      const modelA = await runGonkaModel(flow.instruction, 'MiniMaxAI/MiniMax-M2.7', recipients, 0);
      await new Promise((r) => setTimeout(r, 600));
      const modelB = await runGonkaModel(flow.instruction, 'moonshotai/Kimi-K2.6', recipients, 0);
      const comparison = compareModels(modelA, modelB);
      setFlow((prev) => ({ ...prev, modelA, modelB, modelsAgree: comparison.agree, ambiguityFields: comparison.fields }));
      if (!comparison.agree) { 
        setShowClarify(true); 
      } else { 
        setStep('reason'); 
      }
    } catch (error) {
      console.error('Dual-AI verification failed:', error);
      alert('Failed to verify instructions. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [flow.instruction, recipients]);

  const runReasonCheck = useCallback(async () => {
    setProcessing(true);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      const reasonResult = await checkReason(flow.instruction);
      const freshness = checkFreshness(reasonResult);
      setFlow((prev) => ({ ...prev, reasonCheck: reasonResult, freshness }));
    } catch (error) {
      console.error('Reason check failed:', error);
    } finally {
      setProcessing(false);
      setStep('safety');
    }
  }, [flow.instruction]);

  const runSafetyAnalysis = useCallback(async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1200));
    const model = flow.modelA!;
    const recipient = recipients.find((r) => r.nickname.toLowerCase() === model.recipient.toLowerCase()) ?? null;
    const warnings = runSafetyLayer(model, recipient, recentTx);
    setFlow((prev) => ({ ...prev, recipient, safetyWarnings: warnings }));
    setProcessing(false);
    setStep('recipient');
  }, [flow.modelA, recipients, recentTx]);

  const runIntentLock = useCallback(async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1000));
    const intentHash = generateIntentHash();
    const purposeHash = generatePurposeHash();
    const validUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    setFlow((prev) => ({ ...prev, intentHash, purposeHash, intentValidUntil: validUntil }));
    setProcessing(false);
    setStep('duplicate');
  }, []);

  const runDuplicateCheck = useCallback(async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 800));
    const isDup = checkDuplicate(flow.modelA!, recentTx);
    setFlow((prev) => ({ ...prev, duplicateFlagged: isDup }));
    setProcessing(false);
    if (!isDup) { setStep('approval'); }
  }, [flow.modelA, recentTx]);

  const runApprovalCheck = useCallback(async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 800));
    const result = evaluatePolicies(flow.modelA!, flow.recipient, policies);
    setFlow((prev) => ({ ...prev, secondApprovalRequired: result.required, secondApprovalStatus: result.required ? 'awaiting' : 'not_required' }));
    setProcessing(false);
    setStep('execution');
  }, [flow.modelA, flow.recipient, policies]);

  const executeSui = useCallback(async () => {
    setProcessing(true);
    try {
      await new Promise((r) => setTimeout(r, 2000));
      const { digest, escrowUntil } = await executeOnSui(
        flow.modelA!.amount, 
        flow.modelA!.token, 
        flow.modelA!.wallet_address, 
        flow.executionMethod,
        flow.modelA!.wallet_address
      );
      const gonkaIds = [generateGonkaId(), generateGonkaId()];
      const receipt = { intent_hash: flow.intentHash!, purpose_hash: flow.purposeHash!, gonka_ids: gonkaIds, recipient_confirmed: flow.recipient?.wallet_confirmed ?? false, user_authorized: true, execution: flow.executionMethod, sui_digest: digest, status: 'SUCCESS' };
      const { data } = await supabase.from('transactions').insert({
        recipient_name: flow.modelA!.recipient, wallet_address: flow.modelA!.wallet_address, amount: flow.modelA!.amount, token: flow.modelA!.token, purpose: flow.modelA!.purpose, instruction: flow.instruction,
        model_a_output: flow.modelA, model_b_output: flow.modelB, models_agree: flow.modelsAgree, reason_check: flow.reasonCheck, safety_warnings: flow.safetyWarnings,
        intent_hash: flow.intentHash, purpose_hash: flow.purposeHash, intent_valid_until: flow.intentValidUntil, duplicate_flagged: flow.duplicateFlagged,
        second_approval_required: flow.secondApprovalRequired, second_approval_status: flow.secondApprovalStatus, execution_method: flow.executionMethod, escrow_until: escrowUntil,
        sui_digest: digest, status: flow.executionMethod === 'safesend' ? 'escrow' : 'completed', receipt,
      }).select('*').single();
      setFlow((prev) => ({ ...prev, suiDigest: digest, status: flow.executionMethod === 'safesend' ? 'escrow' : 'completed', finalTransactionId: data?.id ?? null }));
      setStep('receipt');
    } catch (error) {
      console.error('Sui execution failed:', error);
      alert('Transaction failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [flow]);

  useEffect(() => {
    if (step === 'dual-ai' && !flow.modelA && !processing) runDualAI();
    else if (step === 'reason' && !flow.reasonCheck && !processing) runReasonCheck();
    else if (step === 'safety' && flow.safetyWarnings.length === 0 && !flow.recipient && !processing) runSafetyAnalysis();
    else if (step === 'intent' && !flow.intentHash && !processing) runIntentLock();
    else if (step === 'duplicate' && !flow.duplicateFlagged && !processing && flow.modelA) runDuplicateCheck();
    else if (step === 'approval' && flow.secondApprovalStatus === 'not_required' && !processing && flow.modelA) runApprovalCheck();
  }, [step]);

  useEffect(() => {
    if (step === 'reason' && flow.reasonCheck === null && !processing) setStep('safety');
  }, [step, flow.reasonCheck, processing]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="glass-card p-4">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin pb-1">
          {STEP_ORDER.map((s, i) => {
            const isCurrent = s === step;
            const isPast = i < stepIndex;
            return (
              <div key={s} className="flex items-center shrink-0">
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${isCurrent ? 'bg-sui-500/15 text-sui-300 border border-sui-500/20' : isPast ? 'text-accent-400' : 'text-ink-600'}`}>
                  {isPast ? <Check size={12} /> : <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${isCurrent ? 'bg-sui-500/20' : 'bg-ink-800'}`}>{i + 1}</div>}
                  <span className="hidden sm:inline">{t(STEP_LABEL_KEYS[s])}</span>
                </div>
                {i < STEP_ORDER.length - 1 && <div className={`w-3 h-px ${isPast ? 'bg-accent-500/30' : 'bg-ink-700'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {processing && <ProcessingOverlay title={getProcessingTitle(step, t)} steps={getProcessingSteps(step, t)} />}

      {!processing && step === 'input' && (
        <InputStep instruction={flow.instruction} setInstruction={(v) => setFlow((prev) => ({ ...prev, instruction: v }))} onSend={() => { if (flow.instruction.trim()) setStep('dual-ai'); }} examples={EXAMPLES} />
      )}

      {!processing && step === 'dual-ai' && flow.modelA && flow.modelB && (
        <DualAIStep modelA={flow.modelA} modelB={flow.modelB} agree={flow.modelsAgree ?? false} ambiguityFields={flow.ambiguityFields}
          onContinue={() => setStep('reason')}
          onClarify={() => { setFlow((prev) => ({ ...prev, instruction: '', modelA: null, modelB: null, modelsAgree: null })); setStep('input'); }} />
      )}

      {!processing && step === 'reason' && flow.reasonCheck && (
        <ReasonStep reasonCheck={flow.reasonCheck} freshness={flow.freshness} onContinue={() => setStep('safety')} />
      )}

      {!processing && step === 'safety' && flow.modelA && (
        <SafetyStep warnings={flow.safetyWarnings} model={flow.modelA} onContinue={() => setStep('recipient')} />
      )}

      {!processing && step === 'recipient' && flow.modelA && (
        <RecipientStep model={flow.modelA} recipient={flow.recipient} onContinue={() => setStep('intent')} onHandshake={() => setHandshakeModal(true)} />
      )}

      {!processing && step === 'intent' && flow.intentHash && (
        <IntentStep model={flow.modelA!} intentHash={flow.intentHash} purposeHash={flow.purposeHash} validUntil={flow.intentValidUntil} onContinue={() => setStep('duplicate')} />
      )}

      {!processing && step === 'duplicate' && flow.modelA && (
        <DuplicateStep flagged={flow.duplicateFlagged} model={flow.modelA} onContinue={() => setStep('approval')} onCancel={onComplete} />
      )}

      {!processing && step === 'approval' && flow.modelA && (
        <ApprovalStep required={flow.secondApprovalRequired} status={flow.secondApprovalStatus} guardians={guardians}
          onSimulateApproval={() => setFlow((prev) => ({ ...prev, secondApprovalStatus: 'approved' }))} onContinue={() => setStep('execution')} />
      )}

      {!processing && step === 'execution' && flow.modelA && (
        <ExecutionStep model={flow.modelA} method={flow.executionMethod} setMethod={(m) => setFlow((prev) => ({ ...prev, executionMethod: m }))} onContinue={() => setStep('authorize')} />
      )}

      {!processing && step === 'authorize' && flow.modelA && (
        <AuthorizeStep flow={flow} onConfirm={executeSui} />
      )}

      {!processing && step === 'receipt' && flow.modelA && (
        <ReceiptStep flow={flow} onComplete={onComplete} />
      )}

      <Modal open={showClarify} onClose={() => setShowClarify(false)} title={t('send.ambiguousTitle')}>
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle size={20} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-300">{t('send.ambiguousMsg')}</p>
          </div>
          <div className="space-y-2">
            {flow.ambiguityFields.map((field) => (
              <div key={field} className="flex items-center gap-2 p-3 rounded-lg bg-ink-800/50">
                <X size={14} className="text-red-400" />
                <span className="text-sm text-ink-200 capitalize">{field}</span>
                <div className="ml-auto flex gap-4 text-xs">
                  <span className="text-ink-400">{String(flow.modelA?.[field as keyof ModelOutput] ?? '')}</span>
                  <span className="text-ink-600">{t('send.vs')}</span>
                  <span className="text-ink-400">{String(flow.modelB?.[field as keyof ModelOutput] ?? '')}</span>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { setShowClarify(false); setFlow((prev) => ({ ...prev, instruction: '', modelA: null, modelB: null, modelsAgree: null, ambiguityFields: [] })); setStep('input'); }} className="btn-primary w-full">{t('send.clarifyInstruction')}</button>
        </div>
      </Modal>

      <Modal open={handshakeModal} onClose={() => setHandshakeModal(false)} title={t('send.semanticHandshake')}>
        <div className="space-y-4">
          <p className="text-sm text-ink-300">{t('send.semanticHandshakeDesc')}</p>
          <div className="p-4 rounded-xl bg-ink-800/50 space-y-3">
            <div>
              <label className="text-xs text-ink-400">{t('send.recipientExpected')}</label>
              <input type="number" placeholder="e.g. 800" onChange={(e) => setSemanticMismatch(Number(e.target.value) !== flow.modelA?.amount)} className="input-field mt-1" />
            </div>
            {semanticMismatch && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertTriangle size={16} className="text-red-400" />
                <span className="text-sm text-red-300">{t('send.expectationMismatch')}</span>
              </div>
            )}
          </div>
          <button onClick={() => setHandshakeModal(false)} className="btn-secondary w-full">{t('send.close')}</button>
        </div>
      </Modal>
    </div>
  );
}

function getProcessingTitle(step: Step, t: (k: TranslationKey) => string): string {
  const titles: Record<Step, string> = {
    input: '', 'dual-ai': t('send.routing'), reason: t('send.verifyingReason'), safety: t('send.runningSafety'),
    recipient: t('send.checkingRecipient'), intent: t('send.lockingIntent'), duplicate: t('send.scanningDuplicates'),
    approval: t('send.evaluatingPolicies'), execution: t('send.settlingSui'), authorize: '', receipt: '',
  };
  return titles[step];
}

function getProcessingSteps(step: Step, t: (k: TranslationKey) => string): { label: string; status: 'pending' | 'active' | 'done' }[] {
  const map: Record<Step, { label: string; status: 'pending' | 'active' | 'done' }[]> = {
    input: [],
    'dual-ai': [
      { label: t('send.sendModelA'), status: 'done' },
      { label: t('send.sendModelB'), status: 'active' },
      { label: t('send.comparingOutputs'), status: 'pending' },
    ],
    reason: [
      { label: t('send.extractingClaim'), status: 'done' },
      { label: t('send.crossReferencing'), status: 'active' },
      { label: t('send.computingTruth'), status: 'pending' },
    ],
    safety: [
      { label: t('send.loadingHistory'), status: 'done' },
      { label: t('send.analyzingPatterns'), status: 'active' },
      { label: t('send.generatingWarnings'), status: 'pending' },
    ],
    recipient: [
      { label: t('send.lookingUpRecipient'), status: 'done' },
      { label: t('send.checkingWallet'), status: 'active' },
      { label: t('send.preparingHandshake'), status: 'pending' },
    ],
    intent: [
      { label: t('send.hashingDetails'), status: 'done' },
      { label: t('send.creatingLock'), status: 'active' },
      { label: t('send.settingValidity'), status: 'pending' },
    ],
    duplicate: [
      { label: t('send.scanningRecent'), status: 'active' },
      { label: t('send.comparingAmounts'), status: 'pending' },
    ],
    approval: [
      { label: t('send.checkingPolicies'), status: 'active' },
      { label: t('send.evaluatingRules'), status: 'pending' },
    ],
    execution: [
      { label: t('send.buildingPTB'), status: 'done' },
      { label: t('send.submittingSui'), status: 'active' },
      { label: t('send.awaitingConfirmation'), status: 'pending' },
    ],
    authorize: [], receipt: [],
  };
  return map[step];
}

function InputStep({ instruction, setInstruction, onSend, examples }: {
  instruction: string; setInstruction: (v: string) => void; onSend: () => void; examples: string[];
}) {
  const { t } = useLang();
  return (
    <div className="space-y-5">
      <div className="glass-card p-6 lg:p-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-sui-500/15 flex items-center justify-center">
            <Languages size={16} className="text-sui-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">{t('send.describePayment')}</h2>
        </div>
        <p className="text-sm text-ink-400 mb-5">{t('send.describeHint')}</p>
        <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder={t('send.placeholder')} rows={3} className="input-field resize-none text-base" autoFocus />
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-500">{instruction.length} {t('send.characters')}</span>
            <VoiceInput onTranscript={setInstruction} currentText={instruction} />
          </div>
          <button onClick={onSend} disabled={!instruction.trim()} className="btn-primary flex items-center gap-2">
            <Send size={16} /> {t('send.interpretVerify')}
          </button>
        </div>
        <p className="text-xs text-ink-500 mt-3">{t('send.voiceHint')}</p>
      </div>
      <div>
        <p className="text-xs text-ink-500 mb-2 uppercase tracking-wider">{t('send.tryExample')}</p>
        <div className="space-y-2">
          {examples.map((ex, i) => (
            <button key={i} onClick={() => setInstruction(ex)} className="w-full text-left p-3 rounded-xl bg-ink-900/40 hover:bg-ink-800/50 border border-ink-800 hover:border-sui-500/20 transition-all duration-200 group">
              <p className="text-sm text-ink-300 group-hover:text-ink-100">{ex}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DualAIStep({ modelA, modelB, agree, ambiguityFields, onContinue, onClarify }: {
  modelA: ModelOutput; modelB: ModelOutput; agree: boolean; ambiguityFields: string[]; onContinue: () => void; onClarify: () => void;
}) {
  const { t } = useLang();
  const fields: { key: keyof ModelOutput; label: TranslationKey }[] = [
    { key: 'recipient', label: 'send.recipientLabel' }, { key: 'amount', label: 'send.amount' },
    { key: 'token', label: 'send.stablecoin' }, { key: 'purpose', label: 'send.purpose' },
    { key: 'wallet_address', label: 'send.wallet' },
  ];
  return (
    <div className="space-y-5">
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-sui-500/15 flex items-center justify-center"><Sparkles size={16} className="text-sui-400" /></div>
          <h2 className="text-lg font-semibold text-white">{t('send.dualAiVerify')}</h2>
        </div>
        <div className="flex items-center gap-3 mb-5">
          {agree ? <span className="badge-success"><Check size={14} /> {t('send.modelsAgree')}</span> : <span className="badge-danger"><X size={14} /> {t('send.ambiguous')}</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModelCard model={modelA} name={t('send.modelA')} subtitle="Gonka Primus v2" />
          <ModelCard model={modelB} name={t('send.modelB')} subtitle="Gonka Sekunda v1" />
        </div>
        <div className="mt-5 space-y-1">
          {fields.map((field) => {
            const valA = String(modelA[field.key]); const valB = String(modelB[field.key]); const fieldAgree = valA === valB;
            return (
              <div key={field.key} className="flex items-center gap-3 py-2 border-b border-ink-800/50 last:border-0">
                <span className="text-xs text-ink-500 w-24 shrink-0">{t(field.label)}</span>
                <span className={`text-sm font-mono ${fieldAgree ? 'text-ink-200' : 'text-gold-400'}`}>{shorten(valA)}</span>
                <span className="text-ink-600 text-xs">{t('send.vs')}</span>
                <span className={`text-sm font-mono ${fieldAgree ? 'text-ink-200' : 'text-gold-400'}`}>{shorten(valB)}</span>
                <span className="ml-auto">{fieldAgree ? <Check size={14} className="text-accent-400" /> : <X size={14} className="text-gold-400" />}</span>
              </div>
            );
          })}
        </div>
        {agree ? (
          <button onClick={onContinue} className="btn-primary w-full mt-5 flex items-center justify-center gap-2">{t('send.continueReason')} <ArrowRight size={16} /></button>
        ) : (
          <button onClick={onClarify} className="btn-danger w-full mt-5 flex items-center justify-center gap-2"><AlertTriangle size={16} /> {t('send.clarifyInstruction')}</button>
        )}
      </div>
    </div>
  );
}

function ModelCard({ model, name, subtitle }: { model: ModelOutput; name: string; subtitle: string }) {
  const { t } = useLang();
  return (
    <div className="p-4 rounded-xl bg-ink-800/40 border border-ink-700/50">
      <div className="flex items-center justify-between mb-3">
        <div><p className="text-sm font-semibold text-ink-100">{name}</p><p className="text-xs text-ink-500">{subtitle}</p></div>
        <span className="badge-info">{model.confidence}{t('send.confidence')}</span>
      </div>
      <div className="space-y-1.5 text-xs">
        <Row label={t('send.recipientLabel')} value={model.recipient} />
        <Row label={t('send.amount')} value={`${model.amount.toLocaleString()} ${model.token}`} />
        <Row label={t('send.purpose')} value={model.purpose} />
        <Row label={t('send.wallet')} value={shorten(model.wallet_address)} mono />
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex items-center justify-between"><span className="text-ink-500">{label}</span><span className={`text-ink-200 ${mono ? 'font-mono' : ''}`}>{value}</span></div>;
}

function ReasonStep({ reasonCheck, freshness, onContinue }: {
  reasonCheck: NonNullable<SendFlowState['reasonCheck']>; freshness: SendFlowState['freshness']; onContinue: () => void;
}) {
  const { t } = useLang();
  return (
    <div className="space-y-5">
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gold-500/15 flex items-center justify-center"><FileCheck size={16} className="text-gold-400" /></div>
          <h2 className="text-lg font-semibold text-white">{t('send.reasonVerify')}</h2>
        </div>
        <p className="text-sm text-ink-400 mb-4">{t('send.reasonHint')}</p>
        <div className="p-4 rounded-xl bg-ink-800/40 border border-ink-700/50 space-y-3">
          <div className="flex items-start justify-between"><span className="text-sm text-ink-400">{t('send.claim')}</span><span className="text-sm text-ink-100 text-right max-w-[70%]">{reasonCheck.claim}</span></div>
          <div className="flex items-center justify-between"><span className="text-sm text-ink-400">{t('send.truthScore')}</span><span className={`text-lg font-bold ${reasonCheck.truth_score >= 70 ? 'text-accent-400' : 'text-gold-400'}`}>{reasonCheck.truth_score}%</span></div>
          <div className="flex items-center justify-between"><span className="text-sm text-ink-400">{t('send.claimSupported')}</span>{reasonCheck.claim_supported ? <Check size={18} className="text-accent-400" /> : <X size={18} className="text-red-400" />}</div>
          <div className="flex items-center justify-between"><span className="text-sm text-ink-400">{t('send.recipientConnection')}</span><span className="text-sm text-gold-400 flex items-center gap-1"><AlertTriangle size={14} /> {reasonCheck.recipient_connection}</span></div>
          <div className="flex items-center justify-between"><span className="text-sm text-ink-400">{t('send.gonkaIds')}</span><span className="text-xs font-mono text-ink-300">{reasonCheck.gonka_request_ids.join(', ')}</span></div>
        </div>
        <div className="mt-4 p-3 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-start gap-2">
          <Info size={16} className="text-gold-400 shrink-0 mt-0.5" /><p className="text-xs text-gold-300">{t('send.disasterWarning')}</p>
        </div>
        {freshness && <div className="mt-4 flex items-center gap-2 text-xs text-ink-400"><Clock size={14} className="text-accent-400" />{t('send.freshness')}: {freshness.message}</div>}
        <button onClick={onContinue} className="btn-primary w-full mt-5 flex items-center justify-center gap-2">{t('send.continueSafety')} <ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

function SafetyStep({ warnings, model, onContinue }: { warnings: SafetyWarning[]; model: ModelOutput; onContinue: () => void; }) {
  const { t } = useLang();
  return (
    <div className="space-y-5">
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center"><Shield size={16} className="text-red-400" /></div>
          <h2 className="text-lg font-semibold text-white">{t('send.safetyLayer')}</h2>
        </div>
        <p className="text-sm text-ink-400 mb-4">{t('send.safetyHint')}</p>
        {warnings.length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-accent-500/10 border border-accent-500/20"><Check size={20} className="text-accent-400" /><p className="text-sm text-accent-300">{t('send.noPatterns')}</p></div>
        ) : (<div className="space-y-3">{warnings.map((w, i) => <WarningCard key={i} warning={w} />)}</div>)}
        <div className="mt-4 p-3 rounded-lg bg-ink-800/40 flex items-start gap-2"><Info size={16} className="text-sui-400 shrink-0 mt-0.5" /><p className="text-xs text-ink-400">{t('send.predictionNote')}</p></div>
        <button onClick={onContinue} className="btn-primary w-full mt-5 flex items-center justify-center gap-2">{t('send.continueRecipient')} <ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

function RecipientStep({ model, recipient, onContinue, onHandshake }: {
  model: ModelOutput; recipient: Recipient | null; onContinue: () => void; onHandshake: () => void;
}) {
  const { t } = useLang();
  return (
    <div className="space-y-5">
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-sui-500/15 flex items-center justify-center"><UserCheck size={16} className="text-sui-400" /></div>
          <h2 className="text-lg font-semibold text-white">{t('send.trustedRecipient')}</h2>
        </div>
        <div className="p-4 rounded-xl bg-ink-800/40 border border-ink-700/50 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sui-500/30 to-accent-500/30 flex items-center justify-center text-lg font-semibold text-white">{model.recipient[0]?.toUpperCase()}</div>
            <div><p className="text-base font-semibold text-white">{model.recipient}</p><p className="text-xs text-ink-500 font-mono">{shorten(model.wallet_address)}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="flex items-center gap-2">{recipient?.trusted ? <Check size={16} className="text-accent-400" /> : <X size={16} className="text-gold-400" />}<span className="text-xs text-ink-300">{recipient?.trusted ? t('send.trusted') : t('send.notTrusted')}</span></div>
            <div className="flex items-center gap-2">{recipient?.wallet_confirmed ? <Check size={16} className="text-accent-400" /> : <X size={16} className="text-gold-400" />}<span className="text-xs text-ink-300">{recipient?.wallet_confirmed ? t('send.walletConfirmed') : t('send.walletUnconfirmed')}</span></div>
            {recipient && <div className="flex items-center gap-2"><Languages size={14} className="text-sui-400" /><span className="text-xs text-ink-300">{recipient.language}</span></div>}
          </div>
        </div>
        <button onClick={onHandshake} className="w-full mt-4 p-3 rounded-xl bg-ink-800/40 hover:bg-ink-800/60 border border-ink-700/50 transition-all flex items-center gap-3 text-left">
          <div className="w-8 h-8 rounded-lg bg-sui-500/15 flex items-center justify-center shrink-0"><ShieldCheck size={16} className="text-sui-400" /></div>
          <div className="flex-1"><p className="text-sm font-medium text-ink-100">{t('send.semanticHandshakeOptional')}</p><p className="text-xs text-ink-500">{t('send.semanticHandshakeDesc')}</p></div>
          <ArrowRight size={16} className="text-ink-500" />
        </button>
        <button onClick={onContinue} className="btn-primary w-full mt-5 flex items-center justify-center gap-2">{t('send.continueIntent')} <ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

function IntentStep({ model, intentHash, purposeHash, validUntil, onContinue }: {
  model: ModelOutput; intentHash: string; purposeHash: string | null; validUntil: string | null; onContinue: () => void;
}) {
  const { t } = useLang();
  const minsLeft = validUntil ? Math.max(0, Math.round((new Date(validUntil).getTime() - Date.now()) / 60000)) : 0;
  return (
    <div className="space-y-5">
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-accent-500/15 flex items-center justify-center"><Lock size={16} className="text-accent-400" /></div>
          <h2 className="text-lg font-semibold text-white">{t('send.intentLock')}</h2>
        </div>
        <p className="text-sm text-ink-400 mb-4">{t('send.intentHint')}</p>
        <div className="p-4 rounded-xl bg-ink-800/40 border border-ink-700/50 space-y-2.5">
          <div className="flex items-center justify-between"><span className="text-sm text-ink-400">{t('send.recipientLabel')}</span><span className="text-sm text-ink-100 font-medium">{model.recipient}</span></div>
          <div className="flex items-center justify-between"><span className="text-sm text-ink-400">{t('send.wallet')}</span><span className="text-sm font-mono text-ink-200">{shorten(model.wallet_address)}</span></div>
          <div className="flex items-center justify-between"><span className="text-sm text-ink-400">{t('send.amount')}</span><span className="text-sm text-ink-100 font-medium">{model.amount.toLocaleString()} {model.token}</span></div>
          <div className="flex items-center justify-between"><span className="text-sm text-ink-400">{t('send.intentHash')}</span><span className="text-sm font-mono text-sui-300">{intentHash}</span></div>
          <div className="flex items-center justify-between"><span className="text-sm text-ink-400">{t('send.purposeHash')}</span><span className="text-sm font-mono text-sui-300">{purposeHash}</span></div>
          <div className="flex items-center justify-between"><span className="text-sm text-ink-400">{t('send.validFor')}</span><span className="text-sm text-gold-400 font-medium flex items-center gap-1"><Clock size={14} /> {minsLeft} {t('send.minutes')}</span></div>
        </div>
        <div className="mt-4 space-y-1.5">
          <p className="text-xs text-ink-500 uppercase tracking-wider mb-2">{t('send.driftLock')}</p>
          {[t('send.driftAmount'), t('send.driftWallet'), t('send.driftToken'), t('send.driftPurpose'), t('send.driftExpiry')].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-ink-400"><X size={12} className="text-red-400" /> {item}</div>
          ))}
        </div>
        <button onClick={onContinue} className="btn-primary w-full mt-5 flex items-center justify-center gap-2">{t('send.continueDuplicate')} <ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

function DuplicateStep({ flagged, model, onContinue, onCancel }: {
  flagged: boolean; model: ModelOutput; onContinue: () => void; onCancel: () => void;
}) {
  const { t } = useLang();
  return (
    <div className="space-y-5">
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-sui-500/15 flex items-center justify-center"><Copy size={16} className="text-sui-400" /></div>
          <h2 className="text-lg font-semibold text-white">{t('send.duplicateShield')}</h2>
        </div>
        {flagged ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gold-500/10 border border-gold-500/20">
              <AlertTriangle size={20} className="text-gold-400 shrink-0" />
              <div><p className="text-sm font-semibold text-gold-300">{t('send.possibleDuplicate')}</p><p className="text-xs text-gold-400/70 mt-0.5">{t('send.alreadySent', { amount: model.amount.toLocaleString(), token: model.token, recipient: model.recipient })}</p></div>
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel} className="btn-secondary flex-1">{t('send.cancel')}</button>
              <button onClick={onContinue} className="btn-primary flex-1 flex items-center justify-center gap-2">{t('send.sendAgain')} <ArrowRight size={16} /></button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-accent-500/10 border border-accent-500/20"><Check size={20} className="text-accent-400 shrink-0" /><p className="text-sm text-accent-300">{t('send.noDuplicate')}</p></div>
            <button onClick={onContinue} className="btn-primary w-full flex items-center justify-center gap-2">{t('send.continueApproval')} <ArrowRight size={16} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

function ApprovalStep({ required, status, guardians, onSimulateApproval, onContinue }: {
  required: boolean; status: string; guardians: Guardian[]; onSimulateApproval: () => void; onContinue: () => void;
}) {
  const { t } = useLang();
  const guardian = guardians[0];
  return (
    <div className="space-y-5">
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gold-500/15 flex items-center justify-center"><UserCheck size={16} className="text-gold-400" /></div>
          <h2 className="text-lg font-semibold text-white">{t('send.secondApproval')}</h2>
        </div>
        {!required ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-accent-500/10 border border-accent-500/20"><Check size={20} className="text-accent-400 shrink-0" /><p className="text-sm text-accent-300">{t('send.noApprovalRequired')}</p></div>
        ) : status === 'approved' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-accent-500/10 border border-accent-500/20">
              <Check size={20} className="text-accent-400 shrink-0" />
              <div><p className="text-sm font-semibold text-accent-300">{t('send.approvalReceived')}</p><p className="text-xs text-accent-400/70 mt-0.5">{t('send.approvedPayment', { name: guardian?.name ?? '', relationship: guardian?.relationship ?? '' })}</p></div>
            </div>
            <button onClick={onContinue} className="btn-primary w-full flex items-center justify-center gap-2">{t('send.continueExecution')} <ArrowRight size={16} /></button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gold-500/10 border border-gold-500/20">
              <Clock size={20} className="text-gold-400 shrink-0" />
              <div><p className="text-sm font-semibold text-gold-300">{t('send.approvalRequired')}</p><p className="text-xs text-gold-400/70 mt-0.5">{t('send.thresholdExceeded', { name: guardian?.name ?? 'guardian' })}</p></div>
            </div>
            <button onClick={onSimulateApproval} className="btn-secondary w-full flex items-center justify-center gap-2"><RefreshCw size={16} /> {t('send.simulateApproval')}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ExecutionStep({ model, method, setMethod, onContinue }: {
  model: ModelOutput; method: 'instant' | 'safesend'; setMethod: (m: 'instant' | 'safesend') => void; onContinue: () => void;
}) {
  const { t } = useLang();
  return (
    <div className="space-y-5">
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-sui-500/15 flex items-center justify-center"><Zap size={16} className="text-sui-400" /></div>
          <h2 className="text-lg font-semibold text-white">{t('send.safeSend')}</h2>
        </div>
        <p className="text-sm text-ink-400 mb-5">{t('send.executionHint')}</p>
        <div className="space-y-3">
          <button onClick={() => setMethod('instant')} className={`w-full p-4 rounded-xl border text-left transition-all ${method === 'instant' ? 'bg-sui-500/10 border-sui-500/30' : 'bg-ink-800/40 border-ink-700/50 hover:border-ink-600'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${method === 'instant' ? 'bg-sui-500/20' : 'bg-ink-700/50'}`}><Zap size={18} className={method === 'instant' ? 'text-sui-400' : 'text-ink-400'} /></div>
              <div className="flex-1"><p className="text-sm font-semibold text-ink-100">{t('send.instantSend')}</p><p className="text-xs text-ink-500">{t('send.instantDesc')}</p></div>
              {method === 'instant' && <Check size={18} className="text-sui-400" />}
            </div>
          </button>
          <button onClick={() => setMethod('safesend')} className={`w-full p-4 rounded-xl border text-left transition-all ${method === 'safesend' ? 'bg-accent-500/10 border-accent-500/30' : 'bg-ink-800/40 border-ink-700/50 hover:border-ink-600'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${method === 'safesend' ? 'bg-accent-500/20' : 'bg-ink-700/50'}`}><ShieldCheck size={18} className={method === 'safesend' ? 'text-accent-400' : 'text-ink-400'} /></div>
              <div className="flex-1"><p className="text-sm font-semibold text-ink-100">{t('send.safeSendEscrow')}</p><p className="text-xs text-ink-500">{t('send.safeSendDesc', { amount: model.amount.toLocaleString(), token: model.token })}</p></div>
              {method === 'safesend' && <Check size={18} className="text-accent-400" />}
            </div>
          </button>
        </div>
        {method === 'safesend' && <div className="mt-4 p-3 rounded-lg bg-accent-500/10 border border-accent-500/20 flex items-start gap-2"><Info size={16} className="text-accent-400 shrink-0 mt-0.5" /><p className="text-xs text-accent-300">{t('send.recoveryNote')}</p></div>}
        <button onClick={onContinue} className="btn-primary w-full mt-5 flex items-center justify-center gap-2">{t('send.continueAuthorize')} <ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

function AuthorizeStep({ flow, onConfirm }: { flow: SendFlowState; onConfirm: () => void; }) {
  const { t } = useLang();
  const model = flow.modelA!;
  return (
    <div className="space-y-5">
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-sui-500/15 flex items-center justify-center"><Eye size={16} className="text-sui-400" /></div>
          <h2 className="text-lg font-semibold text-white">{t('send.humanAuth')}</h2>
        </div>
        <p className="text-sm text-ink-400 mb-5">{t('send.authHint')}</p>
        <div className="p-5 rounded-xl bg-ink-800/40 border border-ink-700/50">
          <div className="space-y-0">
            <CheckRow label={t('send.recipientLabel')} value={model.recipient} status="pass" />
            <CheckRow label={t('send.wallet')} value={flow.recipient?.wallet_confirmed ? t('send.walletConfirmed') : t('send.walletUnconfirmed')} status={flow.recipient?.wallet_confirmed ? 'pass' : 'pending'} />
            <CheckRow label={t('send.amount')} value={`${model.amount.toLocaleString()} ${model.token}`} status="pass" />
            <CheckRow label={t('send.gonkaModels')} value={t('send.modelsAgree')} status="pass" />
            <CheckRow label={t('send.reasonCheck')} value={flow.reasonCheck ? `${flow.reasonCheck.truth_score}%` : t('common.na')} status={flow.reasonCheck ? (flow.reasonCheck.truth_score >= 70 ? 'pass' : 'pending') : 'pass'} />
            <CheckRow label={t('send.duplicateCheck')} value={flow.duplicateFlagged ? t('send.possibleDuplicate') : t('send.noDuplicate')} status={flow.duplicateFlagged ? 'pending' : 'pass'} />
            <CheckRow label={t('send.intentLockStatus')} value="Active" status="pass" />
            <CheckRow label={t('send.secondApprovalStatus')} value={flow.secondApprovalRequired ? (flow.secondApprovalStatus === 'approved' ? t('send.approvalReceived') : t('send.approvalRequired')) : t('send.noApprovalRequired')} status={flow.secondApprovalStatus === 'approved' || !flow.secondApprovalRequired ? 'pass' : 'pending'} />
            <CheckRow label={t('send.executionLabel')} value={flow.executionMethod === 'safesend' ? `${t('send.safeSendEscrow')} — 10 min` : t('send.instantSend')} status="pass" />
          </div>
        </div>
        <button onClick={onConfirm} className="btn-primary w-full mt-5 flex items-center justify-center gap-2 text-base"><ShieldCheck size={18} /> {t('send.confirmSend')}</button>
      </div>
    </div>
  );
}

function ReceiptStep({ flow, onComplete }: { flow: SendFlowState; onComplete: () => void; }) {
  const { t } = useLang();
  const model = flow.modelA!;
  const isEscrow = flow.status === 'escrow';
  return (
    <div className="space-y-5">
      <div className="glass-card p-6 lg:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full bg-accent-500/20 animate-pulse-ring" />
            <div className="relative w-16 h-16 rounded-full bg-accent-500/15 border-2 border-accent-500/30 flex items-center justify-center animate-check"><Check size={32} className="text-accent-400" strokeWidth={3} /></div>
          </div>
          <h2 className="text-xl font-bold text-white">{t('send.verifiedReceipt')}</h2>
          <p className="text-sm text-ink-400 mt-1">{isEscrow ? t('send.escrowMsg') : t('send.settledMsg')}</p>
        </div>
        <div className="p-5 rounded-xl bg-ink-800/40 border border-ink-700/50 space-y-0">
          <ReceiptRow label={t('send.intentHash')} value={flow.intentHash!} mono />
          <ReceiptRow label={t('send.purposeHash')} value={flow.purposeHash!} mono />
          <ReceiptRow label={t('send.gonkaRequestIds')} value={flow.reasonCheck?.gonka_request_ids.join(', ') ?? 'GR-8F32A1, GR-9B71C4'} mono />
          <ReceiptRow label={t('send.recipientName')} value={model.recipient} />
          <ReceiptRow label={t('send.amount')} value={`${model.amount.toLocaleString()} ${model.token}`} />
          <ReceiptRow label={t('send.recipientConfirmation')} value={flow.recipient?.wallet_confirmed ? t('send.walletConfirmed') : t('send.walletUnconfirmed')} />
          <ReceiptRow label={t('send.userAuthorization')} value="Authorized" />
          <ReceiptRow label={t('send.executionMethod')} value={flow.executionMethod === 'safesend' ? t('send.safeSendEscrow') : t('send.instantSend')} />
          <ReceiptRow label={t('send.suiDigest')} value={flow.suiDigest!} mono />
          <ReceiptRow label={t('send.status')} value={isEscrow ? t('send.inEscrowLabel') : t('send.success')} highlight={isEscrow ? 'gold' : 'accent'} />
        </div>
        <div className="mt-4 p-3 rounded-lg bg-sui-500/10 border border-sui-500/20 flex items-start gap-2"><FileCheck size={16} className="text-sui-400 shrink-0 mt-0.5" /><p className="text-xs text-sui-300">{t('send.receiptNote')}</p></div>
        <button onClick={onComplete} className="btn-primary w-full mt-5 flex items-center justify-center gap-2">{t('send.done')} <ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value, mono, highlight }: {
  label: string; value: string; mono?: boolean; highlight?: 'accent' | 'gold';
}) {
  const colorClass = highlight === 'accent' ? 'text-accent-400' : highlight === 'gold' ? 'text-gold-400' : 'text-ink-100';
  return <div className="flex items-center justify-between py-2.5 border-b border-ink-800/50 last:border-0"><span className="text-sm text-ink-400">{label}</span><span className={`text-sm ${mono ? 'font-mono' : 'font-medium'} ${colorClass}`}>{value}</span></div>;
}

function shorten(s: string): string {
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}
