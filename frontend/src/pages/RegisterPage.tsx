import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, type UserRole } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageToggle from '../components/LanguageToggle';
import { Stethoscope, Building2, Loader2, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-surface relative">
      {/* Decorative Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary-container/20 blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-secondary-container/20 blur-[100px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-[480px] space-y-6">
        {/* Logo */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary-container flex items-center justify-center shadow-sm">
            {role === 'doctor'
              ? <Stethoscope size={28} className="text-on-primary-container" />
              : <Building2 size={28} className="text-on-primary-container" />
            }
          </div>
          <div>
            <h1 className="text-headline-lg text-primary tracking-tight font-semibold">
              {role === 'doctor' ? t('createAccount') : t('patientRegistration')}
            </h1>
            <p className="text-body-md text-on-surface-variant mt-2">
              {role === 'doctor' ? t('joinApp') : '🏥'}
            </p>
          </div>
          <LanguageToggle />
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="flex items-center gap-2 p-4 rounded-xl glass-card border-primary/20 animate-fade-in-up">
            <CheckCircle2 size={18} className="text-primary shrink-0" />
            <p className="text-primary text-sm font-medium">{successMessage}</p>
          </div>
        )}

        {/* Registration Card */}
        {!successMessage && (
          <div className="glass-card p-8 md:p-10 space-y-8">
            {/* Role Tabs */}
            <nav className="flex p-1 bg-surface-container-low rounded-lg border border-outline-variant/30" id="register-role-tabs">
              <button
                onClick={() => { setRole('doctor'); setError(''); setSuccessMessage(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-label-md font-medium transition-all ${
                  role === 'doctor'
                    ? 'bg-secondary-container text-on-secondary-container shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-variant/50'
                }`}
              >
                <Stethoscope size={16} />
                {t('imDoctor')}
              </button>
              <button
                onClick={() => { setRole('patient'); setError(''); setSuccessMessage(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-label-md font-medium transition-all ${
                  role === 'patient'
                    ? 'bg-secondary-container text-on-secondary-container shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-variant/50'
                }`}
              >
                <Building2 size={16} />
                {t('imPatient')}
              </button>
            </nav>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-error-container/50 border border-error/20">
                <AlertCircle size={16} className="text-error shrink-0" />
                <p className="text-on-error-container text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-4">
                {/* Name */}
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline">person</span>
                  <input
                    id="name-input"
                    type="text"
                    placeholder={role === 'doctor' ? t('drFullName') : t('patientFullName')}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors text-body-md text-on-surface placeholder:text-outline-variant/70 shadow-sm"
                  />
                </div>

                {/* Email */}
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline">mail</span>
                  <input
                    id="register-email-input"
                    type="email"
                    placeholder={role === 'patient' ? t('patientEmailLabel') : t('emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors text-body-md text-on-surface placeholder:text-outline-variant/70 shadow-sm"
                  />
                </div>

                {/* Password */}
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline">lock</span>
                  <input
                    id="register-password-input"
                    type="password"
                    placeholder={role === 'patient' ? t('setPatientPassword') : t('passwordMinChars')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors text-body-md text-on-surface placeholder:text-outline-variant/70 shadow-sm"
                  />
                </div>

                {/* Confirm Password */}
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline">lock</span>
                  <input
                    id="confirm-password-input"
                    type="password"
                    placeholder={role === 'patient' ? t('confirmPatientPassword') : t('confirmPasswordPlaceholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors text-body-md text-on-surface placeholder:text-outline-variant/70 shadow-sm"
                  />
                </div>
              </div>

              <button
                id="register-button"
                type="submit"
                disabled={loading}
                className={`w-full py-4 bg-primary text-on-primary rounded-lg text-label-md font-semibold shadow-btn-primary hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                  loading ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {role === 'patient' ? t('registeringPatient') : t('creatingAccount')}
                  </>
                ) : (
                  <>
                    {role === 'doctor' ? t('registerAsDoctor') : t('registerAsPatient')}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <p className="text-center text-body-md text-on-surface-variant">
                {t('alreadyHaveAccount')}{' '}
                <Link to="/login" className="text-primary hover:underline font-medium transition-colors">
                  {t('signInHere')}
                </Link>
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
