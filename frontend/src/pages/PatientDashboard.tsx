import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabase';
import LanguageToggle from '../components/LanguageToggle';
import {
  Heart, LogOut, FileText, Clock, ChevronRight, Loader2,
  AlertCircle, Stethoscope, Pill, Activity
} from 'lucide-react';

interface Report {
  id: string;
  doctorName?: string;
  chiefComplaint: string;
  diagnoses: string[];
  medications: string[];
  createdAt: string;
}

export default function PatientDashboard() {
  const { user, userProfile, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, [user]);

  const fetchReports = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('patient_email', user.email)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const fetchedReports: Report[] = (data || []).map((row: any) => ({
        id: row.id,
        doctorName: row.doctor_name,
        chiefComplaint: row.structured_notes?.chief_complaint || 'General consultation',
        diagnoses: (row.structured_notes?.diagnoses || []).map((d: any) => d.name).slice(0, 3),
        medications: (row.structured_notes?.medications || []).map((m: any) => m.name).slice(0, 3),
        createdAt: row.created_at,
      }));

      setReports(fetchedReports);
    } catch (err) {
      console.error('Failed to fetch patient reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    }).format(new Date(date));
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-8">
      {/* Top Bar */}
      <header className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl border-b border-primary/10 shadow-glass">
        <div className="max-w-2xl mx-auto px-container-padding h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-secondary-container flex items-center justify-center shadow-sm">
              <Heart size={18} className="text-on-secondary-container" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-on-surface tracking-tight">{userProfile?.displayName}</h1>
              <p className="text-[10px] text-on-surface-variant font-medium">{t('myHealthRecords')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <button
              id="patient-logout-btn"
              onClick={handleLogout}
              className="p-2 text-outline hover:text-on-surface rounded-lg hover:bg-primary/5 transition-colors"
              title={t('logout')}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-container-padding pt-24 space-y-5">
        {/* Stats */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={16} className="text-secondary" />
            <span className="text-label-sm text-outline uppercase tracking-wider">{t('totalRecords')}</span>
          </div>
          <p className="text-display-lg text-on-surface tabular-nums">{reports.length}</p>
        </div>

        {/* Reports */}
        <div>
          <h2 className="text-headline-md text-on-surface mb-4">
            {t('yourMedicalRecords')}
          </h2>

          {loading ? (
            <div className="glass-card p-8 flex flex-col items-center justify-center gap-3">
              <Loader2 size={24} className="animate-spin text-primary" />
              <p className="text-sm text-on-surface-variant">{t('loadingRecords')}</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="glass-card p-8 text-center space-y-3">
              <AlertCircle size={24} className="text-outline mx-auto" />
              <p className="text-on-surface-variant text-sm">{t('noMedicalRecords')}</p>
              <p className="text-outline text-xs">{t('recordsAppearHere')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  onClick={() => navigate(`/report/${report.id}`)}
                  className="glass-card p-5 hover:shadow-glass-hover transition-all cursor-pointer group animate-fade-in-up"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock size={12} className="text-outline" />
                      <span className="text-label-sm text-on-surface-variant font-medium">{formatDate(report.createdAt)}</span>
                    </div>
                    <ChevronRight size={14} className="text-outline group-hover:text-primary transition-colors" />
                  </div>

                  {/* Chief Complaint */}
                  <div className="flex items-start gap-2 mb-3">
                    <Stethoscope size={14} className="text-secondary mt-0.5 shrink-0" />
                    <p className="text-body-md text-on-surface font-medium line-clamp-2">{report.chiefComplaint}</p>
                  </div>

                  {/* Diagnoses */}
                  {report.diagnoses.length > 0 && (
                    <div className="flex items-center gap-2 mb-2">
                      <Activity size={12} className="text-primary shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {report.diagnoses.map((dx, i) => (
                          <span key={i} className="metric-badge bg-primary/10 text-primary border border-primary/20 text-[10px]">
                            {dx}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Medications */}
                  {report.medications.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Pill size={12} className="text-tertiary shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {report.medications.map((med, i) => (
                          <span key={i} className="metric-badge bg-tertiary-fixed text-on-tertiary-fixed border border-tertiary/10 text-[10px]">
                            {med}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {report.doctorName && (
                    <p className="text-[10px] text-outline mt-2">Dr. {report.doctorName}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
