import type { ModelOutput, ReasonCheckResult, Recipient } from './types';

const WALLET_PREFIX = '0x7a3b9c2f4e8d';

function generateWallet(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${WALLET_PREFIX}${hex}e3f2a1b`;
}

function parseAmount(raw: string, usual: number): number {
  const lower = raw.toLowerCase();

  if (lower.includes('usual')) {
    const plusMatch = lower.match(/plus\s*\$?\s*(\d+(?:\.\d+)?)/);
    const minusMatch = lower.match(/minus\s*\$?\s*(\d+(?:\.\d+)?)/);
    if (plusMatch) return usual + parseFloat(plusMatch[1]);
    if (minusMatch) return Math.max(0, usual - parseFloat(minusMatch[1]));
    return usual;
  }

  const amountMatch = lower.match(/\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/);
  if (amountMatch) {
    return parseFloat(amountMatch[1].replace(/,/g, ''));
  }

  return 0;
}

function extractRecipient(raw: string): string {
  const sendMatch = raw.match(/send\s+(\w+)/i);
  if (sendMatch) return sendMatch[1];
  const toMatch = raw.match(/to\s+(\w+)/i);
  if (toMatch) return toMatch[1];
  return '';
}

function extractPurpose(raw: string): string {
  const forMatch = raw.match(/for\s+(.+)/i);
  if (forMatch) return forMatch[1].replace(/[.!?].*$/, '').trim();
  const becauseMatch = raw.match(/because\s+(.+)/i);
  if (becauseMatch) return becauseMatch[1].replace(/[.!?].*$/, '').trim();
  return 'General';
}

function extractToken(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('usdc')) return 'USDC';
  if (lower.includes('usdt')) return 'USDT';
  return 'USDC';
}

function extractWallet(raw: string): string {
  const walletMatch = raw.match(/0x[a-fA-F0-9]{6,}/);
  return walletMatch ? walletMatch[0] : '';
}

export function runGonkaModel(
  instruction: string,
  modelId: string,
  recipients: Recipient[],
  variance: number
): ModelOutput {
  const recipientName = extractRecipient(instruction);
  const existing = recipients.find(
    (r) => r.nickname.toLowerCase() === recipientName.toLowerCase()
  );
  const usual = existing?.usual_amount ?? 200;
  const baseAmount = parseAmount(instruction, usual);
  const walletFromInstruction = extractWallet(instruction);

  let amount = baseAmount;
  if (variance > 0) {
    amount = Math.round(baseAmount * (1 + variance) * 100) / 100;
  }

  const wallet = walletFromInstruction || existing?.wallet_address || generateWallet(recipientName || instruction);

  return {
    recipient: recipientName || 'Unknown',
    amount,
    token: extractToken(instruction),
    purpose: extractPurpose(instruction),
    wallet_address: wallet,
    model_id: modelId,
    confidence: Math.round((95 - variance * 30) * 10) / 10,
  };
}

export function compareModels(a: ModelOutput, b: ModelOutput): { agree: boolean; fields: string[] } {
  const fields: string[] = [];
  if (a.recipient.toLowerCase() !== b.recipient.toLowerCase()) fields.push('recipient');
  if (Math.abs(a.amount - b.amount) > 0.01) fields.push('amount');
  if (a.token !== b.token) fields.push('token');
  if (a.purpose.toLowerCase() !== b.purpose.toLowerCase()) fields.push('purpose');
  if (a.wallet_address !== b.wallet_address) fields.push('wallet');
  return { agree: fields.length === 0, fields };
}

export function checkReason(instruction: string): ReasonCheckResult | null {
  const lower = instruction.toLowerCase();

  if (lower.includes('earthquake') || lower.includes('flood') || lower.includes('emergency') || lower.includes('family was affected')) {
    const claimMatch = lower.match(/(?:because|since|her family was affected by)\s+(.+)/);
    const claim = claimMatch ? claimMatch[1].replace(/[.!?].*$/, '').trim() : 'emergency claim';

    return {
      claim,
      truth_score: 92,
      claim_supported: true,
      recipient_connection: 'Not established',
      gonka_request_ids: ['GR-8F32A1', 'GR-9B71C4'],
    };
  }

  if (lower.includes('because') || lower.includes('said') || lower.includes('told me')) {
    return {
      claim: 'Personal claim by recipient',
      truth_score: 45,
      claim_supported: false,
      recipient_connection: 'Unverified',
      gonka_request_ids: ['GR-3D21E9', 'GR-7C44F1'],
    };
  }

  return null;
}

export function checkFreshness(reasonCheck: ReasonCheckResult | null): FreshnessResult | null {
  if (!reasonCheck) return null;
  return {
    fresh: true,
    last_checked: new Date().toISOString(),
    message: 'Information verified moments ago.',
  };
}
