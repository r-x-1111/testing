import type { 
  FinancialPlan, 
  BudgetAnalysis, 
  AffordabilityCheck, 
  SafetyWarning,
  BudgetPurpose,
  Transaction 
} from './types';

const GONKA_API_URL = 'https://api.gonkarouter.io/v1/chat/completions';
const GONKA_API_KEY = import.meta.env.VITE_GONKA_API_KEY || '';

interface PlanParseResult {
  monthly_income: number;
  essential_expenses: number;
  emergency_savings_target: number;
  currency: string;
  purposes: Array<{
    name: string;
    category: string;
    planned_amount: number;
    description: string;
  }>;
}

export async function parseBudgetPlanFromText(
  instruction: string,
  language: string = 'en'
): Promise<PlanParseResult> {
  try {
    const response = await fetch(GONKA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GONKA_API_KEY}`,
        'X-Gonka-No-Fallback': 'true',
      },
      body: JSON.stringify({
        model: 'MiniMaxAI/MiniMax-M2.7',
        messages: [
          {
            role: 'system',
            content: `You are a financial planning assistant. Parse the user's income, expenses, and remittance plans. 
Return ONLY valid JSON (no markdown, no explanations) with this exact structure:
{
  "monthly_income": number,
  "essential_expenses": number,
  "emergency_savings_target": number,
  "currency": string (e.g., "RM", "USD", "USDC"),
  "purposes": [
    {
      "name": string,
      "category": "family_support" | "education" | "rent" | "emergency" | "other",
      "planned_amount": number,
      "description": string
    }
  ]
}`,
          },
          {
            role: 'user',
            content: `Parse this financial plan (language: ${language}): "${instruction}"`,
          },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content || '{}';
    
    // Remove markdown code blocks if present
    const cleaned = content
      .replace(/^```json\n?/, '')
      .replace(/\n?```$/, '')
      .trim();
    
    return JSON.parse(cleaned) as PlanParseResult;
  } catch (error) {
    console.error('Budget plan parsing error:', error);
    // Return minimal plan on error
    return {
      monthly_income: 0,
      essential_expenses: 0,
      emergency_savings_target: 0,
      currency: 'USDC',
      purposes: [],
    };
  }
}

export function analyzeBudget(plan: FinancialPlan): BudgetAnalysis {
  const totalPlanned = plan.purposes.reduce((sum, p) => sum + p.planned_amount, 0);
  const availableBeforeObligations =
    plan.monthly_income - plan.essential_expenses - plan.emergency_savings_target;
  const remainingAfterObligations = availableBeforeObligations - totalPlanned;
  const bufferPercentage = (plan.emergency_savings_target / plan.monthly_income) * 100;

  const warnings: SafetyWarning[] = [];

  if (remainingAfterObligations < 0) {
    warnings.push({
      type: 'budget_overcommitted',
      severity: 'danger',
      title: 'Budget Overcommitted',
      detail: `Your planned remittances (${totalPlanned} ${plan.currency}) exceed available funds by ${Math.abs(remainingAfterObligations)} ${plan.currency}`,
    });
  }

  if (bufferPercentage < 10) {
    warnings.push({
      type: 'low_emergency_buffer',
      severity: 'warning',
      title: 'Low Emergency Buffer',
      detail: `Your emergency savings target is only ${bufferPercentage.toFixed(1)}% of income. Consider increasing it to 15-20%.`,
    });
  }

  if (plan.purposes.length === 0) {
    warnings.push({
      type: 'no_purposes_defined',
      severity: 'info',
      title: 'No Remittance Plans',
      detail: 'You have not defined any planned remittances yet.',
    });
  }

  return {
    monthly_income: plan.monthly_income,
    essential_expenses: plan.essential_expenses,
    emergency_savings_target: plan.emergency_savings_target,
    total_planned_remittances: totalPlanned,
    available_for_transfers: availableBeforeObligations,
    remaining_after_obligations: remainingAfterObligations,
    buffer_percentage: bufferPercentage,
    affordability_warnings: warnings,
  };
}

export function checkAffordability(
  plan: FinancialPlan,
  proposedAmount: number,
  recentTransactions: Transaction[]
): AffordabilityCheck {
  const analysis = analyzeBudget(plan);

  // Calculate spending in the current period (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentSpending = recentTransactions
    .filter(
      (tx) =>
        tx.status === 'completed' && new Date(tx.created_at) > thirtyDaysAgo
    )
    .reduce((sum, tx) => sum + tx.amount, 0);

  const remainingAfterTransfer = analysis.remaining_after_obligations - proposedAmount;
  const remainingWithRecent = remainingAfterTransfer - recentSpending;
  const meetsEmergencyTarget =
    remainingWithRecent >= plan.emergency_savings_target * 0.5; // Allow dipping to 50% of target

  const warnings: SafetyWarning[] = [];

  if (proposedAmount > analysis.available_for_transfers) {
    warnings.push({
      type: 'exceeds_available',
      severity: 'danger',
      title: 'Exceeds Available Funds',
      detail: `You only have ${analysis.available_for_transfers} ${plan.currency} available, but you're trying to send ${proposedAmount} ${plan.currency}.`,
    });
  }

  if (!meetsEmergencyTarget) {
    warnings.push({
      type: 'emergency_buffer_threatened',
      severity: 'warning',
      title: 'Emergency Buffer at Risk',
      detail: `This transfer would reduce your emergency buffer below your target of ${plan.emergency_savings_target} ${plan.currency}.`,
    });
  }

  if (proposedAmount > 1.5 * getAverageTransferAmount(recentTransactions)) {
    warnings.push({
      type: 'unusually_high',
      severity: 'info',
      title: 'Unusually High Transfer',
      detail: `This ${proposedAmount} ${plan.currency} transfer is 50% higher than your typical amount. Please confirm.`,
    });
  }

  const recommendation =
    remainingAfterTransfer >= 0 && meetsEmergencyTarget
      ? `You can safely send ${proposedAmount} ${plan.currency}. You'll have ${remainingAfterTransfer} ${plan.currency} remaining.`
      : `Consider reducing the amount. Recommended maximum: ${Math.max(0, analysis.available_for_transfers * 0.8)} ${plan.currency}.`;

  return {
    proposed_amount: proposedAmount,
    remaining_after_transfer: remainingAfterTransfer,
    remaining_after_obligations: analysis.remaining_after_obligations,
    meets_emergency_target: meetsEmergencyTarget,
    warnings,
    recommendation,
  };
}

