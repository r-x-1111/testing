import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { LanguageCode, TranslationKey } from './i18n';
import { translate, LANGUAGES } from './i18n';

interface LanguageContextValue {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  bcp47: string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = 'verisend-language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>('en');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
    if (saved) {
      setLangState(saved);
    }
  }, []);

  function setLang(l: LanguageCode) {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }

  const bcp47 = LANGUAGES.find((l) => l.code === lang)?.bcp47 ?? 'en-US';

  const value: LanguageContextValue = {
    lang,
    setLang,
    bcp47,
    t: (key, params) => translate(lang, key, params),
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}
