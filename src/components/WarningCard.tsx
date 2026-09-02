import { Check, X, AlertTriangle, Info } from 'lucide-react';
import type { SafetyWarning } from '@/lib/types';

const severityConfig = {
  info: { icon: Info, color: 'text-sui-400', bg: 'bg-sui-500/10', border: 'border-sui-500/20' },
  warning: { icon: AlertTriangle, color: 'text-gold-400', bg: 'bg-gold-500/10', border: 'border-gold-500/20' },
  danger: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
};

export function WarningCard({ warning }: { warning: SafetyWarning }) {
  const cfg = severityConfig[warning.severity];
  const Icon = cfg.icon;

  return (
    <div className={`flex gap-3 p-4 rounded-xl border ${cfg.bg} ${cfg.border} animate-slide-in`}>
      <Icon size={18} className={`shrink-0 mt-0.5 ${cfg.color}`} />
      <div>
        <p className={`text-sm font-semibold ${cfg.color}`}>{warning.title}</p>
        <p className="text-xs text-ink-400 mt-0.5 leading-relaxed">{warning.detail}</p>
      </div>
    </div>
  );
}

export function CheckRow({ label, value, status }: { label: string; value: string; status: 'pass' | 'fail' | 'pending' }) {
  const icon = {
    pass: <Check size={16} className="text-accent-400" />,
    fail: <X size={16} className="text-red-400" />,
    pending: <div className="w-4 h-4 rounded-full border-2 border-ink-600 border-t-sui-400 animate-spin" />,
  }[status];

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-ink-800/50 last:border-0">
      <span className="text-sm text-ink-300">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-medium ${status === 'pass' ? 'text-ink-100' : status === 'fail' ? 'text-red-400' : 'text-ink-400'}`}>
          {value}
        </span>
        {icon}
      </div>
    </div>
  );
}
