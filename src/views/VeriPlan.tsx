import { useEffect, useState } from 'react';
import { DollarSign, Plus, TrendingUp, AlertTriangle, Info, CheckCircle, Trash2, Edit2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { parseBudgetPlanFromText, analyzeBudget, generateBudgetForecast } from '@/lib/veriplan';
import type { FinancialPlan, BudgetPurpose, BudgetAnalysis } from '@/lib/types';
import { useLang } from '@/lib/LanguageContext';
import { Modal } from '@/components/Modal';
import { VoiceInput } from '@/components/VoiceInput';

export function VeriPlan() {
  const { t } = useLang();
  const [plan, setPlan] = useState<FinancialPlan | null>(null);
  const [analysis, setAnalysis] = useState<BudgetAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddPurpose, setShowAddPurpose] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planInput, setPlanInput] = useState('');
  const [forecast, setForecast] = useState<any[]>([]);

  const [newPurpose, setNewPurpose] = useState({
    name: '',
    category: 'family_support' as BudgetPurpose['category'],
    planned_amount: 0,
    description: '',
  });

  useEffect(() => {
    loadPlan();
  }, []);

  async function loadPlan() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('financial_plans')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setPlan(data);
        setAnalysis(analyzeBudget(data));
        setForecast(generateBudgetForecast(data, 6));
      }
    } catch (error) {
      console.error('Failed to load plan:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createPlanFromText() {
    if (!planInput.trim()) return;
    setLoading(true);

    try {
      const parsed = await parseBudgetPlanFromText(planInput, 'en');

      const newPlan: Partial<FinancialPlan> = {
        monthly_income: parsed.monthly_income,
        essential_expenses: parsed.essential_expenses,
        emergency_savings_target: parsed.emergency_savings_target,
        currency: parsed.currency,
        purposes: parsed.purposes.map((p) => ({
          id: crypto.randomUUID(),
          ...p,
        })) as BudgetPurpose[],
        description: planInput,
        language: 'en',
      };

      const { data } = await supabase
        .from('financial_plans')
        .insert([newPlan])
        .select()
        .single();

      if (data) {
        setPlan(data);
        setAnalysis(analyzeBudget(data));
        setForecast(generateBudgetForecast(data, 6));
        setPlanInput('');
        setShowPlanModal(false);
      }
    } catch (error) {
      console.error('Failed to create plan:', error);
      alert('Failed to parse plan. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function addPurpose() {
    if (!newPurpose.name || newPurpose.planned_amount <= 0 || !plan) return;

    const updatedPurposes = [
      ...plan.purposes,
      {
        id: crypto.randomUUID(),
        ...newPurpose,
      },
    ];

    const { data } = await supabase
      .from('financial_plans')
      .update({ purposes: updatedPurposes })
      .eq('id', plan.id)
      .select()
      .single();

    if (data) {
      setPlan(data);
      setAnalysis(analyzeBudget(data));
      setNewPurpose({ name: '', category: 'family_support', planned_amount: 0, description: '' });
      setShowAddPurpose(false);
    }
  }

  async function removePurpose(purposeId: string) {
    if (!plan) return;

    const updatedPurposes = plan.purposes.filter((p) => p.id !== purposeId);

    const { data } = await supabase
      .from('financial_plans')
      .update({ purposes: updatedPurposes })
      .eq('id', plan.id)
      .select()
      .single();

    if (data) {
      setPlan(data);
      setAnalysis(analyzeBudget(data));
    }
  }

  if (loading && !plan) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-8 text-center">
          <DollarSign className="w-16 h-16 mx-auto text-blue-600 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">VeriPlan — Your Budget Planner</h2>
          <p className="text-gray-700 mb-6 max-w-md mx-auto">
            Tell us your income, expenses, and remittance plans. VeriPlan will help you understand what you can safely send.
          </p>
          <button
            onClick={() => setShowPlanModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition"
          >
            Start Your Budget Plan
          </button>
        </div>

        <Modal show={showPlanModal} onClose={() => setShowPlanModal(false)}>
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900">Create Your Financial Plan</h3>
            <p className="text-sm text-gray-600">
              Describe your monthly income, essential expenses, emergency savings target, and family obligations.
            </p>
            <VoiceInput onTranscript={(text) => setPlanInput(text)} />
            <textarea
              value={planInput}
              onChange={(e) => setPlanInput(e.target.value)}
              placeholder="E.g., 'I earn RM3,000. I need RM1,200 for expenses, want RM500 as emergency savings, and I support my parents every month.'"
              className="w-full h-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex gap-2">
              <button
                onClick={createPlanFromText}
                disabled={!planInput.trim() || loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                {loading ? 'Creating...' : 'Create Plan'}
              </button>
              <button
                onClick={() => setShowPlanModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-semibold py-2 px-4 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Financial Plan</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
            <p className="text-sm text-gray-600">Monthly Income</p>
            <p className="text-2xl font-bold text-green-700">
              {plan.monthly_income} {plan.currency}
            </p>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-lg p-4 border border-red-200">
            <p className="text-sm text-gray-600">Essential Expenses</p>
            <p className="text-2xl font-bold text-red-700">
              {plan.essential_expenses} {plan.currency}
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
            <p className="text-sm text-gray-600">Emergency Buffer Goal</p>
            <p className="text-2xl font-bold text-blue-700">
              {plan.emergency_savings_target} {plan.currency}
            </p>
          </div>
        </div>

        {analysis && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
              <p className="text-sm text-gray-600 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Available for Transfers
              </p>
              <p className="text-2xl font-bold text-purple-700">
                {analysis.available_for_transfers} {plan.currency}
              </p>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg p-4 border border-yellow-200">
              <p className="text-sm text-gray-600">After All Obligations</p>
              <p className="text-2xl font-bold text-amber-700">
                {analysis.remaining_after_obligations} {plan.currency}
              </p>
            </div>
          </div>
        )}

        {analysis?.affordability_warnings.length > 0 && (
          <div className="space-y-2 mb-6">
            {analysis.affordability_warnings.map((warning, idx) => (
              <div
                key={idx}
                className={`flex gap-3 p-3 rounded-lg ${
                  warning.severity === 'danger'
                    ? 'bg-red-50 border border-red-200'
                    : warning.severity === 'warning'
                    ? 'bg-yellow-50 border border-yellow-200'
                    : 'bg-blue-50 border border-blue-200'
                }`}
              >
                {warning.severity === 'danger' ? (
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                ) : warning.severity === 'warning' ? (
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold text-gray-900">{warning.title}</p>
                  <p className="text-sm text-gray-700">{warning.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">Planned Remittances</h3>
          <button
            onClick={() => setShowAddPurpose(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1 px-3 rounded-lg flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" /> Add Purpose
          </button>
        </div>

        {plan.purposes.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No remittance plans yet. Add one to get started.</p>
        ) : (
          <div className="space-y-3">
            {plan.purposes.map((purpose) => (
              <div key={purpose.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <p className="font-semibold text-gray-900">{purpose.name}</p>
                  <p className="text-sm text-gray-600">{purpose.description}</p>
                  <p className="text-sm font-medium text-blue-600 mt-1">
                    {purpose.planned_amount} {plan.currency}
                  </p>
                </div>
                <button
                  onClick={() => removePurpose(purpose.id)}
                  className="text-red-600 hover:text-red-700 p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Modal show={showAddPurpose} onClose={() => setShowAddPurpose(false)}>
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900">Add Remittance Plan</h3>
            <input
              type="text"
              value={newPurpose.name}
              onChange={(e) => setNewPurpose({ ...newPurpose, name: e.target.value })}
              placeholder="e.g., Parents' monthly allowance"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={newPurpose.category}
              onChange={(e) => setNewPurpose({ ...newPurpose, category: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="family_support">Family Support</option>
              <option value="education">Education</option>
              <option value="rent">Rent</option>
              <option value="emergency">Emergency</option>
              <option value="other">Other</option>
            </select>
            <input
              type="number"
              value={newPurpose.planned_amount || ''}
              onChange={(e) => setNewPurpose({ ...newPurpose, planned_amount: parseFloat(e.target.value) || 0 })}
              placeholder="Monthly amount"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              value={newPurpose.description}
              onChange={(e) => setNewPurpose({ ...newPurpose, description: e.target.value })}
              placeholder="Description (optional)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-20"
            />
            <div className="flex gap-2">
              <button
                onClick={addPurpose}
                disabled={!newPurpose.name || newPurpose.planned_amount <= 0}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 rounded-lg transition"
              >
                Add Purpose
              </button>
              <button
                onClick={() => setShowAddPurpose(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-semibold py-2 rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      </div>

      {forecast.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">6-Month Forecast</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-semibold text-gray-900">Month</th>
                  <th className="text-right py-2 font-semibold text-gray-900">Projected Balance</th>
                  <th className="text-right py-2 font-semibold text-gray-900">Emergency Buffer</th>
                  <th className="text-right py-2 font-semibold text-gray-900">Available</th>
                </tr>
              </thead>
              <tbody>
                {forecast.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2">Month {row.month}</td>
                    <td className="text-right font-medium text-gray-900">
                      {row.projected_balance} {plan.currency}
                    </td>
                    <td className="text-right text-blue-600">
                      {row.emergency_buffer} {plan.currency}
                    </td>
                    <td className="text-right text-green-600">
                      {row.available_for_transfers} {plan.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowPlanModal(true)}
        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
      >
        <Edit2 className="w-4 h-4" /> Edit Plan
      </button>
    </div>
  );
}
