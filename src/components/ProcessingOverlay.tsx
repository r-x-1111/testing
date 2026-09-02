import { Loader2, Check } from 'lucide-react';

interface ProcessingOverlayProps {
  title: string;
  steps: { label: string; status: 'pending' | 'active' | 'done' }[];
}

export function ProcessingOverlay({ title, steps }: ProcessingOverlayProps) {
  return (
    <div className="flex flex-col items-center py-6 animate-fade-in">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-sui-500/20 animate-pulse-ring" />
        <div className="relative w-16 h-16 rounded-full bg-sui-500/10 border-2 border-sui-500/30 flex items-center justify-center">
          <Loader2 size={28} className="text-sui-400 animate-spin" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <div className="w-full max-w-sm space-y-2.5">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              {step.status === 'done' && <Check size={16} className="text-accent-400" />}
              {step.status === 'active' && <Loader2 size={16} className="text-sui-400 animate-spin" />}
              {step.status === 'pending' && <div className="w-2 h-2 rounded-full bg-ink-600" />}
            </div>
            <span className={`text-sm ${step.status === 'done' ? 'text-ink-300' : step.status === 'active' ? 'text-white font-medium' : 'text-ink-500'}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
