import { supabase } from '@/lib/supabase';
import type { Recipient, Guardian, PaymentPolicy, FinancialPlan, BudgetPurpose } from '@/lib/types';

export async function seedExampleData() {
  try {
    // Seed Recipients
    const exampleRecipients: Partial<Recipient>[] = [
      {
        nickname: 'Ahmad',
        wallet_address: '0x7a3b9c2f4e8d1234e3f2a1b5c9d2e8f',
        usual_amount: 200,
        usual_token: 'USDC',
        language: 'en',
        trusted: true,
        wallet_confirmed: true,
      },
      {
        nickname: 'Fatima',
        wallet_address: '0x8b4c0d3f5f9e2345f4g3b2c6d0e3f9g',
        usual_amount: 300,
        usual_token: 'USDC',
        language: 'en',
        trusted: true,
        wallet_confirmed: false,
      },
      {
        nickname: 'Rina',
        wallet_address: '0x9c5d1e4g6g0f3456g5h4c3d7e1f4g0h',
        usual_amount: 500,
        usual_token: 'USDC',
        language: 'en',
        trusted: false,
        wallet_confirmed: false,
      },
    ];

    for (const recipient of exampleRecipients) {
      const { data } = await supabase
        .from('recipients')
        .select('id')
        .eq('nickname', recipient.nickname)
        .single()
        .catch(() => ({ data: null }));

      if (!data) {
        await supabase.from('recipients').insert([recipient]);
      }
    }

    // Seed Guardians
    const exampleGuardians: Partial<Guardian>[] = [
      {
        name: 'Mom',
        relationship: 'Mother',
      },
      {
        name: 'Best Friend',
        relationship: 'Friend',
      },
    ];

    const guardianIds: string[] = [];
    for (const guardian of exampleGuardians) {
      const { data } = await supabase
        .from('guardians')
        .select('id')
        .eq('name', guardian.name)
        .single()
        .catch(() => ({ data: null }));

      if (data) {
        guardianIds.push(data.id);
      } else {
        const { data: newGuardian } = await supabase
          .from('guardians')
          .insert([guardian])
          .select()
          .single();
        if (newGuardian) guardianIds.push(newGuardian.id);
      }
    }

    // Seed Payment Policies
    if (guardianIds.length > 0) {
      const examplePolicies: Partial<PaymentPolicy>[] = [
        {
          rule_type: 'amount_threshold',
          threshold: 1000,
          guardian_id: guardianIds[0],
          enabled: true,
        },
        {
          rule_type: 'new_recipient',
          threshold: null,
          guardian_id: guardianIds[0],
          enabled: true,
        },
      ];

      for (const policy of examplePolicies) {
        const { data } = await supabase
          .from('payment_policies')
          .select('id')
          .eq('rule_type', policy.rule_type)
          .eq('guardian_id', policy.guardian_id)
          .single()
          .catch(() => ({ data: null }));

        if (!data) {
          await supabase.from('payment_policies').insert([policy]);
        }
      }
    }

    // Seed Financial Plan
    const examplePurposes: BudgetPurpose[] = [
      {
        id: crypto.randomUUID(),
        name: "Parents' Monthly Allowance",
        category: 'family_support',
        planned_amount: 300,
        description: 'Regular monthly support for parents',
      },
      {
        id: crypto.randomUUID(),
        name: 'Cousin Medical Support',
        category: 'emergency',
        planned_amount: 200,
        description: 'Emergency medical fund',
      },
      {
        id: crypto.randomUUID(),
        name: 'Student Loan Contribution',
        category: 'education',
        planned_amount: 150,
        description: 'Help with younger sibling education',
      },
    ];

    const examplePlan: Partial<FinancialPlan> = {
      monthly_income: 3000,
      essential_expenses: 1200,
      emergency_savings_target: 500,
      currency: 'USDC',
      purposes: examplePurposes,
      description: 'I earn 3000 USDC. I need 1200 for expenses, want 500 as emergency savings, and I support my parents every month.',
      language: 'en',
    };

    const { data: existingPlan } = await supabase
      .from('financial_plans')
      .select('id')
      .limit(1)
      .single()
      .catch(() => ({ data: null }));

    if (!existingPlan) {
      await supabase.from('financial_plans').insert([examplePlan]);
    }

    console.log('✅ Example data seeded successfully');
    return true;
  } catch (error) {
    console.error('Failed to seed example data:', error);
    return false;
  }
}
