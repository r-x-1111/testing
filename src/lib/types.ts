export type Page = 'dashboard' | 'send' | 'recipients' | 'history' | 'settings';

export type TranslationKey = import('./i18n').TranslationKey;

export interface Recipient {
  id: string;
  nickname: string;
  wallet_address: string;
  usual_amount: number;
  usual_token: string;
  language: string;
  trusted: boolean;
  wallet_confirmed: boolean;
  created_at: string;
}

export interface Guardian {
  id: string;
  name: string;
  relationship: string | null;
  created_at: string;
}

export interface PaymentPolicy {
  id: string;
  rule_type: string;
  threshold: number | null;
  guardian_id: string | null;
  enabled: boolean;
  created_at: string;
}

export type TxStatus =
  | 'draft'
  | 'clarifying'
  | 'verified'
  | 'paused'
  | 'awaiting_approval'
  | 'authorized'
  | 'escrow'
  | 'completed'
  | 'cancelled';

export type ExecutionMethod = 'instant' | 'safesend';

export interface ModelOutput {
  recipient: string;
  amount: number;
  token: string;
  purpose: string;
  wallet_address: string;
  model_id: string;
  confidence: number;
}

export interface ReasonCheckResult {
  claim: string;
  truth_score: number;
  claim_supported: boolean;
  recipient_connection: string;
  gonka_request_ids: string[];
  source_url?: string;
}

export interface FreshnessResult {
  fresh: boolean;
  last_checked: string;
  message: string;
}

export interface SafetyWarning {
  type: string;
  severity: 'info' | 'warning' | 'danger';
  title: string;
  detail: string;
}

export interface Transaction {
  id: string;
  recipient_name: string;
  wallet_address: string;
  amount: number;
  token: string;
  purpose: string | null;
  instruction: string | null;
  model_a_output: ModelOutput | null;
  model_b_output: ModelOutput | null;
  models_agree: boolean | null;
  reason_check: ReasonCheckResult | null;
  reason_freshness: FreshnessResult | null;
  safety_warnings: SafetyWarning[];
  intent_hash: string | null;
  purpose_hash: string | null;
  intent_valid_until: string | null;
  duplicate_flagged: boolean;
  second_approval_required: boolean;
  second_approval_status: string;
  execution_method: ExecutionMethod;
  escrow_until: string | null;
  sui_digest: string | null;
  status: TxStatus;
  receipt: Receipt | null;
  created_at: string;
}

export interface Receipt {
  intent_hash: string;
  purpose_hash: string;
  gonka_ids: string[];
  recipient_confirmed: boolean;
  user_authorized: boolean;
  execution: string;
  sui_digest: string;
  status: string;
}

export interface SendFlowState {
  instruction: string;
  modelA: ModelOutput | null;
  modelB: ModelOutput | null;
  modelsAgree: boolean | null;
  ambiguityFields: string[];
  reasonCheck: ReasonCheckResult | null;
  freshness: FreshnessResult | null;
  safetyWarnings: SafetyWarning[];
  recipient: Recipient | null;
  semanticHandshake: { expected: number; actual: number; mismatch: boolean } | null;
  intentHash: string | null;
  purposeHash: string | null;
  intentValidUntil: string | null;
  duplicateFlagged: boolean;
  secondApprovalRequired: boolean;
  secondApprovalStatus: string;
  executionMethod: ExecutionMethod;
  suiDigest: string | null;
  status: TxStatus;
  finalTransactionId: string | null;
}
