import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../supabase';
import LanguageToggle from '../components/LanguageToggle';
import {
  LogOut, Plus, Users, FileText, Clock,
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

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-24 md:pb-8">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl border-b border-primary/10 shadow-glass">
        <div className="flex items-center justify-between px-container-padding h-16 w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-on-surface-variant hover:bg-primary/5 transition-colors duration-200 p-2 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="text-headline-md font-bold tracking-tight text-primary">ScribeFlow</div>
          </div>
          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={() => setActiveView('reports')}
              className={`text-label-md px-3 py-1.5 rounded-lg transition-all duration-200 ${
                activeView === 'reports'
                  ? 'text-primary font-bold bg-primary/5'
                  : 'text-on-surface-variant hover:bg-primary/5'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => navigate('/scribe')}
              className="text-label-md text-on-surface-variant hover:bg-primary/5 transition-colors duration-200 px-3 py-1.5 rounded-lg"
            >
              Scribe
            </button>
            <button
              onClick={() => setActiveView('patients')}
              className={`text-label-md px-3 py-1.5 rounded-lg transition-all duration-200 ${
                activeView === 'patients'
                  ? 'text-primary font-bold bg-primary/5'
                  : 'text-on-surface-variant hover:bg-primary/5'
              }`}
            >
              Patients
            </button>
            <button
              onClick={() => setActiveView('shared')}
              className={`text-label-md px-3 py-1.5 rounded-lg transition-all duration-200 ${
                activeView === 'shared'
                  ? 'text-primary font-bold bg-primary/5'
                  : 'text-on-surface-variant hover:bg-primary/5'
              }`}
            >
              Shared
            </button>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <button
              onClick={handleLogout}
              className="p-2 text-outline hover:text-on-surface rounded-lg hover:bg-primary/5 transition-colors"
              title={t('logout')}
            >
              <LogOut size={18} />
            </button>
            <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center overflow-hidden border border-primary/20">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>person</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-8 px-container-padding max-w-7xl mx-auto w-full flex flex-col gap-stack-lg">
        {/* Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-label-md text-outline mb-1">{dateStr}</p>
            <h1 className="text-headline-lg-mobile md:text-headline-lg text-on-surface">{greeting}, Dr. {userProfile?.displayName}.</h1>
          </div>
          {/* Desktop Primary Action */}
          <button
            id="new-consultation-btn"
            onClick={() => navigate('/scribe')}
            className="hidden md:flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-full hover:bg-primary/90 transition-all shadow-btn-primary text-label-md font-medium"
          >
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
            {t('newConsultation')}
          </button>
        </section>

        {/* Stats Bento Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {/* Patients Seen */}
          <div className="glass-card p-6 flex flex-col gap-4 relative overflow-hidden group hover:border-primary/20 transition-colors">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
            <div className="flex justify-between items-start z-10">
              <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">group</span>
              </div>
              <span className="text-label-sm text-tertiary bg-tertiary-fixed rounded-full px-2 py-0.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">trending_up</span> 12%
              </span>
            </div>
            <div className="z-10 mt-2">
              <p className="text-label-md text-outline">{t('patients')}</p>
              <p className="text-display-lg text-on-surface mt-1">{patients.length}</p>
            </div>
          </div>

          {/* Reports to Review (Peach Accent) */}
          <div className="glass-card p-6 flex flex-col gap-4 relative overflow-hidden group border-secondary-container/50 hover:border-secondary-container transition-colors">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary-container/20 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
            <div className="flex justify-between items-start z-10">
              <div className="w-10 h-10 rounded-full bg-secondary-container/30 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>article</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            </div>
            <div className="z-10 mt-2">
              <p className="text-label-md text-outline">{t('reports')}</p>
              <p className="text-display-lg text-on-surface mt-1">{reports.length}</p>
            </div>
          </div>

          {/* Shared Cases */}
          <div className="glass-card p-6 flex flex-col gap-4 relative overflow-hidden group hover:border-primary/20 transition-colors">
            <div className="absolute top-0 right-0 w-32 h-32 bg-tertiary-container/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
            <div className="flex justify-between items-start z-10">
              <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined">share</span>
              </div>
            </div>
            <div className="z-10 mt-2">
              <p className="text-label-md text-outline">{t('shared')}</p>
              <p className="text-display-lg text-on-surface mt-1">{sharedReports.length}</p>
            </div>
          </div>
        </section>

        {/* View Toggle & Content */}
        <section className="flex flex-col gap-stack-md">
          <div className="flex items-center justify-between">
            <h2 className="text-headline-md text-on-surface">
              {activeView === 'patients' ? t('patients') : activeView === 'reports' ? t('reports') : t('shared')}
            </h2>
            <button className="text-label-md text-primary hover:underline flex items-center gap-1">
              View All <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex p-1 bg-surface-container-low rounded-lg border border-outline-variant/30 gap-1">
            <button
              onClick={() => setActiveView('patients')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-label-md font-medium transition-all ${
                activeView === 'patients'
                  ? 'bg-primary-container text-on-primary-container shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-variant/50'
              }`}
            >
              <Users size={14} />
              {t('patients')}
            </button>
            <button
              onClick={() => setActiveView('reports')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-label-md font-medium transition-all ${
                activeView === 'reports'
                  ? 'bg-primary-container text-on-primary-container shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-variant/50'
              }`}
            >
              <FileText size={14} />
              {t('reports')}
            </button>
            <button
              onClick={() => setActiveView('shared')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-label-md font-medium transition-all ${
                activeView === 'shared'
                  ? 'bg-primary-container text-on-primary-container shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-variant/50'
              }`}
            >
              <Share2 size={14} />
              {t('shared')}
            </button>
          </div>

          {loading ? (
            <div className="glass-card p-8 flex flex-col items-center justify-center gap-3">
              <Loader2 size={24} className="animate-spin text-primary" />
              <p className="text-sm text-on-surface-variant">{t('loadingData')}</p>
            </div>
          ) : activeView === 'patients' ? (
            /* Patients List */
            <div className="flex flex-col gap-unit">
              {patients.length === 0 ? (
                <div className="glass-card p-8 text-center space-y-3">
                  <AlertCircle size={24} className="text-outline mx-auto" />
                  <p className="text-on-surface-variant text-sm">{t('noPatients')}</p>
                  <p className="text-outline text-xs">{t('startConsultation')}</p>
                </div>
              ) : (
                patients.map((patient, i) => (
                  <div
                    key={i}
                    className="glass-card p-4 flex items-center justify-between hover:shadow-glass-hover transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant text-headline-md">
                        {patient.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-body-md font-medium text-on-surface group-hover:text-primary transition-colors truncate">{patient.name}</p>
                        <p className="text-label-sm text-outline flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          {patient.reportCount} report{patient.reportCount !== 1 ? 's' : ''} • Last: {formatDate(patient.lastVisit)}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-outline group-hover:text-primary transition-colors shrink-0" />
                  </div>
                ))
              )}
            </div>
          ) : activeView === 'reports' ? (
            /* Reports List */
            <div className="flex flex-col gap-unit">
              {reports.length === 0 ? (
                <div className="glass-card p-8 text-center space-y-3">
                  <AlertCircle size={24} className="text-outline mx-auto" />
                  <p className="text-on-surface-variant text-sm">{t('noReports')}</p>
                  <p className="text-outline text-xs">{t('recordConsultation')}</p>
                </div>
              ) : (
                reports.map((report) => (
                  <div
                    key={report.id}
                    className="glass-card p-4 hover:shadow-glass-hover transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-body-md font-medium text-on-surface cursor-pointer group-hover:text-primary transition-colors" onClick={() => navigate(`/report/${report.id}`)}>{report.patientName}</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); openShareModal(report.id); }}
                          className="p-1.5 text-outline hover:text-primary rounded-lg hover:bg-primary/5 transition-colors"
                          title="Share with another doctor"
                        >
                          <Share2 size={14} />
                        </button>
                        <ChevronRight size={14} className="text-outline group-hover:text-primary transition-colors cursor-pointer" onClick={() => navigate(`/report/${report.id}`)} />
                      </div>
                    </div>
                    <p className="text-label-sm text-on-surface-variant line-clamp-1" onClick={() => navigate(`/report/${report.id}`)}>{report.chiefComplaint}</p>
                    <div className="flex items-center gap-2 mt-2" onClick={() => navigate(`/report/${report.id}`)}>
                      <Clock size={10} className="text-outline" />
                      <span className="text-[10px] text-outline">{formatDate(report.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Shared With Me */
            <div className="flex flex-col gap-unit">
              {sharedReports.length === 0 ? (
                <div className="glass-card p-8 text-center space-y-3">
                  <Share2 size={24} className="text-outline mx-auto" />
                  <p className="text-on-surface-variant text-sm">{t('noSharedReports')}</p>
                  <p className="text-outline text-xs">{t('otherDoctorsShare')}</p>
                </div>
              ) : (
                sharedReports.map((sr) => (
                  <div
                    key={sr.id}
                    onClick={() => navigate(`/report/${sr.reportId}`)}
                    className="glass-card p-4 hover:shadow-glass-hover transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-body-md font-medium text-on-surface group-hover:text-primary transition-colors">{sr.patientName}</p>
                      <ChevronRight size={14} className="text-outline group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-label-sm text-on-surface-variant line-clamp-1">{sr.chiefComplaint}</p>
                    {sr.message && <p className="text-label-sm text-primary/70 mt-1.5 italic">"{sr.message}"</p>}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-tertiary">From: Dr. {sr.senderName || sr.senderEmail}</span>
                      <div className="flex items-center gap-1">
                        <Clock size={10} className="text-outline" />
                        <span className="text-[10px] text-outline">{formatDate(sr.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </main>

      {/* Mobile FAB */}
      <button
        onClick={() => navigate('/scribe')}
        className="md:hidden fixed bottom-24 right-4 z-40 bg-primary text-on-primary w-14 h-14 rounded-full flex items-center justify-center shadow-btn-primary-hover hover:scale-105 active:scale-95 transition-all"
      >
        <Plus size={24} />
      </button>

      {/* Bottom Nav (Mobile) */}
      <nav className="fixed bottom-0 w-full z-50 bg-white/70 backdrop-blur-xl border-t border-primary/10 shadow-glass md:hidden">
        <div className="flex justify-around items-center w-full h-20 px-4 pb-safe">
          <button className="flex flex-col items-center justify-center w-16 gap-1 group">
            <div className="flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-full px-4 py-1 scale-90 transition-transform duration-150">
              <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>dashboard</span>
            </div>
            <span className="text-label-sm text-on-surface font-semibold">Dashboard</span>
          </button>
          <button onClick={() => navigate('/scribe')} className="flex flex-col items-center justify-center w-16 gap-1 text-outline hover:bg-surface-container-high/50 transition-all rounded-lg py-1 group">
            <span className="material-symbols-outlined text-[24px]">mic_none</span>
            <span className="text-label-sm font-medium">Scribe</span>
          </button>
          <button className="flex flex-col items-center justify-center w-16 gap-1 text-outline hover:bg-surface-container-high/50 transition-all rounded-lg py-1 group">
            <span className="material-symbols-outlined text-[24px]">group</span>
            <span className="text-label-sm font-medium">Patients</span>
          </button>
          <button className="flex flex-col items-center justify-center w-16 gap-1 text-outline hover:bg-surface-container-high/50 transition-all rounded-lg py-1 group">
            <span className="material-symbols-outlined text-[24px]">analytics</span>
            <span className="text-label-sm font-medium">Analytics</span>
          </button>
        </div>
      </nav>

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-on-surface/40 backdrop-blur-sm px-4">
          <div className="glass-card p-6 w-full max-w-sm space-y-5 animate-fade-in-up border border-primary/10">
            <h3 className="text-headline-md text-on-surface text-center font-semibold">{t('shareReport')}</h3>
            <p className="text-label-sm text-on-surface-variant text-center">{t('sendReportToDoctor')}</p>
            {shareSuccess ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <Send size={28} className="text-primary" />
                <p className="text-primary font-medium text-sm">{t('reportSharedSuccess')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="Recipient doctor's email *"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 text-body-md text-on-surface placeholder:text-outline-variant/70 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                />
                <textarea
                  placeholder="Optional message..."
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 text-body-md text-on-surface placeholder:text-outline-variant/70 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors min-h-[80px] resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={() => setShareModalOpen(false)} className="flex-1 py-3 rounded-lg text-label-md font-medium text-on-surface-variant border border-primary/20 hover:bg-primary/5 transition-colors">{t('cancel')}</button>
                  <button
                    onClick={handleShare}
                    disabled={!shareEmail.trim() || shareLoading}
                    className="flex-1 py-3 rounded-lg text-label-md font-medium text-on-primary bg-primary shadow-btn-primary transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
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
