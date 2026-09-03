import { Home, Send, Users, Receipt, Settings, ShieldCheck, TrendingUp } from 'lucide-react';
import { Logo } from './Logo';
import { LanguageSelector } from './LanguageSelector';
import { useLang } from '@/lib/LanguageContext';
import type { Page, TranslationKey } from '@/lib/types';

interface SidebarProps {
  current: Page;
  onNavigate: (page: Page) => void;
}

export function Sidebar({ current, onNavigate }: SidebarProps) {
  const { t } = useLang();

  const navItems: { id: Page; label: TranslationKey; icon: typeof Home }[] = [
    { id: 'dashboard', label: 'nav.dashboard', icon: Home },
    { id: 'send', label: 'nav.send', icon: Send },
    { id: 'veriplan', label: 'nav.veriplan', icon: TrendingUp },
    { id: 'recipients', label: 'nav.recipients', icon: Users },
    { id: 'history', label: 'nav.history', icon: Receipt },
    { id: 'settings', label: 'nav.settings', icon: Settings },
  ];

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
                {t(item.label)}
              </button>
            );
          })}
        </nav>
        <div className="px-3 pb-3">
          <LanguageSelector />
        </div>
        <div className="p-4 m-3 rounded-xl glass-card">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck size={14} className="text-accent-400" />
            <span className="text-xs font-semibold text-accent-400">{t('safety.active')}</span>
          </div>
          <p className="text-[11px] text-ink-400 leading-relaxed">
            {t('app.tagline')}
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
              <span className="text-[10px] font-medium">{t(item.label)}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
