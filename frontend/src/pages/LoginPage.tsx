import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { usePwaInstall } from '../hooks/usePwaInstall';
import LanguageToggle from '../components/LanguageToggle';
import {
  Stethoscope, Loader2, AlertCircle, Download, Smartphone,
  Shield, Eye, EyeOff, ArrowRight, User
} from 'lucide-react';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<'doctor' | 'patient' | 'admin'>('doctor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { canInstall, install } = usePwaInstall();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Invalid login credentials')) {
        setError(t('invalidCredentials'));
      } else if (msg.includes('Email not confirmed')) {
        setError(t('confirmEmail'));
      } else {
        setError(msg || t('loginFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#fafaf6] text-on-surface overflow-x-hidden relative">
      {/* Dynamic Floating Background Decorative Blobs for Ambient Depth */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-40">
        <div className="absolute top-[-15%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-primary-container/20 blur-[100px] animate-float-slow" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-secondary-container/20 blur-[100px] animate-float-reverse" />
      </div>

      {/* Floating Language Toggle in the top right corner */}
      <div className="absolute top-6 right-6 z-20">
        <LanguageToggle />
      </div>

      {/* Main Glassmorphic Login Card */}
      <main className="relative z-10 w-full max-w-[460px] bg-white/70 backdrop-blur-xl border border-primary/10 shadow-[0px_12px_40px_rgba(138,154,91,0.06)] rounded-3xl p-8 md:p-10 flex flex-col gap-6">
        
        {/* Header Branding */}
        <header className="flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-primary-container/15 border border-primary/10 flex items-center justify-center text-primary shadow-sm hover:scale-105 transition-transform duration-300">
            <span className="material-symbols-outlined text-3xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>medical_services</span>
          </div>
          <div>
            <h1 className="text-headline-md font-bold tracking-tight text-primary flex items-center justify-center gap-2">
              ScribeFlow
            </h1>
            <p className="text-label-md text-on-surface-variant font-medium mt-1">
              {t('loginSubtitle')}
            </p>
          </div>
        </header>

        {/* PWA Install Banner */}
        {canInstall && (
          <button
            onClick={install}
            className="w-full bg-[#fdf8f4]/90 backdrop-blur-md border border-[#f5e6da] p-3.5 flex items-center gap-3 hover:scale-[1.01] hover:shadow-md active:scale-[0.99] transition-all rounded-2xl group animate-fade-in-up"
            id="install-app-btn"
          >
            <div className="w-9 h-9 rounded-xl bg-secondary-container flex items-center justify-center shrink-0 shadow-inner">
              <Smartphone size={16} className="text-on-secondary-container" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[11px] font-extrabold text-secondary uppercase tracking-wider">{t('installApp')}</p>
              <p className="text-[10px] text-on-surface-variant font-semibold mt-0.5">{t('installAppDesc')}</p>
            </div>
            <Download size={14} className="text-[#7c5637] group-hover:translate-y-0.5 transition-transform shrink-0" />
          </button>
        )}

        {/* Elegant Sliding Role Tabs */}
        <nav aria-label="Role selection" className="relative flex p-1 bg-surface-container-low rounded-2xl border border-outline-variant/30" id="role-tabs">
          {/* Sliding Background Indicator */}
          <div
            className="absolute top-1 bottom-1 rounded-xl bg-primary transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) shadow-md"
            style={{
              width: 'calc(33.333% - 4px)',
              left: activeTab === 'doctor'
                ? '4px'
                : activeTab === 'patient'
                ? 'calc(33.333% + 2px)'
                : 'calc(66.666% - 0.5px)'
            }}
          />
          
          <button
            type="button"
            onClick={() => { setActiveTab('doctor'); setError(''); }}
            className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
              activeTab === 'doctor'
                ? 'text-white'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <Stethoscope size={14} />
            {t('doctor')}
          </button>
          
          <button
            type="button"
            onClick={() => { setActiveTab('patient'); setError(''); }}
            className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
              activeTab === 'patient'
                ? 'text-white'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <User size={14} />
            {t('patient')}
          </button>
          
          <button
            type="button"
            onClick={() => { setActiveTab('admin'); setError(''); }}
            className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
              activeTab === 'admin'
                ? 'text-white'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <Shield size={14} />
            Admin
          </button>
        </nav>

        {error && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-error-container/20 border border-error/25 animate-fade-in-up">
            <AlertCircle size={16} className="text-error shrink-0 mt-0.5" />
            <p className="text-on-error-container text-xs font-bold leading-relaxed">{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Email Input */}
          <div className="flex flex-col gap-2">
            <label 
              className="text-xs font-black uppercase tracking-wider text-[#7c5637] ml-1 flex items-center gap-1.5 transition-colors duration-200" 
              htmlFor="email-input"
              style={{ color: focusedField === 'email' ? '#56642b' : '#7c5637' }}
            >
              <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>mail</span>
              {activeTab === 'patient' ? t('patientEmailLabel') : 'Email Address'}
            </label>
            <div className="relative">
              <span className={`absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-lg transition-colors duration-200 ${
                focusedField === 'email' ? 'text-primary' : 'text-outline'
              }`}>mail</span>
              <input
                id="email-input"
                type="email"
                placeholder={activeTab === 'patient' ? t('patientEmailLabel') : 'doctor@aether.clinic'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                required
                className="w-full pl-12 pr-4 py-3.5 bg-[#fafaf6] border border-outline-variant/60 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:bg-white transition-all text-sm text-gray-800 placeholder:text-outline-variant/70 shadow-inner focus:shadow-[0_0_12px_rgba(86,100,43,0.12)]"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center ml-1 mr-1">
              <label 
                className="text-xs font-black uppercase tracking-wider text-[#7c5637] flex items-center gap-1.5 transition-colors duration-200" 
                htmlFor="password-input"
                style={{ color: focusedField === 'password' ? '#56642b' : '#7c5637' }}
              >
                <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                Password
              </label>
              <a className="text-[11px] text-primary font-bold hover:underline transition-colors" href="#">Forgot password?</a>
            </div>
            <div className="relative">
              <span className={`absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-lg transition-colors duration-200 ${
                focusedField === 'password' ? 'text-primary' : 'text-outline'
              }`}>lock</span>
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                placeholder={activeTab === 'patient' ? t('hospitalPassword') : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                required
                className="w-full pl-12 pr-12 py-3.5 bg-[#fafaf6] border border-outline-variant/60 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary focus:bg-white transition-all text-sm text-gray-800 placeholder:text-outline-variant/70 shadow-inner focus:shadow-[0_0_12px_rgba(86,100,43,0.12)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors focus:outline-none"
              >
                {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Button with Hover Shimmer and Tactile Scale */}
          <button
            id="login-button"
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-3 bg-primary hover:bg-[#455022] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-btn-primary hover:shadow-btn-primary-hover active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shimmer-btn-effect"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {activeTab === 'patient' ? t('accessingRecords') : t('signingIn')}
              </>
            ) : (
              <>
                {activeTab === 'doctor' ? t('signInAsDoctor') : activeTab === 'patient' ? t('signInAsPatient') : 'Sign In as Admin'}
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Footer Link to Register */}
        <footer className="text-center border-t border-outline-variant/20 pt-5">
          <p className="text-xs text-on-surface-variant font-medium">
            {t('noAccount')}{' '}
            <Link to="/register" className="text-xs text-primary hover:underline font-extrabold transition-colors">
              {t('registerHere')}
            </Link>
          </p>
        </footer>

        {/* Brand Compliance Footer Info */}
        <div className="text-center border-t border-outline-variant/10 pt-4">
          <p className="text-[9px] text-outline font-semibold tracking-wide leading-relaxed">
            {t('footer')}
          </p>
        </div>
      </main>
    </div>
  );
}
