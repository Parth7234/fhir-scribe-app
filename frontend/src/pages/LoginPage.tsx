import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { usePwaInstall } from '../hooks/usePwaInstall';
import LanguageToggle from '../components/LanguageToggle';
import { Stethoscope, Loader2, AlertCircle, Download, Smartphone, Building2, Shield, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<'doctor' | 'patient' | 'admin'>('doctor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-surface relative">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 flex justify-center items-center opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary-container/20 blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-secondary-container/20 blur-[100px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-[480px] space-y-6">
        {/* Logo & Header */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary-container flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-4xl text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>medical_services</span>
          </div>
          <div>
            <h1 className="text-headline-lg text-primary tracking-tight font-semibold">{t('loginTitle')}</h1>
            <p className="text-body-md text-on-surface-variant mt-2">{t('loginSubtitle')}</p>
          </div>
          <LanguageToggle />
        </div>

        {/* PWA Install Banner */}
        {canInstall && (
          <button
            onClick={install}
            className="w-full glass-card p-4 flex items-center gap-3 hover:border-primary/20 transition-all group animate-fade-in-up"
            id="install-app-btn"
          >
            <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center shrink-0">
              <Smartphone size={18} className="text-on-primary-container" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-on-surface">{t('installApp')}</p>
              <p className="text-[11px] text-on-surface-variant">{t('installAppDesc')}</p>
            </div>
            <Download size={18} className="text-primary group-hover:translate-y-0.5 transition-transform" />
          </button>
        )}

        {/* Main Login Card */}
        <div className="glass-card p-8 md:p-10 space-y-8">
          {/* Role Tabs */}
          <nav aria-label="Role selection" className="flex p-1 bg-surface-container-low rounded-lg border border-outline-variant/30" id="role-tabs">
            <button
              onClick={() => { setActiveTab('doctor'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-label-md font-medium transition-all ${
                activeTab === 'doctor'
                  ? 'bg-secondary-container text-on-secondary-container shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-variant/50'
              }`}
            >
              <Stethoscope size={16} />
              {t('doctor')}
            </button>
            <button
              onClick={() => { setActiveTab('patient'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-label-md font-medium transition-all ${
                activeTab === 'patient'
                  ? 'bg-secondary-container text-on-secondary-container shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-variant/50'
              }`}
            >
              <Building2 size={16} />
              {t('patientDatabase')}
            </button>
            <button
              onClick={() => { setActiveTab('admin'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-label-md font-medium transition-all ${
                activeTab === 'admin'
                  ? 'bg-secondary-container text-on-secondary-container shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-variant/50'
              }`}
            >
              <Shield size={16} />
              Admin
            </button>
          </nav>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-error-container/50 border border-error/20">
              <AlertCircle size={16} className="text-error shrink-0" />
              <p className="text-on-error-container text-sm">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div className="flex flex-col gap-2">
              <label className="text-label-md text-on-surface ml-1" htmlFor="email-input">Email Address</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline">mail</span>
                <input
                  id="email-input"
                  type="email"
                  placeholder={activeTab === 'patient' ? t('patientEmailLabel') : 'dr.smith@aether.clinic'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors text-body-md text-on-surface placeholder:text-outline-variant/70 shadow-sm"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center ml-1 mr-1">
                <label className="text-label-md text-on-surface" htmlFor="password-input">Password</label>
                <a className="text-label-sm text-primary hover:text-primary-fixed-dim transition-colors" href="#">Forgot password?</a>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline">lock</span>
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={activeTab === 'patient' ? t('hospitalPassword') : '••••••••'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-12 py-3.5 bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors text-body-md text-on-surface placeholder:text-outline-variant/70 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                >
                  {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="login-button"
              type="submit"
              disabled={loading}
              className={`w-full py-4 mt-2 bg-primary text-on-primary rounded-lg text-label-md font-semibold shadow-btn-primary hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                loading ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {activeTab === 'patient' ? t('accessingRecords') : t('signingIn')}
                </>
              ) : (
                <>
                  {activeTab === 'doctor' ? t('signInAsDoctor') : activeTab === 'patient' ? t('signInAsPatient') : 'Sign In as Admin'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="text-center border-t border-outline-variant/30 pt-6">
            <p className="text-body-md text-on-surface-variant">
              {t('noAccount')}{' '}
              <Link to="/register" className="text-label-md text-primary hover:underline font-medium transition-colors">
                {t('registerHere')}
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] text-outline">
          {t('footer')}
        </p>
      </div>
    </div>
  );
}
