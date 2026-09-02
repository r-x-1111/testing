import { ShieldCheck } from 'lucide-react';

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = {
    sm: { box: 'w-8 h-8', icon: 18, text: 'text-base' },
    md: { box: 'w-10 h-10', icon: 22, text: 'text-lg' },
    lg: { box: 'w-14 h-14', icon: 30, text: 'text-2xl' },
  }[size];

  return (
    <div className="flex items-center gap-2.5">
      <div className={`${dims.box} rounded-xl bg-gradient-to-br from-sui-500 to-accent-500 flex items-center justify-center shadow-lg shadow-sui-500/20`}>
        <ShieldCheck size={dims.icon} className="text-white" strokeWidth={2.5} />
      </div>
      <div className="flex flex-col leading-none">
        <span className={`${dims.text} font-bold tracking-tight text-white`}>VeriSend</span>
        {size !== 'sm' && (
          <span className="text-[10px] text-ink-400 tracking-wider uppercase mt-0.5">on Sui</span>
        )}
      </div>
    </div>
  );
}
