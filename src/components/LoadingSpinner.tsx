import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ size = 24, label }: { size?: number; label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <Loader2 size={size} className="text-sui-400 animate-spin" />
      {label && <p className="text-sm text-ink-400">{label}</p>}
    </div>
  );
}
