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
    <div className="min-h-screen pb-8">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-black/30 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Heart size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">{userProfile?.displayName}</h1>
              <p className="text-[10px] text-gray-400 font-medium">{t('myHealthRecords')}</p>
            </div>
          </div>
          <LanguageToggle />
          <button
            id="patient-logout-btn"
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title={t('logout')}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-5">
        {/* Stats */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={14} className="text-rose-400" />
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{t('totalRecords')}</span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">{reports.length}</p>
        </div>

        {/* Reports */}
        <div>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">
            {t('yourMedicalRecords')}
          </h2>

          {loading ? (
            <div className="glass-card p-8 flex flex-col items-center justify-center gap-3">
              <Loader2 size={24} className="animate-spin text-rose-400" />
              <p className="text-sm text-gray-400">{t('loadingRecords')}</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="glass-card p-8 text-center space-y-3">
              <AlertCircle size={24} className="text-gray-600 mx-auto" />
              <p className="text-gray-400 text-sm">{t('noMedicalRecords')}</p>
              <p className="text-gray-600 text-xs">{t('recordsAppearHere')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  onClick={() => navigate(`/report/${report.id}`)}
                  className="glass-card p-5 hover:bg-white/[0.06] transition-colors cursor-pointer group animate-fade-in-up"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock size={12} className="text-gray-500" />
                      <span className="text-xs text-gray-400 font-medium">{formatDate(report.createdAt)}</span>
                    </div>
                    <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
                  </div>

                  {/* Chief Complaint */}
                  <div className="flex items-start gap-2 mb-3">
                    <Stethoscope size={14} className="text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-white font-medium line-clamp-2">{report.chiefComplaint}</p>
                  </div>

                  {/* Diagnoses */}
                  {report.diagnoses.length > 0 && (
                    <div className="flex items-center gap-2 mb-2">
                      <Activity size={12} className="text-orange-400 shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {report.diagnoses.map((dx, i) => (
                          <span key={i} className="metric-badge bg-orange-500/10 text-orange-300 border border-orange-500/20 text-[10px]">
                            {dx}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Medications */}
                  {report.medications.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Pill size={12} className="text-emerald-400 shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {report.medications.map((med, i) => (
                          <span key={i} className="metric-badge bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px]">
                            {med}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {report.doctorName && (
                    <p className="text-[10px] text-gray-600 mt-2">Dr. {report.doctorName}</p>
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
