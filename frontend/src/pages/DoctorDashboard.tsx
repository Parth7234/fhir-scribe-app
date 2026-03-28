import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabase';
import LanguageToggle from '../components/LanguageToggle';
import {
  Stethoscope, LogOut, Plus, Users, FileText, Clock,
  ChevronRight, Loader2, AlertCircle, Share2, Send
} from 'lucide-react';

interface Report {
  id: string;
  patientName: string;
  patientEmail?: string;
  chiefComplaint: string;
  createdAt: string;
  language: string;
}

interface PatientSummary {
  name: string;
  email?: string;
  reportCount: number;
  lastVisit: Date;
}

interface SharedReport {
  id: string;
  reportId: string;
  senderEmail?: string;
  senderName?: string;
  patientName: string;
  chiefComplaint: string;
  message?: string;
  createdAt: string;
}

export default function DoctorDashboard() {
  const { userProfile, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [sharedReports, setSharedReports] = useState<SharedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'patients' | 'reports' | 'shared'>('patients');

  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareReportId, setShareReportId] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  useEffect(() => {
    if (!userProfile) {
      setLoading(false);
      return;
    }
    fetchReports();
    fetchSharedReports();
  }, [userProfile]);

  const fetchReports = async () => {
    if (!userProfile) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('doctor_id', userProfile.uid)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const fetchedReports: Report[] = [];
      const patientMap = new Map<string, PatientSummary>();

      (data || []).forEach((row: any) => {
        const report: Report = {
          id: row.id,
          patientName: row.patient_name || 'Unknown',
          patientEmail: row.patient_email,
          chiefComplaint: row.structured_notes?.chief_complaint || 'General consultation',
          createdAt: row.created_at,
          language: row.language || 'en',
        };
        fetchedReports.push(report);

        // Aggregate patient info
        const key = (row.patient_name || 'unknown').toLowerCase();
        const existing = patientMap.get(key);
        const visitDate = new Date(row.created_at);
        if (existing) {
          existing.reportCount++;
          if (visitDate > existing.lastVisit) {
            existing.lastVisit = visitDate;
          }
        } else {
          patientMap.set(key, {
            name: row.patient_name || 'Unknown',
            email: row.patient_email,
            reportCount: 1,
            lastVisit: visitDate,
          });
        }
      });

      setReports(fetchedReports);
      setPatients(Array.from(patientMap.values()));
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSharedReports = async () => {
    if (!userProfile) return;
    try {
      // Simple query first — no joins to avoid RLS/FK issues
      const { data, error } = await supabase
        .from('shared_reports')
        .select('*')
        .eq('recipient_email', userProfile.email)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) {
        setSharedReports([]);
        return;
      }

      // Fetch related reports and sender profiles separately
      const reportIds = [...new Set(data.map((r: any) => r.report_id))];
      const senderIds = [...new Set(data.map((r: any) => r.sender_id))];

      const [reportsResult, profilesResult] = await Promise.all([
        supabase.from('reports').select('id, patient_name, structured_notes').in('id', reportIds),
        supabase.from('profiles').select('id, email, display_name').in('id', senderIds),
      ]);

      const reportsMap = new Map((reportsResult.data || []).map((r: any) => [r.id, r]));
      const profilesMap = new Map((profilesResult.data || []).map((p: any) => [p.id, p]));

      const shared: SharedReport[] = data.map((row: any) => {
        const report = reportsMap.get(row.report_id);
        const sender = profilesMap.get(row.sender_id);
        return {
          id: row.id,
          reportId: row.report_id,
          senderEmail: sender?.email,
          senderName: sender?.display_name,
          patientName: report?.patient_name || 'Unknown',
          chiefComplaint: report?.structured_notes?.chief_complaint || 'General consultation',
          message: row.message,
          createdAt: row.created_at,
        };
      });

      setSharedReports(shared);
    } catch (err) {
      console.error('Failed to fetch shared reports:', err);
    }
  };

  const handleShare = async () => {
    if (!shareEmail.trim() || !shareReportId) return;
    setShareLoading(true);
    try {
      const { error } = await supabase.from('shared_reports').insert({
        report_id: shareReportId,
        sender_id: userProfile!.uid,
        recipient_email: shareEmail.trim().toLowerCase(),
        message: shareMessage.trim() || null,
      });
      if (error) throw error;
      setShareSuccess(true);
      setTimeout(() => {
        setShareModalOpen(false);
        setShareEmail('');
        setShareMessage('');
        setShareSuccess(false);
      }, 1500);
    } catch (err) {
      console.error('Failed to share report:', err);
    } finally {
      setShareLoading(false);
    }
  };

  const openShareModal = (reportId: string) => {
    setShareReportId(reportId);
    setShareEmail('');
    setShareMessage('');
    setShareSuccess(false);
    setShareModalOpen(true);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(d);
  };

  return (
    <div className="min-h-screen pb-8">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-black/30 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Stethoscope size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">Dr. {userProfile?.displayName}</h1>
              <p className="text-[10px] text-gray-400 font-medium">{t('doctorDashboard')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <button
              id="new-consultation-btn"
              onClick={() => navigate('/scribe')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all active:scale-95"
            >
              <Plus size={14} />
              {t('newConsultation')}
            </button>
            <button
              id="logout-btn"
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              title={t('logout')}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-5">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users size={14} className="text-indigo-400" />
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{t('patients')}</span>
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">{patients.length}</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={14} className="text-purple-400" />
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{t('reports')}</span>
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">{reports.length}</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Share2 size={14} className="text-teal-400" />
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{t('shared')}</span>
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">{sharedReports.length}</p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="glass-card p-1.5 flex gap-1">
          <button
            onClick={() => setActiveView('patients')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold transition-all duration-300 ${
              activeView === 'patients'
                ? 'bg-white/10 text-white border border-white/10'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Users size={14} />
            {t('patients')}
          </button>
          <button
            onClick={() => setActiveView('reports')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold transition-all duration-300 ${
              activeView === 'reports'
                ? 'bg-white/10 text-white border border-white/10'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <FileText size={14} />
            {t('reports')}
          </button>
          <button
            onClick={() => setActiveView('shared')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold transition-all duration-300 ${
              activeView === 'shared'
                ? 'bg-white/10 text-white border border-white/10'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Share2 size={14} />
            {t('shared')}
          </button>
        </div>

        {loading ? (
          <div className="glass-card p-8 flex flex-col items-center justify-center gap-3">
            <Loader2 size={24} className="animate-spin text-indigo-400" />
            <p className="text-sm text-gray-400">{t('loadingData')}</p>
          </div>
        ) : activeView === 'patients' ? (
          /* Patients List */
          <div className="space-y-2">
            {patients.length === 0 ? (
              <div className="glass-card p-8 text-center space-y-3">
                <AlertCircle size={24} className="text-gray-600 mx-auto" />
                <p className="text-gray-400 text-sm">{t('noPatients')}</p>
                <p className="text-gray-600 text-xs">{t('startConsultation')}</p>
              </div>
            ) : (
              patients.map((patient, i) => (
                <div
                  key={i}
                  className="glass-card p-4 flex items-center justify-between hover:bg-white/[0.06] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/20 shrink-0">
                      <span className="text-sm font-bold text-emerald-300">
                        {patient.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{patient.name}</p>
                      <p className="text-[11px] text-gray-500">
                        {patient.reportCount} report{patient.reportCount !== 1 ? 's' : ''} • Last: {formatDate(patient.lastVisit)}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-400 transition-colors shrink-0" />
                </div>
              ))
            )}
          </div>
        ) : activeView === 'reports' ? (
          /* Reports List */
          <div className="space-y-2">
            {reports.length === 0 ? (
              <div className="glass-card p-8 text-center space-y-3">
                <AlertCircle size={24} className="text-gray-600 mx-auto" />
                <p className="text-gray-400 text-sm">{t('noReports')}</p>
                <p className="text-gray-600 text-xs">{t('recordConsultation')}</p>
              </div>
            ) : (
              reports.map((report) => (
                <div
                  key={report.id}
                  className="glass-card p-4 hover:bg-white/[0.06] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-white cursor-pointer" onClick={() => navigate(`/report/${report.id}`)}>{report.patientName}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); openShareModal(report.id); }}
                        className="p-1.5 text-gray-500 hover:text-teal-400 rounded-lg hover:bg-teal-500/10 transition-colors"
                        title="Share with another doctor"
                      >
                        <Share2 size={14} />
                      </button>
                      <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors cursor-pointer" onClick={() => navigate(`/report/${report.id}`)} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-1" onClick={() => navigate(`/report/${report.id}`)}>{report.chiefComplaint}</p>
                  <div className="flex items-center gap-2 mt-2" onClick={() => navigate(`/report/${report.id}`)}>
                    <Clock size={10} className="text-gray-600" />
                    <span className="text-[10px] text-gray-600">{formatDate(report.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Shared With Me */
          <div className="space-y-2">
            {sharedReports.length === 0 ? (
              <div className="glass-card p-8 text-center space-y-3">
                <Share2 size={24} className="text-gray-600 mx-auto" />
                <p className="text-gray-400 text-sm">{t('noSharedReports')}</p>
                <p className="text-gray-600 text-xs">{t('otherDoctorsShare')}</p>
              </div>
            ) : (
              sharedReports.map((sr) => (
                <div
                  key={sr.id}
                  onClick={() => navigate(`/report/${sr.reportId}`)}
                  className="glass-card p-4 hover:bg-white/[0.06] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-white">{sr.patientName}</p>
                    <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-1">{sr.chiefComplaint}</p>
                  {sr.message && <p className="text-xs text-indigo-300/70 mt-1.5 italic">"{sr.message}"</p>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-teal-400/70">From: Dr. {sr.senderName || sr.senderEmail}</span>
                    <div className="flex items-center gap-1">
                      <Clock size={10} className="text-gray-600" />
                      <span className="text-[10px] text-gray-600">{formatDate(sr.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-card p-6 w-full max-w-sm space-y-5 animate-fade-in-up border border-white/10">
            <h3 className="text-lg font-bold text-white text-center">{t('shareReport')}</h3>
            <p className="text-xs text-gray-400 text-center">{t('sendReportToDoctor')}</p>
            {shareSuccess ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <Send size={28} className="text-teal-400" />
                <p className="text-teal-300 font-medium text-sm">{t('reportSharedSuccess')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="Recipient doctor's email *"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder:text-gray-600 outline-none focus:border-teal-500/50 transition-colors"
                />
                <textarea
                  placeholder="Optional message..."
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder:text-gray-600 outline-none focus:border-teal-500/50 transition-colors min-h-[80px] resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={() => setShareModalOpen(false)} className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-400 bg-white/5 hover:bg-white/10 transition-colors">{t('cancel')}</button>
                  <button
                    onClick={handleShare}
                    disabled={!shareEmail.trim() || shareLoading}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-teal-500 to-emerald-600 shadow-lg shadow-teal-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {shareLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {shareLoading ? t('sharing') : t('share')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
