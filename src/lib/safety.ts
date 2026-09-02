import type { SafetyWarning, Recipient, ModelOutput, PaymentPolicy, Transaction } from './types';

export function runSafetyLayer(
  model: ModelOutput,
  recipient: Recipient | null,
  recentTransactions: Transaction[]
): SafetyWarning[] {
  const warnings: SafetyWarning[] = [];

  if (recipient && recipient.usual_amount > 0) {
    const ratio = model.amount / recipient.usual_amount;
    if (ratio >= 5) {
      warnings.push({
        type: 'unusual_amount',
        severity: 'danger',
        title: `Unusual amount — ${ratio.toFixed(0)}× your usual transfer`,
        detail: `You normally send ${recipient.nickname} ${recipient.usual_amount} ${model.token}. This payment is ${model.amount.toLocaleString()} ${model.token}.`,
      });
    } else if (ratio >= 2) {
      warnings.push({
        type: 'unusual_amount',
        severity: 'warning',
        title: `Amount is higher than usual`,
        detail: `You normally send ${recipient.usual_amount} ${model.token}. This is ${model.amount.toLocaleString()} ${model.token}.`,
      });
    }
  }

  if (model.amount >= 1000) {
    warnings.push({
      type: 'large_payment',
      severity: 'warning',
      title: 'Large payment',
      detail: `This transfer of ${model.amount.toLocaleString()} ${model.token} exceeds 1,000 ${model.token}.`,
    });
  }

  if (recipient && !recipient.trusted) {
    warnings.push({
      type: 'new_recipient',
      severity: 'warning',
      title: 'New or untrusted recipient',
      detail: `${recipient.nickname} is not marked as a trusted recipient. Please verify the wallet address.`,
    });
  }

  if (recipient && !recipient.wallet_confirmed) {
    warnings.push({
      type: 'unconfirmed_wallet',
      severity: 'info',
      title: 'Wallet not confirmed',
      detail: `${recipient.nickname} has not yet confirmed control of this wallet through a signed verification.`,
    });
  }

  const today = new Date().toDateString();
  const todayTx = recentTransactions.filter(
    (t) =>
      new Date(t.created_at).toDateString() === today &&
      t.recipient_name.toLowerCase() === model.recipient.toLowerCase() &&
      t.status === 'completed'
  );
  if (todayTx.length >= 1) {
    warnings.push({
      type: 'frequency',
      severity: 'info',
      title: 'Already sent to this recipient today',
      detail: `You have already sent ${todayTx.length} payment(s) to ${model.recipient} today.`,
    });
  }

  return warnings;
}

export function checkDuplicate(
  model: ModelOutput,
  recentTransactions: Transaction[]
): boolean {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  return recentTransactions.some(
    (t) =>
      new Date(t.created_at).getTime() > oneHourAgo &&
      t.recipient_name.toLowerCase() === model.recipient.toLowerCase() &&
      Math.abs(t.amount - model.amount) < 0.01 &&
      t.token === model.token &&
      t.status === 'completed'
  );
}

export function evaluatePolicies(
  model: ModelOutput,
  recipient: Recipient | null,
  policies: PaymentPolicy[]
): { required: boolean; policy: PaymentPolicy | null } {
  for (const policy of policies) {
    if (!policy.enabled) continue;

    if (policy.rule_type === 'amount_threshold' && policy.threshold) {
      if (model.amount >= policy.threshold) {
        return { required: true, policy };
      }
    }

    if (policy.rule_type === 'new_recipient') {
      if (recipient && !recipient.trusted) {
        return { required: true, policy };
      }
    }

    if (policy.rule_type === 'changed_wallet') {
      if (recipient && recipient.wallet_address !== model.wallet_address) {
        return { required: true, policy };
      }
    }
  }

  return { required: false, policy: null };
}
