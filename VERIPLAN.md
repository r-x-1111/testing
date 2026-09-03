# VeriPlan — Predictive AI Budget & Remittance Planner

VeriPlan is an optional pre-payment planning layer that helps users decide how much they can reasonably send before VeriSend begins the transaction-safety flow. It is not a generic investment adviser and it never moves money by itself.

## Overview

VeriPlan enables users to:
- Create a transparent, income-based budget
- Plan recurring remittances without auto-authorizing them
- Get real-time affordability feedback
- Integrate budget awareness into every payment decision through the predictive safety layer

## How It Works

### 1. Budget Creation

Users describe their financial situation using natural language:

```
"I earn RM3,000. I need RM1,200 for expenses, want RM500 as emergency savings, 
and I support my parents every month."
```

**VeriPlan uses Gonka (MiniMax-M2.7) to parse and understand:**
- Monthly income
- Essential expenses
- Emergency savings targets
- Family obligations and support commitments
- Planned remittances by category

### 2. Budget Analysis

VeriPlan performs deterministic arithmetic to create a transparent budget:

```
Income:                      RM3,000
- Essential Expenses:       (RM1,200)
- Emergency Savings Target: (RM500)
= Available for Transfers:   RM1,300
```

### 3. Affordability Checks

For any proposed transfer, VeriPlan checks:
- **Exceeds Available Funds**: "You only have 1,300 RM available, but you're trying to send 2,000"
- **Emergency Buffer Threatened**: "This transfer would reduce your emergency buffer below your target"
- **Unusually High**: "This is 50% higher than your typical amount"
- **Historical Context**: Compares against recent transaction patterns

## Example: Complete Flow

### User's Plan

```
"I earn 3000 USDC. I need 1200 for expenses, want 500 as emergency savings, 
and I support my parents every month."
```

### VeriPlan Analysis

| Component | Amount | Notes |
|-----------|--------|-------|
| Monthly Income | 3000 USDC | Total income |
| Essential Expenses | 1200 USDC | Fixed monthly costs |
| Emergency Savings Target | 500 USDC | Buffer goal (17% of income) |
| **Available Before Obligations** | **1300 USDC** | After expenses & savings |
| Planned Remittances | 650 USDC | Sum of all purposes |
| **Remaining After Obligations** | **650 USDC** | True surplus |
| Buffer Percentage | 16.7% | Emergency as % of income |

### Planned Remittances (Purposes)

| Purpose | Category | Amount | Description |
|---------|----------|--------|-------------|
| Parents | family_support | 300 USDC | Monthly allowance |
| Cousin Medical | emergency | 200 USDC | Health fund |
| Student Loan | education | 150 USDC | Sibling education |

### Affordability Check Example

**Proposed: Send Ahmad 400 USDC**

```
Remaining after transfer: 450 USDC (from 650)
Remaining after obligations: 450 USDC
Meets emergency target: YES (450 > 250, which is 50% of 500 target)

Recommendation:
✓ You can safely send 400 USDC. You'll have 450 USDC remaining.
```

**Alternative: Send Ahmad 800 USDC**

```
Remaining after transfer: -150 USDC (NEGATIVE!)
Remaining after obligations: -150 USDC
Meets emergency target: NO

Warnings:
⚠️ Exceeds Available Funds
   You only have 650 USDC available, but you're trying to send 800 USDC.

⚠️ Emergency Buffer at Risk
   This transfer would reduce your emergency buffer below your target.

Recommendation:
Consider reducing the amount. Recommended maximum: 520 USDC (80% of available).
```

## Budget Purpose Categories

VeriPlan supports five predefined categories:

| Category | Use Case | Examples |
|----------|----------|----------|
| **family_support** | Regular family remittances | Parents, siblings, grandparents |
| **education** | Student support and tuition | Siblings, children, tuition |
| **rent** | Rent or housing obligations | Family property, shared housing |
| **emergency** | Emergency response funds | Medical, disaster, crisis |
| **other** | Custom purposes | Special projects, gifts |

