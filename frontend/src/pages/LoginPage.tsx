import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { usePwaInstall } from '../hooks/usePwaInstall';
import LanguageToggle from '../components/LanguageToggle';
import { Stethoscope, Mail, Lock, Loader2, AlertCircle, Download, Smartphone, Building2, Shield } from 'lucide-react';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<'doctor' | 'patient' | 'admin'>('doctor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Stethoscope size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{t('loginTitle')}</h1>
            <p className="text-gray-400 text-sm mt-1">{t('loginSubtitle')}</p>
          </div>
          <LanguageToggle />
        </div>

        {/* PWA Install Banner */}
        {canInstall && (
          <button
            onClick={install}
            className="w-full glass-card p-4 flex items-center gap-3 hover:bg-white/[0.06] transition-all group animate-fade-in-up border border-indigo-500/20 bg-indigo-500/5"
            id="install-app-btn"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Smartphone size={18} className="text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-white">{t('installApp')}</p>
              <p className="text-[11px] text-gray-400">{t('installAppDesc')}</p>
            </div>
            <Download size={18} className="text-indigo-400 group-hover:translate-y-0.5 transition-transform" />
          </button>
        )}

        {/* Role Tabs */}
        <div className="glass-card p-1.5 flex gap-1" id="role-tabs">
          <button
            onClick={() => { setActiveTab('doctor'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${
              activeTab === 'doctor'
                ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/30 shadow-lg shadow-indigo-500/10'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Stethoscope size={16} />
            {t('doctor')}
          </button>
          <button
            onClick={() => { setActiveTab('patient'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${
              activeTab === 'patient'
                ? 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-300 border border-teal-500/30 shadow-lg shadow-teal-500/10'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Building2 size={16} />
            {t('patientDatabase')}
          </button>
          <button
            onClick={() => { setActiveTab('admin'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${
              activeTab === 'admin'
                ? 'bg-gradient-to-r from-amber-500/20 to-red-500/20 text-amber-300 border border-amber-500/30 shadow-lg shadow-amber-500/10'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Shield size={16} />
            Admin
          </button>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
          <h2 className="text-lg font-bold text-white text-center">
            {activeTab === 'doctor' ? t('doctorSignIn') : activeTab === 'patient' ? t('patientSignIn') : 'Admin Sign In'}
          </h2>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                id="email-input"
                type="email"
                placeholder={activeTab === 'patient' ? t('patientEmailLabel') : t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-sm text-gray-200 placeholder:text-gray-600 outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>

            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                id="password-input"
                type="password"
                placeholder={activeTab === 'patient' ? t('hospitalPassword') : t('passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-sm text-gray-200 placeholder:text-gray-600 outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>
          </div>

          <button
            id="login-button"
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${
              activeTab === 'doctor'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-indigo-500/30'
                : activeTab === 'patient'
                ? 'bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 shadow-teal-500/30'
                : 'bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-600 hover:to-red-700 shadow-amber-500/30'
            } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {activeTab === 'patient' ? t('accessingRecords') : t('signingIn')}
              </>
            ) : (
              activeTab === 'doctor' ? t('signInAsDoctor') : activeTab === 'patient' ? t('signInAsPatient') : 'Sign In as Admin'
            )}
          </button>

          <p className="text-center text-sm text-gray-500">
            {t('noAccount')}{' '}
            <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              {t('registerHere')}
            </Link>
          </p>
        </form>

        <p className="text-center text-[10px] text-gray-600">
          {t('footer')}
        </p>
      </div>
    </div>
  );
}