export function getAverageTransferAmount(transactions: Transaction[]): number {
  if (transactions.length === 0) return 0;
  const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  return total / transactions.length;
}

export function getRecurringRemittancePlans(plan: FinancialPlan): BudgetPurpose[] {
  return plan.purposes.filter((p) =>
    ['family_support', 'education', 'rent'].includes(p.category)
  );
}

export function estimateMonthlySurplus(plan: FinancialPlan): number {
  const totalPlanned = plan.purposes.reduce((sum, p) => sum + p.planned_amount, 0);
  return (
    plan.monthly_income -
    plan.essential_expenses -
    plan.emergency_savings_target -
    totalPlanned
  );
}

export function generateBudgetForecast(
  plan: FinancialPlan,
  monthsAhead: number = 6
): Array<{
  month: number;
  projected_balance: number;
  emergency_buffer: number;
  available_for_transfers: number;
}> {
  const surplus = estimateMonthlySurplus(plan);
  const forecast = [];

  for (let i = 1; i <= monthsAhead; i++) {
    const projectedBalance =
      surplus * i + plan.monthly_income - plan.essential_expenses;

    forecast.push({
      month: i,
      projected_balance: Math.max(0, projectedBalance),
      emergency_buffer: plan.emergency_savings_target,
      available_for_transfers: Math.max(
        0,
        projectedBalance - plan.emergency_savings_target
      ),
    });
  }

  return forecast;
}
