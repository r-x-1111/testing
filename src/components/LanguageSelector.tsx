import { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { LANGUAGES } from '@/lib/i18n';
import { useLang } from '@/lib/LanguageContext';
import type { LanguageCode } from '@/lib/i18n';

interface LanguageSelectorProps {
  compact?: boolean;
}

export function LanguageSelector({ compact = false }: LanguageSelectorProps) {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = LANGUAGES.find((l) => l.code === lang);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-ink-800/50 hover:bg-ink-800 border border-ink-700/50 transition-all text-sm ${compact ? 'w-full justify-between' : ''}`}
      >
        <span className="text-base leading-none">{current?.flag}</span>
        <span className="text-ink-200 font-medium">{current?.nativeName}</span>
        <ChevronDown size={14} className={`text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 right-0 z-50 glass-card p-2 max-h-72 overflow-y-auto scrollbar-thin animate-slide-up">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code as LanguageCode);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                lang === l.code ? 'bg-sui-500/10 text-sui-300' : 'text-ink-300 hover:bg-ink-800/50'
              }`}
            >
              <span className="text-base leading-none">{l.flag}</span>
              <span className="flex-1 text-left">
                <span className="font-medium">{l.nativeName}</span>
                <span className="text-ink-500 text-xs ml-1.5">{l.name}</span>
              </span>
              {lang === l.code && <Check size={14} className="text-sui-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