## Integration with VeriSend SendFlow

### Step: Safety Layer

When users initiate a payment in SendFlow:

1. **Dual-AI Verification** (MiniMax + Kimi) confirms payment details
2. **Reason Check** validates the purpose claim
3. **Safety Layer** includes affordability checks from VeriPlan
4. **Recipient Check** matches against trusted recipients
5. ... (other safety checks)

### Affordability in Safety Warnings

If a user has a VeriPlan, proposed transfers are checked:

```typescript
if (financialPlan && proposedAmount) {
  const affordability = checkAffordability(
    financialPlan, 
    proposedAmount, 
    recentTransactions
  );
  safetyWarnings.push(...affordability.warnings);
}
```

### Safety Layer Notification Example

```
🔴 DANGER: Exceeds Available Funds
   Your VeriPlan shows you have 650 USDC available for transfers.
   This payment (800 USDC) exceeds that by 150 USDC.

🟡 WARNING: Emergency Buffer at Risk
   Your emergency savings goal is 500 USDC.
   After this transfer, you'd have only 250 USDC remaining.
   Consider reducing the amount or postponing this payment.

💡 INFO: Unusually High Transfer
   This 800 USDC is 3x your typical 280 USDC average.
   Please confirm this is intentional.
```

## 6-Month Forecasting

VeriPlan generates a forward-looking forecast:

```
Month 1: Available: 650 USDC  | Buffer: 500 USDC
Month 2: Available: 650 USDC  | Buffer: 500 USDC
Month 3: Available: 650 USDC  | Buffer: 500 USDC
Month 4: Available: 650 USDC  | Buffer: 500 USDC
Month 5: Available: 650 USDC  | Buffer: 500 USDC
Month 6: Available: 650 USDC  | Buffer: 500 USDC
```

This helps users:
- Plan major upcoming remittances
- Understand multi-month cash flow
- Schedule transfers strategically
- Build confidence in their budget

## Recurring Remittance Planning

VeriPlan identifies recurring obligations:

```typescript
const recurring = getRecurringRemittancePlans(plan);
// Returns: [Parents (family_support), Cousin (emergency), Student (education)]

const surplus = estimateMonthlySurplus(plan);
// Returns: 650 USDC (amount available after all recurring plans)
```

Users can:
- Confirm or adjust recurring amounts
- See what's left after commitments
- Plan additional one-off transfers within the surplus
- Track cumulative impact over time

## Key Principles

### 1. **Transparent Arithmetic**
- All calculations use deterministic, auditable formulas
- Users see exactly how their budget is computed
- No "black box" financial advice

### 2. **Non-Authorizing**
- VeriPlan never moves money
- Plans are always user-reviewed before execution
- Budget warnings are advisory, not restrictive

### 3. **Integrated Safety**
- Budget context improves safety warnings
- "Unusual" is relative to both behavior and budget capacity
- Users get richer context for every decision

### 4. **Predictive, Not Prescriptive**
- VeriPlan helps users foresee consequences
- It warns about risks but lets users choose
- Payment authorization remains fully under user control

## Data Structures

### FinancialPlan

```typescript
interface FinancialPlan {
  id: string;
  user_id: string;
  monthly_income: number;
  essential_expenses: number;
  emergency_savings_target: number;
  currency: string;                    // "USDC", "RM", "USD", etc.
  purposes: BudgetPurpose[];
  description: string;                 // Original natural language plan
  language: string;                    // Language of description
  created_at: string;
  updated_at: string;
}
```

### BudgetPurpose

```typescript
interface BudgetPurpose {
  id: string;
  name: string;
  category: 'family_support' | 'education' | 'rent' | 'emergency' | 'other';
  planned_amount: number;
  description: string;
}
```

### BudgetAnalysis (Computed)

