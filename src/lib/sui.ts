import type { ExecutionMethod } from './types';

function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

export function generateIntentHash(): string {
  return `${randomHex(4)}${randomHex(4)}${randomHex(4)}`;
}

export function generatePurposeHash(): string {
  return `${randomHex(4)}${randomHex(4)}`;
}

export function generateSuiDigest(): string {
  return `${randomHex(4)}${randomHex(4)}${randomHex(4)}`;
}

export function generateGonkaId(): string {
  return `GR-${randomHex(6).toUpperCase()}`;
}

export function executeOnSui(
  amount: number,
  token: string,
  recipientWallet: string,
  method: ExecutionMethod
): { digest: string; escrowUntil: string | null } {
  const digest = generateSuiDigest();
  const escrowUntil =
    method === 'safesend'
      ? new Date(Date.now() + 10 * 60 * 1000).toISOString()
      : null;
  return { digest, escrowUntil };
}
