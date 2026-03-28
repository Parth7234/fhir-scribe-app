import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, type UserRole } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageToggle from '../components/LanguageToggle';
import { Stethoscope, Building2, Mail, Lock, User, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
  const [role, setRole] = useState<UserRole>('doctor');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (password !== confirmPassword) {
      setError(t('passwordsNoMatch'));
      return;
    }
    if (password.length < 6) {
      setError(t('passwordTooShort'));
      return;
    }

    setLoading(true);
    try {
      await register(email, password, displayName, role);
      if (role === 'patient') {
        // Patient registered by hospital — show success and redirect
        setSuccessMessage(t('patientRegisteredSuccess'));
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      const msg = err.message || '';
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError(t('emailExists'));
      } else if (msg.includes('weak_password') || msg.includes('at least')) {
        setError(t('weakPassword'));
      } else if (msg.includes('check your email') || msg.includes('confirm')) {
        // Doctor registration with email confirmation — show friendly message
        setSuccessMessage(t('checkEmailVerification'));
      } else {
        setError(msg || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center shadow-lg ${
            role === 'doctor'
              ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/20'
              : 'bg-gradient-to-br from-teal-500 to-cyan-600 shadow-teal-500/20'
          }`}>
            {role === 'doctor' ? <Stethoscope size={32} className="text-white" /> : <Building2 size={32} className="text-white" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {role === 'doctor' ? t('createAccount') : t('patientRegistration')}
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {role === 'doctor' ? t('joinApp') : '🏥'}
            </p>
          </div>
          <LanguageToggle />
        </div>

        {/* Role Tabs */}
        <div className="glass-card p-1.5 flex gap-1" id="register-role-tabs">
          <button
            onClick={() => { setRole('doctor'); setError(''); setSuccessMessage(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${
              role === 'doctor'
                ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/30 shadow-lg shadow-indigo-500/10'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Stethoscope size={16} />
            {t('imDoctor')}
          </button>
          <button
            onClick={() => { setRole('patient'); setError(''); setSuccessMessage(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${
              role === 'patient'
                ? 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-300 border border-teal-500/30 shadow-lg shadow-teal-500/10'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Building2 size={16} />
            {t('imPatient')}
          </button>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 animate-fade-in-up">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <p className="text-emerald-300 text-sm font-medium">{successMessage}</p>
          </div>
        )}

        {/* Registration Form */}
        {!successMessage && (
          <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
            <h2 className="text-lg font-bold text-white text-center">
              {role === 'doctor' ? t('doctorRegistration') : t('patientRegistration')}
            </h2>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  id="name-input"
                  type="text"
                  placeholder={role === 'doctor' ? t('drFullName') : t('patientFullName')}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-sm text-gray-200 placeholder:text-gray-600 outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>

              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  id="register-email-input"
                  type="email"
                  placeholder={role === 'patient' ? t('patientEmailLabel') : t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-sm text-gray-200 placeholder:text-gray-600 outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>

              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  id="register-password-input"
                  type="password"
                  placeholder={role === 'patient' ? t('setPatientPassword') : t('passwordMinChars')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-sm text-gray-200 placeholder:text-gray-600 outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>

              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  id="confirm-password-input"
                  type="password"
                  placeholder={role === 'patient' ? t('confirmPatientPassword') : t('confirmPasswordPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-sm text-gray-200 placeholder:text-gray-600 outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>
            </div>

            <button
              id="register-button"
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${
                role === 'doctor'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-indigo-500/30'
                  : 'bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 shadow-teal-500/30'
              } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {role === 'patient' ? t('registeringPatient') : t('creatingAccount')}
                </>
              ) : (
                role === 'doctor' ? t('registerAsDoctor') : t('registerAsPatient')
              )}
            </button>

            <p className="text-center text-sm text-gray-500">
              {t('alreadyHaveAccount')}{' '}
              <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                {t('signInHere')}
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
