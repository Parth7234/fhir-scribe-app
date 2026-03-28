import { useLanguage } from '../contexts/LanguageContext';
import { Globe } from 'lucide-react';

export default function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLanguage();

  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all hover:bg-white/10 border border-white/10 ${className}`}
      title={lang === 'en' ? 'हिंदी में देखें' : 'Switch to English'}
      id="language-toggle"
    >
      <Globe size={14} className="text-indigo-400" />
      <span className="text-gray-300">{lang === 'en' ? 'हिं' : 'EN'}</span>
    </button>
  );
}
