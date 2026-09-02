import { Home, Send, Users, Receipt, Settings, ShieldCheck } from 'lucide-react';
import { Logo } from './Logo';
import type { Page } from '@/lib/types';

interface SidebarProps {
  current: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { id: Page; label: string; icon: typeof Home }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'send', label: 'Send Money', icon: Send },
  { id: 'recipients', label: 'Recipients', icon: Users },
  { id: 'history', label: 'History', icon: Receipt },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ current, onNavigate }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 border-r border-ink-800/60 bg-ink-950/40 backdrop-blur-xl">
        <div className="p-6">
          <Logo size="md" />
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = current === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-sui-500/10 text-sui-300 border border-sui-500/20'
                    : 'text-ink-400 hover:text-ink-100 hover:bg-ink-800/40 border border-transparent'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 m-3 rounded-xl glass-card">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck size={14} className="text-accent-400" />
            <span className="text-xs font-semibold text-accent-400">Safety Active</span>
          </div>
          <p className="text-[11px] text-ink-400 leading-relaxed">
            Gonka interprets. Code verifies. VeriSend warns. You authorize. Sui executes.
          </p>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2 border-t border-ink-800/60 bg-ink-950/90 backdrop-blur-xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                active ? 'text-sui-300' : 'text-ink-500'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
