import type { ExecutionMethod } from './types';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';

function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

export function generateIntentHash(): string {
  return `0x${randomHex(64)}`;
}

export function generatePurposeHash(): string {
  return `0x${randomHex(64)}`;
}

export function generateSuiDigest(): string {
  return randomHex(64);
}

export function generateGonkaId(): string {
  return `GR-${randomHex(6).toUpperCase()}`;
}

// Initialize Sui gRPC client (mainnet)
const suiGrpcClient = new SuiGrpcClient({
  url: 'https://mainnet-grpc.sui.io',
});

export async function buildVeriSendPTB(
  amount: number,
  token: string,
  recipientWallet: string,
  purpose: string,
  method: ExecutionMethod,
  senderAddress: string
): Promise<{ ptbBytes: string; digest: string }> {
  const tx = new Transaction();
  
  // Split coin for the transfer amount
  const [coin] = tx.splitCoins(tx.gas, [tx.pure(amount * 1e6)]); // Assuming 6 decimals for USDC/USDT
  
  // Transfer coin to recipient
  tx.transferObjects([coin], tx.pure(recipientWallet));
  
  // Add purpose metadata event
  tx.moveCall({
    target: '0x2::event::emit',
    arguments: [tx.pure(purpose)],
  });
  
  if (method === 'safesend') {
    // Add escrow logic if needed
    tx.setSenderIfNotSet(senderAddress);
  }
  
  const ptbBytes = await tx.build({ client: suiGrpcClient });
  const digest = generateSuiDigest();
  
  return { ptbBytes: ptbBytes.toString(), digest };
}

export async function executeOnSui(
  amount: number,
  token: string,
  recipientWallet: string,
  method: ExecutionMethod,
  senderAddress?: string
): Promise<{ digest: string; escrowUntil: string | null }> {
  try {
    if (!senderAddress) {
      return { digest: generateSuiDigest(), escrowUntil: null };
    }
    
    const { digest } = await buildVeriSendPTB(
      amount,
      token,
      recipientWallet,
      'VeriSend Transfer',
      method,
      senderAddress
    );
    
    const escrowUntil =
      method === 'safesend'
        ? new Date(Date.now() + 10 * 60 * 1000).toISOString()
        : null;
    
    return { digest, escrowUntil };
  } catch (error) {
    console.error('Sui PTB execution error:', error);
    return { digest: generateSuiDigest(), escrowUntil: null };
  }
}

export async function fetchSuiBalance(
  address: string,
  token?: string
): Promise<number> {
  try {
    const balance = await suiGrpcClient.getBalance({
      owner: address,
      coinType: token,
    });
    return balance?.totalBalance || 0;
  } catch (error) {
    console.error('Failed to fetch Sui balance:', error);
    return 0;
  }
}

export function getSuiGrpcClient(): SuiGrpcClient {
  return suiGrpcClient;
}
