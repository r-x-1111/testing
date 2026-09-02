import { useEffect, useState, useCallback } from 'react';
import {
  Send, ArrowLeft, ArrowRight, Check, X, AlertTriangle, Info,
  ShieldCheck, Clock, Zap, Lock, Copy, FileCheck, UserCheck,
  Loader2, Languages, Sparkles, RefreshCw, Shield, Eye,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { runGonkaModel, compareModels, checkReason, checkFreshness } from '@/lib/gonka';
import { runSafetyLayer, checkDuplicate, evaluatePolicies } from '@/lib/safety';
import { generateIntentHash, generatePurposeHash, generateSuiDigest, generateGonkaId, executeOnSui } from '@/lib/sui';
import type { Recipient, Transaction, ModelOutput, PaymentPolicy, Guardian, SendFlowState, SafetyWarning } from '@/lib/types';
import { ProcessingOverlay } from '@/components/ProcessingOverlay';
import { WarningCard, CheckRow } from '@/components/WarningCard';
import { Modal } from '@/components/Modal';

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

const STEP_LABELS: Record<Step, string> = {
  input: 'Instruction',
  'dual-ai': 'Dual-AI Verify',
  reason: 'Reason Check',
  safety: 'Safety Layer',
  recipient: 'Recipient',
  intent: 'Intent Lock',
  duplicate: 'Duplicate Shield',
  approval: 'Second Approval',
  execution: 'Execution',
  authorize: 'Authorize',
  receipt: 'Receipt',
};

const EXAMPLES = [
  'Send Ahmad the usual plus 20 USDC for books',
  'Send 500 USDC to Ahmad because his family was affected by the earthquake',
  'Send 200 USDC to Fatima for September allowance',
  'Send 2000 USDC to Rina for medical expenses',
];

export function SendFlow({ onComplete }: { onComplete: () => void }) {
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

  useEffect(() => {
    loadData();
  }, []);

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
    await new Promise((r) => setTimeout(r, 1800));
    const modelA = runGonkaModel(flow.instruction, 'gonka-primus-v2', recipients, 0);
    await new Promise((r) => setTimeout(r, 600));
    const modelB = runGonkaModel(flow.instruction, 'gonka-sekunda-v1', recipients, 0);
    const comparison = compareModels(modelA, modelB);

    setFlow((prev) => ({
      ...prev,
      modelA,
      modelB,
      modelsAgree: comparison.agree,
      ambiguityFields: comparison.fields,
    }));
    setProcessing(false);

    if (!comparison.agree) {
      setShowClarify(true);
    } else {
      setStep('reason');
    }
  }, [flow.instruction, recipients]);

  const runReasonCheck = useCallback(async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1500));
    const reasonResult = checkReason(flow.instruction);
    const freshness = checkFreshness(reasonResult);

    setFlow((prev) => ({
      ...prev,
      reasonCheck: reasonResult,
      freshness,
    }));
    setProcessing(false);
    setStep('safety');
  }, [flow.instruction]);

  const runSafetyAnalysis = useCallback(async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1200));
    const model = flow.modelA!;
    const recipient = recipients.find((r) => r.nickname.toLowerCase() === model.recipient.toLowerCase()) ?? null;
    const warnings = runSafetyLayer(model, recipient, recentTx);

    setFlow((prev) => ({
      ...prev,
      recipient,
      safetyWarnings: warnings,
    }));
    setProcessing(false);
    setStep('recipient');
  }, [flow.modelA, recipients, recentTx]);

  const runIntentLock = useCallback(async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 1000));
    const intentHash = generateIntentHash();
    const purposeHash = generatePurposeHash();
    const validUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    setFlow((prev) => ({
      ...prev,
      intentHash,
      purposeHash,
      intentValidUntil: validUntil,
    }));
    setProcessing(false);
    setStep('duplicate');
  }, []);

  const runDuplicateCheck = useCallback(async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 800));
    const isDup = checkDuplicate(flow.modelA!, recentTx);
    setFlow((prev) => ({ ...prev, duplicateFlagged: isDup }));
    setProcessing(false);

    if (!isDup) {
      setStep('approval');
    }
  }, [flow.modelA, recentTx]);

  const runApprovalCheck = useCallback(async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 800));
    const result = evaluatePolicies(flow.modelA!, flow.recipient, policies);
    setFlow((prev) => ({
      ...prev,
      secondApprovalRequired: result.required,
      secondApprovalStatus: result.required ? 'awaiting' : 'not_required',
    }));
    setProcessing(false);
    setStep('execution');
  }, [flow.modelA, flow.recipient, policies]);

  const executeSui = useCallback(async () => {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 2000));
    const { digest, escrowUntil } = executeOnSui(
      flow.modelA!.amount,
      flow.modelA!.token,
      flow.modelA!.wallet_address,
      flow.executionMethod
    );

    const gonkaIds = [generateGonkaId(), generateGonkaId()];

    const receipt = {
      intent_hash: flow.intentHash!,
      purpose_hash: flow.purposeHash!,
      gonka_ids: gonkaIds,
      recipient_confirmed: flow.recipient?.wallet_confirmed ?? false,
      user_authorized: true,
      execution: flow.executionMethod,
      sui_digest: digest,
      status: 'SUCCESS',
    };

    const { data } = await supabase
      .from('transactions')
      .insert({
        recipient_name: flow.modelA!.recipient,
        wallet_address: flow.modelA!.wallet_address,
        amount: flow.modelA!.amount,
        token: flow.modelA!.token,
        purpose: flow.modelA!.purpose,
        instruction: flow.instruction,
        model_a_output: flow.modelA,
        model_b_output: flow.modelB,
        models_agree: flow.modelsAgree,
        reason_check: flow.reasonCheck,
        safety_warnings: flow.safetyWarnings,
        intent_hash: flow.intentHash,
        purpose_hash: flow.purposeHash,
        intent_valid_until: flow.intentValidUntil,
        duplicate_flagged: flow.duplicateFlagged,
        second_approval_required: flow.secondApprovalRequired,
        second_approval_status: flow.secondApprovalStatus,
        execution_method: flow.executionMethod,
        escrow_until: escrowUntil,
        sui_digest: digest,
        status: flow.executionMethod === 'safesend' ? 'escrow' : 'completed',
        receipt,
      })
      .select('*')
      .single();

    setFlow((prev) => ({
      ...prev,
      suiDigest: digest,
      status: flow.executionMethod === 'safesend' ? 'escrow' : 'completed',
      finalTransactionId: data?.id ?? null,
    }));
    setProcessing(false);
    setStep('receipt');
  }, [flow]);

  const handleSendFromInput = () => {
    if (!flow.instruction.trim()) return;
    setStep('dual-ai');
  };

  useEffect(() => {
    if (step === 'dual-ai' && !flow.modelA && !processing) {
      runDualAI();
    } else if (step === 'reason' && !flow.reasonCheck && !processing) {
      runReasonCheck();
    } else if (step === 'safety' && flow.safetyWarnings.length === 0 && !flow.recipient && !processing) {
      runSafetyAnalysis();
    } else if (step === 'intent' && !flow.intentHash && !processing) {
      runIntentLock();
    } else if (step === 'duplicate' && !flow.duplicateFlagged && !processing && flow.modelA) {
      runDuplicateCheck();
    } else if (step === 'approval' && flow.secondApprovalStatus === 'not_required' && !processing && flow.modelA) {
      runApprovalCheck();
    }
  }, [step]);

  // Auto-advance for reason check when there's no reason to check
  useEffect(() => {
    if (step === 'reason' && flow.reasonCheck === null && !processing) {
      setStep('safety');
    }
  }, [step, flow.reasonCheck, processing]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Stepper */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin pb-1">
          {STEP_ORDER.map((s, i) => {
            const isCurrent = s === step;
            const isPast = i < stepIndex;
            return (
              <div key={s} className="flex items-center shrink-0">
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isCurrent ? 'bg-sui-500/15 text-sui-300 border border-sui-500/20' :
                  isPast ? 'text-accent-400' : 'text-ink-600'
                }`}>
                  {isPast ? <Check size={12} /> : <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${isCurrent ? 'bg-sui-500/20' : 'bg-ink-800'}`}>{i + 1}</div>}
                  <span className="hidden sm:inline">{STEP_LABELS[s]}</span>
                </div>
                {i < STEP_ORDER.length - 1 && <div className={`w-3 h-px ${isPast ? 'bg-accent-500/30' : 'bg-ink-700'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {processing && (
        <ProcessingOverlay
          title={getProcessingTitle(step)}
          steps={getProcessingSteps(step)}
        />
      )}

      {!processing && step === 'input' && (
        <InputStep
          instruction={flow.instruction}
          setInstruction={(v) => setFlow((prev) => ({ ...prev, instruction: v }))}
          onSend={handleSendFromInput}
          examples={EXAMPLES}
        />
      )}

      {!processing && step === 'dual-ai' && flow.modelA && flow.modelB && (
        <DualAIStep
          modelA={flow.modelA}
          modelB={flow.modelB}
          agree={flow.modelsAgree ?? false}
          ambiguityFields={flow.ambiguityFields}
          onContinue={() => setStep('reason')}
          onClarify={() => { setFlow((prev) => ({ ...prev, instruction: '', modelA: null, modelB: null, modelsAgree: null })); setStep('input'); }}
        />
      )}

      {!processing && step === 'reason' && flow.reasonCheck && (
        <ReasonStep
          reasonCheck={flow.reasonCheck}
          freshness={flow.freshness}
          onContinue={() => setStep('safety')}
        />
      )}

      {!processing && step === 'safety' && flow.modelA && (
        <SafetyStep
          warnings={flow.safetyWarnings}
          model={flow.modelA}
          onContinue={() => setStep('recipient')}
        />
      )}

      {!processing && step === 'recipient' && flow.modelA && (
        <RecipientStep
          model={flow.modelA}
          recipient={flow.recipient}
          onContinue={() => setStep('intent')}
          onHandshake={() => setHandshakeModal(true)}
        />
      )}

      {!processing && step === 'intent' && flow.intentHash && (
        <IntentStep
          model={flow.modelA!}
          intentHash={flow.intentHash}
          purposeHash={flow.purposeHash}
          validUntil={flow.intentValidUntil}
          onContinue={() => setStep('duplicate')}
        />
      )}

      {!processing && step === 'duplicate' && flow.modelA && (
        <DuplicateStep
          flagged={flow.duplicateFlagged}
          model={flow.modelA}
          onContinue={() => setStep('approval')}
          onCancel={onComplete}
        />
      )}

      {!processing && step === 'approval' && flow.modelA && (
        <ApprovalStep
          required={flow.secondApprovalRequired}
          status={flow.secondApprovalStatus}
          guardians={guardians}
          onSimulateApproval={() => setFlow((prev) => ({ ...prev, secondApprovalStatus: 'approved' }))}
          onContinue={() => setStep('execution')}
        />
      )}

      {!processing && step === 'execution' && flow.modelA && (
        <ExecutionStep
          model={flow.modelA}
          method={flow.executionMethod}
          setMethod={(m) => setFlow((prev) => ({ ...prev, executionMethod: m }))}
          onContinue={() => setStep('authorize')}
        />
      )}

      {!processing && step === 'authorize' && flow.modelA && (
        <AuthorizeStep
          flow={flow}
          onConfirm={executeSui}
        />
      )}

      {!processing && step === 'receipt' && flow.modelA && (
        <ReceiptStep
          flow={flow}
          onComplete={onComplete}
        />
      )}

      {/* Clarify modal */}
      <Modal open={showClarify} onClose={() => setShowClarify(false)} title="Ambiguous Payment — Clarification Required">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle size={20} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-300">
              The two AI models disagreed on the following fields. Please clarify your instruction and try again.
            </p>
          </div>
          <div className="space-y-2">
            {flow.ambiguityFields.map((field) => (
              <div key={field} className="flex items-center gap-2 p-3 rounded-lg bg-ink-800/50">
                <X size={14} className="text-red-400" />
                <span className="text-sm text-ink-200 capitalize">{field}</span>
                <div className="ml-auto flex gap-4 text-xs">
                  <span className="text-ink-400">{String(flow.modelA?.[field as keyof ModelOutput] ?? '')}</span>
                  <span className="text-ink-600">vs</span>
                  <span className="text-ink-400">{String(flow.modelB?.[field as keyof ModelOutput] ?? '')}</span>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              setShowClarify(false);
              setFlow((prev) => ({ ...prev, instruction: '', modelA: null, modelB: null, modelsAgree: null, ambiguityFields: [] }));
              setStep('input');
            }}
            className="btn-primary w-full"
          >
            Clarify Instruction
          </button>
        </div>
      </Modal>

      {/* Semantic handshake modal */}
      <Modal open={handshakeModal} onClose={() => setHandshakeModal(false)} title="Semantic Handshake">
        <div className="space-y-4">
          <p className="text-sm text-ink-300">
            The recipient can confirm what they expect to receive. This catches cases where the sender and recipient understand the payment differently.
          </p>
          <div className="p-4 rounded-xl bg-ink-800/50 space-y-3">
            <div>
              <label className="text-xs text-ink-400">Recipient's expected amount</label>
              <input
                type="number"
                placeholder="e.g. 800"
                onChange={(e) => setSemanticMismatch(Number(e.target.value) !== flow.modelA?.amount)}
                className="input-field mt-1"
              />
            </div>
            {semanticMismatch && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertTriangle size={16} className="text-red-400" />
                <span className="text-sm text-red-300">Expectation mismatch — payment would be paused.</span>
              </div>
            )}
          </div>
          <button onClick={() => setHandshakeModal(false)} className="btn-secondary w-full">Close</button>
        </div>
      </Modal>
    </div>
  );
}

function getProcessingTitle(step: Step): string {
  const titles: Record<Step, string> = {
    input: '',
    'dual-ai': 'Routing through GonkaRouter...',
    reason: 'Verifying reason-to-send...',
    safety: 'Running predictive safety analysis...',
    recipient: 'Checking recipient trust status...',
    intent: 'Locking payment intent...',
    duplicate: 'Scanning for duplicates...',
    approval: 'Evaluating payment policies...',
    execution: 'Settling on Sui...',
    authorize: '',
    receipt: '',
  };
  return titles[step];
}

function getProcessingSteps(step: Step): { label: string; status: 'pending' | 'active' | 'done' }[] {
  const map: Record<Step, { label: string; status: 'pending' | 'active' | 'done' }[]> = {
    input: [],
    'dual-ai': [
      { label: 'Sending instruction to Model A (Gonka Primus)', status: 'done' },
      { label: 'Sending instruction to Model B (Gonka Sekunda)', status: 'active' },
      { label: 'Comparing structured outputs', status: 'pending' },
    ],
    reason: [
      { label: 'Extracting factual claim from instruction', status: 'done' },
      { label: 'Cross-referencing with Gonka knowledge base', status: 'active' },
      { label: 'Computing truth score', status: 'pending' },
    ],
    safety: [
      { label: 'Loading payment history', status: 'done' },
      { label: 'Analyzing amount, frequency, and patterns', status: 'active' },
      { label: 'Generating warnings', status: 'pending' },
    ],
    recipient: [
      { label: 'Looking up recipient profile', status: 'done' },
      { label: 'Checking wallet confirmation status', status: 'active' },
      { label: 'Preparing semantic handshake', status: 'pending' },
    ],
    intent: [
      { label: 'Hashing payment details', status: 'done' },
      { label: 'Creating intent lock', status: 'active' },
      { label: 'Setting validity window', status: 'pending' },
    ],
    duplicate: [
      { label: 'Scanning recent transactions', status: 'active' },
      { label: 'Comparing amounts and recipients', status: 'pending' },
    ],
    approval: [
      { label: 'Checking payment policies', status: 'active' },
      { label: 'Evaluating approval rules', status: 'pending' },
    ],
    execution: [
      { label: 'Building Programmable Transaction Block', status: 'done' },
      { label: 'Submitting to Sui network', status: 'active' },
      { label: 'Awaiting confirmation', status: 'pending' },
    ],
    authorize: [],
    receipt: [],
  };
  return map[step];
}

// ── Step Components ──────────────────────────────────────────

function InputStep({ instruction, setInstruction, onSend, examples }: {
  instruction: string;
  setInstruction: (v: string) => void;
  onSend: () => void;
  examples: string[];
}) {
  return (
    <div className="space-y-5">
      <div className="glass-card p-6 lg:p-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-sui-500/15 flex items-center justify-center">
            <Languages size={16} className="text-sui-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Describe Your Payment</h2>
        </div>
        <p className="text-sm text-ink-400 mb-5">
          Type naturally in any language. VeriSend will interpret your instruction through two independent AI models via GonkaRouter.
        </p>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. Send Ahmad the usual plus 20 USDC for books"
          rows={3}
          className="input-field resize-none text-base"
          autoFocus
        />
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-ink-500">{instruction.length} characters</span>
          <button onClick={onSend} disabled={!instruction.trim()} className="btn-primary flex items-center gap-2">
            <Send size={16} />
            Interpret & Verify
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs text-ink-500 mb-2 uppercase tracking-wider">Try an example</p>
        <div className="space-y-2">
          {examples.map((ex, i) => (
            <button
              key={i}
              onClick={() => setInstruction(ex)}
              className="w-full text-left p-3 rounded-xl bg-ink-900/40 hover:bg-ink-800/50 border border-ink-800 hover:border-sui-500/20 transition-all duration-200 group"
            >
              <p className="text-sm text-ink-300 group-hover:text-ink-100">{ex}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DualAIStep({ modelA, modelB, agree, ambiguityFields, onContinue, onClarify }: {
  modelA: ModelOutput;
  modelB: ModelOutput;
  agree: boolean;
  ambiguityFields: string[];
  onContinue: () => void;
  onClarify: () => void;
}) {
  const fields: { key: keyof ModelOutput; label: string }[] = [
    { key: 'recipient', label: 'Recipient' },
    { key: 'amount', label: 'Amount' },
    { key: 'token', label: 'Stablecoin' },
    { key: 'purpose', label: 'Purpose' },
    { key: 'wallet_address', label: 'Wallet' },
  ];

  return (
    <div className="space-y-5">
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-sui-500/15 flex items-center justify-center">
            <Sparkles size={16} className="text-sui-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Dual-AI Verification</h2>
        </div>

        <div className="flex items-center gap-3 mb-5">
          {agree ? (
            <span className="badge-success"><Check size={14} /> 2/2 models agree</span>
          ) : (
            <span className="badge-danger"><X size={14} /> Ambiguous payment detected</span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModelCard model={modelA} name="Model A" subtitle="Gonka Primus v2" />
          <ModelCard model={modelB} name="Model B" subtitle="Gonka Sekunda v1" />
        </div>

        <div className="mt-5 space-y-1">
          {fields.map((field) => {
            const valA = String(modelA[field.key]);
            const valB = String(modelB[field.key]);
            const fieldAgree = valA === valB;
            return (
              <div key={field.key} className="flex items-center gap-3 py-2 border-b border-ink-800/50 last:border-0">
                <span className="text-xs text-ink-500 w-24 shrink-0">{field.label}</span>
                <span className={`text-sm font-mono ${fieldAgree ? 'text-ink-200' : 'text-gold-400'}`}>{shorten(valA)}</span>
                <span className="text-ink-600 text-xs">vs</span>
                <span className={`text-sm font-mono ${fieldAgree ? 'text-ink-200' : 'text-gold-400'}`}>{shorten(valB)}</span>
                <span className="ml-auto">
                  {fieldAgree ? <Check size={14} className="text-accent-400" /> : <X size={14} className="text-gold-400" />}
                </span>
              </div>
            );
          })}
        </div>

        {agree ? (
          <button onClick={onContinue} className="btn-primary w-full mt-5 flex items-center justify-center gap-2">
            Continue to Reason Check <ArrowRight size={16} />
          </button>
        ) : (
          <button onClick={onClarify} className="btn-danger w-full mt-5 flex items-center justify-center gap-2">
            <AlertTriangle size={16} /> Clarify Instruction
          </button>
        )}
      </div>
    </div>
  );
}

function ModelCard({ model, name, subtitle }: { model: ModelOutput; name: string; subtitle: string }) {
  return (
    <div className="p-4 rounded-xl bg-ink-800/40 border border-ink-700/50">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-ink-100">{name}</p>
          <p className="text-xs text-ink-500">{subtitle}</p>
        </div>
        <span className="badge-info">{model.confidence}% conf.</span>
      </div>
      <div className="space-y-1.5 text-xs">
        <Row label="Recipient" value={model.recipient} />
        <Row label="Amount" value={`${model.amount.toLocaleString()} ${model.token}`} />
        <Row label="Purpose" value={model.purpose} />
        <Row label="Wallet" value={shorten(model.wallet_address)} mono />
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-500">{label}</span>
      <span className={`text-ink-200 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function ReasonStep({ reasonCheck, freshness, onContinue }: {
  reasonCheck: NonNullable<SendFlowState['reasonCheck']>;
  freshness: SendFlowState['freshness'];
  onContinue: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gold-500/15 flex items-center justify-center">
            <FileCheck size={16} className="text-gold-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Reason-to-Send Verification</h2>
        </div>

        <p className="text-sm text-ink-400 mb-4">Gonka checked the factual claim that influenced this payment.</p>

        <div className="p-4 rounded-xl bg-ink-800/40 border border-ink-700/50 space-y-3">
          <div className="flex items-start justify-between">
            <span className="text-sm text-ink-400">Claim</span>
            <span className="text-sm text-ink-100 text-right max-w-[70%]">{reasonCheck.claim}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-400">Truth Score</span>
            <span className={`text-lg font-bold ${reasonCheck.truth_score >= 70 ? 'text-accent-400' : 'text-gold-400'}`}>
              {reasonCheck.truth_score}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-400">Claim Supported</span>
            {reasonCheck.claim_supported ? <Check size={18} className="text-accent-400" /> : <X size={18} className="text-red-400" />}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-400">Recipient Connection</span>
            <span className="text-sm text-gold-400 flex items-center gap-1">
              <AlertTriangle size={14} /> {reasonCheck.recipient_connection}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-400">Gonka Request IDs</span>
            <span className="text-xs font-mono text-ink-300">{reasonCheck.gonka_request_ids.join(', ')}</span>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-start gap-2">
          <Info size={16} className="text-gold-400 shrink-0 mt-0.5" />
          <p className="text-xs text-gold-300">
            A real disaster does not automatically prove that the person requesting money is legitimate. Always verify the recipient independently.
          </p>
        </div>

        {freshness && (
          <div className="mt-4 flex items-center gap-2 text-xs text-ink-400">
            <Clock size={14} className="text-accent-400" />
            Freshness: {freshness.message}
          </div>
        )}

        <button onClick={onContinue} className="btn-primary w-full mt-5 flex items-center justify-center gap-2">
          Continue to Safety Analysis <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function SafetyStep({ warnings, model, onContinue }: {
  warnings: SafetyWarning[];
  model: ModelOutput;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
            <Shield size={16} className="text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Predictive Safety Layer</h2>
        </div>

        <p className="text-sm text-ink-400 mb-4">
          VeriSend evaluated whether this transaction looks unusual compared to your normal payment behavior.
        </p>

        {warnings.length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-accent-500/10 border border-accent-500/20">
            <Check size={20} className="text-accent-400" />
            <p className="text-sm text-accent-300">No unusual patterns detected. This payment looks normal.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {warnings.map((w, i) => <WarningCard key={i} warning={w} />)}
          </div>
        )}

        <div className="mt-4 p-3 rounded-lg bg-ink-800/40 flex items-start gap-2">
          <Info size={16} className="text-sui-400 shrink-0 mt-0.5" />
          <p className="text-xs text-ink-400">
            Prediction warns or prepares you. It does not silently authorize or cancel a legitimate payment. You remain in control.
          </p>
        </div>

        <button onClick={onContinue} className="btn-primary w-full mt-5 flex items-center justify-center gap-2">
          Continue to Recipient Check <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function RecipientStep({ model, recipient, onContinue, onHandshake }: {
  model: ModelOutput;
  recipient: Recipient | null;
  onContinue: () => void;
  onHandshake: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-sui-500/15 flex items-center justify-center">
            <UserCheck size={16} className="text-sui-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Trusted Recipient + Semantic Handshake</h2>
        </div>

        <div className="p-4 rounded-xl bg-ink-800/40 border border-ink-700/50 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sui-500/30 to-accent-500/30 flex items-center justify-center text-lg font-semibold text-white">
              {model.recipient[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-base font-semibold text-white">{model.recipient}</p>
              <p className="text-xs text-ink-500 font-mono">{shorten(model.wallet_address)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="flex items-center gap-2">
              {recipient?.trusted ? <Check size={16} className="text-accent-400" /> : <X size={16} className="text-gold-400" />}
              <span className="text-xs text-ink-300">{recipient?.trusted ? 'Trusted recipient' : 'Not trusted yet'}</span>
            </div>
            <div className="flex items-center gap-2">
              {recipient?.wallet_confirmed ? <Check size={16} className="text-accent-400" /> : <X size={16} className="text-gold-400" />}
              <span className="text-xs text-ink-300">{recipient?.wallet_confirmed ? 'Wallet confirmed' : 'Wallet unconfirmed'}</span>
            </div>
            {recipient && (
              <div className="flex items-center gap-2">
                <Languages size={14} className="text-sui-400" />
                <span className="text-xs text-ink-300">{recipient.language}</span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onHandshake}
          className="w-full mt-4 p-3 rounded-xl bg-ink-800/40 hover:bg-ink-800/60 border border-ink-700/50 transition-all flex items-center gap-3 text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-sui-500/15 flex items-center justify-center shrink-0">
            <ShieldCheck size={16} className="text-sui-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-ink-100">Semantic Handshake (optional)</p>
            <p className="text-xs text-ink-500">Ask the recipient to confirm what they expect to receive</p>
          </div>
          <ArrowRight size={16} className="text-ink-500" />
        </button>

        <button onClick={onContinue} className="btn-primary w-full mt-5 flex items-center justify-center gap-2">
          Continue to Intent Lock <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function IntentStep({ model, intentHash, purposeHash, validUntil, onContinue }: {
  model: ModelOutput;
  intentHash: string;
  purposeHash: string | null;
  validUntil: string | null;
  onContinue: () => void;
}) {
  const minsLeft = validUntil ? Math.max(0, Math.round((new Date(validUntil).getTime() - Date.now()) / 60000)) : 0;
  return (
    <div className="space-y-5">
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-accent-500/15 flex items-center justify-center">
            <Lock size={16} className="text-accent-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Intent Expiry + Drift Lock</h2>
        </div>

        <p className="text-sm text-ink-400 mb-4">
          An exact approved payment intent has been created. Any material change invalidates this verification.
        </p>

        <div className="p-4 rounded-xl bg-ink-800/40 border border-ink-700/50 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-400">Recipient</span>
            <span className="text-sm text-ink-100 font-medium">{model.recipient}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-400">Wallet</span>
            <span className="text-sm font-mono text-ink-200">{shorten(model.wallet_address)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-400">Amount</span>
            <span className="text-sm text-ink-100 font-medium">{model.amount.toLocaleString()} {model.token}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-400">Intent Hash</span>
            <span className="text-sm font-mono text-sui-300">{intentHash}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-400">Purpose Hash</span>
            <span className="text-sm font-mono text-sui-300">{purposeHash}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-400">Valid For</span>
            <span className="text-sm text-gold-400 font-medium flex items-center gap-1">
              <Clock size={14} /> {minsLeft} minutes
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          <p className="text-xs text-ink-500 uppercase tracking-wider mb-2">Drift Lock — any change invalidates:</p>
          {[
            'Amount change (e.g. 500 → 5,000)',
            'Different wallet address',
            'Different token',
            'Purpose change',
            'Intent expiry',
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-ink-400">
              <X size={12} className="text-red-400" /> {item}
            </div>
          ))}
        </div>

        <button onClick={onContinue} className="btn-primary w-full mt-5 flex items-center justify-center gap-2">
          Continue to Duplicate Shield <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function DuplicateStep({ flagged, model, onContinue, onCancel }: {
  flagged: boolean;
  model: ModelOutput;
  onContinue: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-sui-500/15 flex items-center justify-center">
            <Copy size={16} className="text-sui-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Duplicate Payment Shield</h2>
        </div>

        {flagged ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gold-500/10 border border-gold-500/20">
              <AlertTriangle size={20} className="text-gold-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gold-300">Possible Duplicate</p>
                <p className="text-xs text-gold-400/70 mt-0.5">
                  You already sent {model.amount.toLocaleString()} {model.token} to {model.recipient} recently.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
              <button onClick={onContinue} className="btn-primary flex-1 flex items-center justify-center gap-2">
                Send Again <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-accent-500/10 border border-accent-500/20">
              <Check size={20} className="text-accent-400 shrink-0" />
              <p className="text-sm text-accent-300">No duplicate detected. This is not a repeat of a recent payment.</p>
            </div>
            <button onClick={onContinue} className="btn-primary w-full flex items-center justify-center gap-2">
              Continue to Approval Check <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ApprovalStep({ required, status, guardians, onSimulateApproval, onContinue }: {
  required: boolean;
  status: string;
  guardians: Guardian[];
  onSimulateApproval: () => void;
  onContinue: () => void;
}) {
  const guardian = guardians[0];
  return (
    <div className="space-y-5">
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gold-500/15 flex items-center justify-center">
            <UserCheck size={16} className="text-gold-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Second-Person Approval</h2>
        </div>

        {!required ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-accent-500/10 border border-accent-500/20">
            <Check size={20} className="text-accent-400 shrink-0" />
            <p className="text-sm text-accent-300">No second approval required for this payment.</p>
          </div>
        ) : status === 'approved' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-accent-500/10 border border-accent-500/20">
              <Check size={20} className="text-accent-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-accent-300">Second approval received</p>
                <p className="text-xs text-accent-400/70 mt-0.5">{guardian?.name} ({guardian?.relationship}) approved this payment.</p>
              </div>
            </div>
            <button onClick={onContinue} className="btn-primary w-full flex items-center justify-center gap-2">
              Continue to Execution <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gold-500/10 border border-gold-500/20">
              <Clock size={20} className="text-gold-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gold-300">Second approval required</p>
                <p className="text-xs text-gold-400/70 mt-0.5">
                  Amount exceeds your 1,000 USDC threshold. Waiting for {guardian?.name ?? 'guardian'}...
                </p>
              </div>
            </div>
            <button onClick={onSimulateApproval} className="btn-secondary w-full flex items-center justify-center gap-2">
              <RefreshCw size={16} /> Simulate Guardian Approval
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ExecutionStep({ model, method, setMethod, onContinue }: {
  model: ModelOutput;
  method: 'instant' | 'safesend';
  setMethod: (m: 'instant' | 'safesend') => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-sui-500/15 flex items-center justify-center">
            <Zap size={16} className="text-sui-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">SafeSend — Execution Choice</h2>
        </div>

        <p className="text-sm text-ink-400 mb-5">
          Choose how the stablecoin should move. SafeSend routes through a Sui-enforced escrow with a recovery window.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => setMethod('instant')}
            className={`w-full p-4 rounded-xl border text-left transition-all ${
              method === 'instant'
                ? 'bg-sui-500/10 border-sui-500/30'
                : 'bg-ink-800/40 border-ink-700/50 hover:border-ink-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${method === 'instant' ? 'bg-sui-500/20' : 'bg-ink-700/50'}`}>
                <Zap size={18} className={method === 'instant' ? 'text-sui-400' : 'text-ink-400'} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink-100">Instant Send</p>
                <p className="text-xs text-ink-500">Settle directly to recipient immediately</p>
              </div>
              {method === 'instant' && <Check size={18} className="text-sui-400" />}
            </div>
          </button>

          <button
            onClick={() => setMethod('safesend')}
            className={`w-full p-4 rounded-xl border text-left transition-all ${
              method === 'safesend'
                ? 'bg-accent-500/10 border-accent-500/30'
                : 'bg-ink-800/40 border-ink-700/50 hover:border-ink-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${method === 'safesend' ? 'bg-accent-500/20' : 'bg-ink-700/50'}`}>
                <ShieldCheck size={18} className={method === 'safesend' ? 'text-accent-400' : 'text-ink-400'} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink-100">SafeSend (Escrow)</p>
                <p className="text-xs text-ink-500">Hold {model.amount.toLocaleString()} {model.token} in Sui escrow for 10 minutes</p>
              </div>
              {method === 'safesend' && <Check size={18} className="text-accent-400" />}
            </div>
          </button>
        </div>

        {method === 'safesend' && (
          <div className="mt-4 p-3 rounded-lg bg-accent-500/10 border border-accent-500/20 flex items-start gap-2">
            <Info size={16} className="text-accent-400 shrink-0 mt-0.5" />
            <p className="text-xs text-accent-300">
              If you discover a problem during the recovery window, you can cancel before release. Sui is part of the safety mechanism, not just the network.
            </p>
          </div>
        )}

        <button onClick={onContinue} className="btn-primary w-full mt-5 flex items-center justify-center gap-2">
          Continue to Final Authorization <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function AuthorizeStep({ flow, onConfirm }: {
  flow: SendFlowState;
  onConfirm: () => void;
}) {
  const model = flow.modelA!;
  return (
    <div className="space-y-5">
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-sui-500/15 flex items-center justify-center">
            <Eye size={16} className="text-sui-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Human Authorization — Final Checkpoint</h2>
        </div>

        <p className="text-sm text-ink-400 mb-5">
          AI can interpret, cross-check, fact-check and warn — but it does not have spending authority. Review the exact transaction and authorize.
        </p>

        <div className="p-5 rounded-xl bg-ink-800/40 border border-ink-700/50">
          <div className="space-y-0">
            <CheckRow label="Recipient" value={model.recipient} status="pass" />
            <CheckRow label="Wallet" value={flow.recipient?.wallet_confirmed ? 'Confirmed' : 'Unconfirmed'} status={flow.recipient?.wallet_confirmed ? 'pass' : 'pending'} />
            <CheckRow label="Amount" value={`${model.amount.toLocaleString()} ${model.token}`} status="pass" />
            <CheckRow label="Gonka models" value="2/2 agree" status="pass" />
            <CheckRow label="Reason check" value={flow.reasonCheck ? `${flow.reasonCheck.truth_score}% truth` : 'N/A'} status={flow.reasonCheck ? (flow.reasonCheck.truth_score >= 70 ? 'pass' : 'pending') : 'pass'} />
            <CheckRow label="Duplicate check" value={flow.duplicateFlagged ? 'Flagged' : 'Passed'} status={flow.duplicateFlagged ? 'pending' : 'pass'} />
            <CheckRow label="Intent Lock" value="Active" status="pass" />
            <CheckRow label="Second approval" value={flow.secondApprovalRequired ? (flow.secondApprovalStatus === 'approved' ? 'Approved' : 'Awaiting') : 'Not required'} status={flow.secondApprovalStatus === 'approved' || !flow.secondApprovalRequired ? 'pass' : 'pending'} />
            <CheckRow label="Execution" value={flow.executionMethod === 'safesend' ? `SafeSend — 10 min escrow` : 'Instant'} status="pass" />
          </div>
        </div>

        <button onClick={onConfirm} className="btn-primary w-full mt-5 flex items-center justify-center gap-2 text-base">
          <ShieldCheck size={18} /> Confirm & Send
        </button>
      </div>
    </div>
  );
}

function ReceiptStep({ flow, onComplete }: {
  flow: SendFlowState;
  onComplete: () => void;
}) {
  const model = flow.modelA!;
  const isEscrow = flow.status === 'escrow';
  return (
    <div className="space-y-5">
      <div className="glass-card p-6 lg:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full bg-accent-500/20 animate-pulse-ring" />
            <div className="relative w-16 h-16 rounded-full bg-accent-500/15 border-2 border-accent-500/30 flex items-center justify-center animate-check">
              <Check size={32} className="text-accent-400" strokeWidth={3} />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white">Verified Payment Receipt</h2>
          <p className="text-sm text-ink-400 mt-1">
            {isEscrow ? 'Payment is in Sui escrow. Funds will release in 10 minutes.' : 'Payment settled successfully on Sui.'}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-ink-800/40 border border-ink-700/50 space-y-0">
          <ReceiptRow label="Intent Hash" value={flow.intentHash!} mono />
          <ReceiptRow label="Purpose Hash" value={flow.purposeHash!} mono />
          <ReceiptRow label="Gonka Request IDs" value={flow.reasonCheck?.gonka_request_ids.join(', ') ?? 'GR-8F32A1, GR-9B71C4'} mono />
          <ReceiptRow label="Recipient" value={model.recipient} />
          <ReceiptRow label="Amount" value={`${model.amount.toLocaleString()} ${model.token}`} />
          <ReceiptRow label="Recipient Confirmation" value={flow.recipient?.wallet_confirmed ? 'Confirmed' : 'Not confirmed'} />
          <ReceiptRow label="User Authorization" value="Authorized" />
          <ReceiptRow label="Execution" value={flow.executionMethod === 'safesend' ? 'SafeSend (Escrow)' : 'Instant Send'} />
          <ReceiptRow label="Sui Transaction Digest" value={flow.suiDigest!} mono />
          <ReceiptRow label="Status" value={isEscrow ? 'In Escrow' : 'Success'} highlight={isEscrow ? 'gold' : 'accent'} />
        </div>

        <div className="mt-4 p-3 rounded-lg bg-sui-500/10 border border-sui-500/20 flex items-start gap-2">
          <FileCheck size={16} className="text-sui-400 shrink-0 mt-0.5" />
          <p className="text-xs text-sui-300">
            This on-chain receipt creates an auditable link between what was verified, what you authorized, and what Sui executed. Sensitive data remains off-chain.
          </p>
        </div>

        <button onClick={onComplete} className="btn-primary w-full mt-5 flex items-center justify-center gap-2">
          Done <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value, mono, highlight }: {
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

function shorten(s: string): string {
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}
