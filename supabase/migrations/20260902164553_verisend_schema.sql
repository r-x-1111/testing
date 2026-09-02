/*
# VeriSend — AI-Verified Stablecoin Remittance Schema

## Overview
This migration creates the core tables for VeriSend, a single-tenant (no auth)
demo application. All data is intentionally shared/public for the demo, so
policies use `TO anon, authenticated` with `USING (true)`.

## New Tables

### recipients
Stores saved recipients with their wallet addresses, nickname, usual amount,
language preference, and trusted/confirmed status.

### transactions
Records every remittance attempt with its full verification journey:
- Dual-AI model outputs and agreement status
- Reason-to-send check results
- Safety layer warnings
- Intent lock hash and validity window
- Duplicate shield result
- Second-person approval status
- Execution method (instant vs SafeSend escrow)
- Final Sui settlement state and receipt data

### payment_policies
User-defined rules for second-person approval (e.g., amount thresholds,
new recipients, changed wallets).

### guardians
Trusted second approvers referenced by payment policies.

## Security
- RLS enabled on every table.
- Single-tenant demo: `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`.
*/

-- ── Recipients ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname text NOT NULL,
  wallet_address text NOT NULL,
  usual_amount numeric DEFAULT 0,
  usual_token text DEFAULT 'USDC',
  language text DEFAULT 'English',
  trusted boolean DEFAULT false,
  wallet_confirmed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_recipients" ON recipients;
CREATE POLICY "anon_select_recipients" ON recipients FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_recipients" ON recipients;
CREATE POLICY "anon_insert_recipients" ON recipients FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_recipients" ON recipients;
CREATE POLICY "anon_update_recipients" ON recipients FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_recipients" ON recipients;
CREATE POLICY "anon_delete_recipients" ON recipients FOR DELETE
  TO anon, authenticated USING (true);

-- ── Guardians ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  relationship text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_guardians" ON guardians;
CREATE POLICY "anon_select_guardians" ON guardians FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_guardians" ON guardians;
CREATE POLICY "anon_insert_guardians" ON guardians FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_guardians" ON guardians;
CREATE POLICY "anon_update_guardians" ON guardians FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_guardians" ON guardians;
CREATE POLICY "anon_delete_guardians" ON guardians FOR DELETE
  TO anon, authenticated USING (true);

-- ── Payment Policies ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type text NOT NULL,
  threshold numeric,
  guardian_id uuid REFERENCES guardians(id) ON DELETE SET NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_payment_policies" ON payment_policies;
CREATE POLICY "anon_select_payment_policies" ON payment_policies FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_payment_policies" ON payment_policies;
CREATE POLICY "anon_insert_payment_policies" ON payment_policies FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_payment_policies" ON payment_policies;
CREATE POLICY "anon_update_payment_policies" ON payment_policies FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_payment_policies" ON payment_policies;
CREATE POLICY "anon_delete_payment_policies" ON payment_policies FOR DELETE
  TO anon, authenticated USING (true);

-- ── Transactions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_name text NOT NULL,
  wallet_address text NOT NULL,
  amount numeric NOT NULL,
  token text NOT NULL DEFAULT 'USDC',
  purpose text,
  instruction text,
  -- Dual-AI verification
  model_a_output jsonb,
  model_b_output jsonb,
  models_agree boolean,
  -- Reason-to-send check
  reason_check jsonb,
  reason_freshness jsonb,
  -- Safety layer
  safety_warnings jsonb DEFAULT '[]'::jsonb,
  -- Intent lock
  intent_hash text,
  purpose_hash text,
  intent_valid_until timestamptz,
  -- Duplicate shield
  duplicate_flagged boolean DEFAULT false,
  -- Second approval
  second_approval_required boolean DEFAULT false,
  second_approval_status text DEFAULT 'not_required',
  -- Execution
  execution_method text DEFAULT 'instant',
  escrow_until timestamptz,
  -- Settlement
  sui_digest text,
  status text NOT NULL DEFAULT 'draft',
  receipt jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_transactions" ON transactions;
CREATE POLICY "anon_select_transactions" ON transactions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_transactions" ON transactions;
CREATE POLICY "anon_insert_transactions" ON transactions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_transactions" ON transactions;
CREATE POLICY "anon_update_transactions" ON transactions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_transactions" ON transactions;
CREATE POLICY "anon_delete_transactions" ON transactions FOR DELETE
  TO anon, authenticated USING (true);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions (status);
CREATE INDEX IF NOT EXISTS idx_transactions_recipient ON transactions (recipient_name);
