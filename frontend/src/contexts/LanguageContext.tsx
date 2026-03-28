import { createContext, useContext, useState, type ReactNode } from 'react';
import { type AppLanguage, t as translate, type TranslationKey } from '../i18n/translations';

interface LanguageContextType {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<AppLanguage>(() => {
    return (localStorage.getItem('app_language') as AppLanguage) || 'en';
  });

  const handleSetLang = (newLang: AppLanguage) => {
    setLang(newLang);
    localStorage.setItem('app_language', newLang);
  };

  const t = (key: TranslationKey) => translate(key, lang);

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