```typescript
interface BudgetAnalysis {
  monthly_income: number;
  essential_expenses: number;
  emergency_savings_target: number;
  total_planned_remittances: number;
  available_for_transfers: number;
  remaining_after_obligations: number;
  buffer_percentage: number;
  affordability_warnings: SafetyWarning[];
}
```

### AffordabilityCheck (Per-Transaction)

```typescript
interface AffordabilityCheck {
  proposed_amount: number;
  remaining_after_transfer: number;
  remaining_after_obligations: number;
  meets_emergency_target: boolean;
  warnings: SafetyWarning[];
  recommendation: string;
}
```

## API Functions

### Core Functions

```typescript
// Parse natural language budget description
async function parseBudgetPlanFromText(instruction, language): PlanParseResult

// Analyze a budget plan
function analyzeBudget(plan): BudgetAnalysis

// Check affordability of a proposed transfer
function checkAffordability(plan, amount, recentTransactions): AffordabilityCheck

// Get recurring remittance plans
function getRecurringRemittancePlans(plan): BudgetPurpose[]

// Calculate monthly surplus
function estimateMonthlySurplus(plan): number

// Generate 6-month forecast
function generateBudgetForecast(plan, monthsAhead): ForecastRow[]

// Get average transfer amount from history
function getAverageTransferAmount(transactions): number
```

## Example Integration in SendFlow

```typescript
// When creating a payment
const plan = await loadFinancialPlan(userId);
const modelA = await runGonkaModel(instruction, MODEL_A);
const proposedAmount = modelA.amount;

if (plan) {
  const affordability = checkAffordability(plan, proposedAmount, recentTx);
  
  // Add affordability warnings to safety layer
  warnings.push(...affordability.warnings);
  
  // Show recommendation to user
  displayRecommendation(affordability.recommendation);
}
```

## Creating Example Data

```typescript
import { seedExampleData } from '@/lib/seedData';

// Seeds: Recipients, Guardians, Policies, and Financial Plan
await seedExampleData();
```

## Voice & Multilingual Support

VeriPlan supports voice input and multiple languages:

```typescript
const instruction = await recordVoiceInput(); // "I earn RM3000..."
const plan = await parseBudgetPlanFromText(instruction, 'ms');
```

Supported languages include:
- English (en)
- Bahasa Melayu (ms)
- Bengali (bn)
- Indonesian (id)
- Arabic (ar)
- Hindi (hi)
- Chinese (zh)
- Spanish (es)
- French (fr)
- Urdu (ur)
- Filipino (tl)

## Limitations & Notes

1. **Not Financial Advice**: VeriPlan helps users understand their own budgets. It does not provide investment advice or recommendations to change spending habits.

2. **Static Income**: Current implementation assumes fixed monthly income. Future versions could support variable income tracking.

3. **No Auto-Authorization**: Plans are never executed automatically. Every transfer still requires explicit user approval.

4. **Historical-Only**: Safety checks only analyze past transactions. Forward-looking predictions are based on stated plans.

5. **Gonka Dependency**: Natural language parsing relies on Gonka API availability. If unavailable, users can enter budget data manually.

## Future Enhancements

- **Savings Goals**: Track progress toward additional savings targets
- **Expense Categorization**: Automatic categorization of historical spending
- **Scenario Planning**: "What-if" analysis for different income levels
- **Family Budgets**: Shared budgets between guardians
- **Seasonal Adjustments**: Handle seasonal income variations
- **Currency Conversion**: Real-time rates for multi-currency remittances
- **Archive**: Historical budget comparisons and trend analysis

---

## Quick Start

1. **Navigate to VeriPlan** from the dashboard
2. **Describe your budget** using voice or text
3. **Gonka parses** your income, expenses, and commitments
4. **Review the analysis** showing available transfer capacity
5. **Add purposes** for specific remittances
6. **Check affordability** on the next SendFlow payment
7. **Stay informed** with predictive safety warnings

VeriPlan makes every payment decision richer by connecting it to your total financial picture.
