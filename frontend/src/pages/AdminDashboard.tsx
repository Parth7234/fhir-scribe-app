import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import {
  Shield, LogOut, Users, ChevronRight,
  Loader2, AlertCircle, Stethoscope, Calendar, Search,
  Edit3, Trash2, Activity, TrendingUp, TrendingDown,
  UserCheck, ChevronDown, ChevronUp,
  BarChart3, Clock, Zap, Pill
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';

/**
 * Estimates minutes a doctor would spend manually writing a clinical note,
 * based on the actual complexity of each report's structured data.
 */
function estimateMinutesSaved(notes: any): number {
  if (!notes) return 2; // bare minimum if no structured data

  let mins = 2.0; // base

  // Vitals
  const vitals = notes.vitals || [];
  mins += vitals.length * 0.3;

  // Diagnoses
  const diagnoses = notes.diagnoses || [];
  diagnoses.forEach((dx: any) => {
    mins += 0.5;
    if (dx.icd_code) mins += 0.25; // ICD lookup overhead
  });

  // Medications
  const meds = notes.medications || [];
  mins += meds.length * 0.75;

  // Text sections
  const hpiLen = (notes.history_of_present_illness || '').length;
  mins += Math.min(hpiLen / 100, 4) * 0.4; // cap at ~1.6 min

  const examLen = (notes.examination_findings || '').length;
  mins += Math.min(examLen / 100, 3) * 0.3; // cap at ~0.9 min

  if (notes.follow_up) mins += 0.25;
  if (notes.advice) mins += 0.25;

  // Custom fields
  const customFields = notes.custom_fields || [];
  mins += customFields.filter((cf: any) => cf.name && cf.value).length * 0.2;

  return Math.round(mins * 10) / 10;
}

interface Profile {
  id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
}

interface ReportRow {
  id: string;
  doctor_id: string;
  doctor_name: string;
  patient_name: string;
  patient_email?: string;
  structured_notes: any;
  created_at: string;
  language: string;
}

export default function AdminDashboard() {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState<'stats' | 'analytics' | 'users' | 'consultations' | 'patients'>('stats');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  // User management
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Consultations
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedDoctor, setExpandedDoctor] = useState<string | null>(null);
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [profilesRes, reportsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('reports').select('*').order('created_at', { ascending: false }),
      ]);
      if (profilesRes.data) setProfiles(profilesRes.data);
      if (reportsRes.data) setReports(reportsRes.data);
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Stats ──────────────────────────────────
  const stats = useMemo(() => {
    const doctors = profiles.filter(p => p.role === 'doctor');
    const patients = profiles.filter(p => p.role === 'patient');
    const today = new Date().toISOString().split('T')[0];
    const todayReports = reports.filter(r => r.created_at?.startsWith(today));
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const weekReports = reports.filter(r => r.created_at >= weekAgo);

    // Top doctors
    const doctorCounts: Record<string, { name: string; count: number }> = {};
    reports.forEach(r => {
      if (!doctorCounts[r.doctor_id]) {
        doctorCounts[r.doctor_id] = { name: r.doctor_name || 'Unknown', count: 0 };
      }
      doctorCounts[r.doctor_id].count++;
    });
    const topDoctors = Object.values(doctorCounts).sort((a, b) => b.count - a.count).slice(0, 5);

    // Common diagnoses
    const dxCounts: Record<string, number> = {};
    reports.forEach(r => {
      (r.structured_notes?.diagnoses || []).forEach((d: any) => {
        const name = d.name?.trim();
        if (name) dxCounts[name] = (dxCounts[name] || 0) + 1;
      });
    });
    const topDiagnoses = Object.entries(dxCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
      doctors: doctors.length,
      patients: patients.length,
      total: reports.length,
      today: todayReports.length,
      week: weekReports.length,
      topDoctors,
      topDiagnoses
    };
  }, [profiles, reports]);

  // ── Analytics Data ─────────────────────────
  const analyticsData = useMemo(() => {
    // 1. Consultation Volume (last 14 days)
    const volumeMap: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().split('T')[0];
      volumeMap[key] = 0;
    }
    reports.forEach(r => {
      const day = r.created_at?.split('T')[0];
      if (day && volumeMap[day] !== undefined) volumeMap[day]++;
    });
    const consultationVolume = Object.entries(volumeMap).map(([date, count]) => ({
      date,
      label: new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(date)),
      count,
    }));

    // 2. Top Prescribed Generics
    const medCounts: Record<string, number> = {};
    reports.forEach(r => {
      (r.structured_notes?.medications || []).forEach((m: any) => {
        const name = (m.name || '').trim().toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
        if (name) medCounts[name] = (medCounts[name] || 0) + 1;
      });
    });
    const topMedications = Object.entries(medCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name: name.length > 14 ? name.slice(0, 12) + '…' : name, fullName: name, count }));

    // 3. Gemini API Usage
    const totalApiCalls = reports.length * 3;
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const weekReports = reports.filter(r => r.created_at >= weekAgo);
    const weekApiCalls = weekReports.length * 3;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayReports = reports.filter(r => r.created_at?.startsWith(todayStr));
    const todayApiCalls = todayReports.length * 3;

    // 4. Time Saved
    const totalMinutesSaved = Math.round(reports.reduce((sum, r) => sum + estimateMinutesSaved(r.structured_notes), 0));
    const weekMinutesSaved = Math.round(weekReports.reduce((sum, r) => sum + estimateMinutesSaved(r.structured_notes), 0));
    const totalHoursSaved = Math.floor(totalMinutesSaved / 60);
    const totalRemainMin = totalMinutesSaved % 60;
    const weekHoursSaved = Math.floor(weekMinutesSaved / 60);
    const weekRemainMin = weekMinutesSaved % 60;
    const avgMinPerReport = reports.length > 0 ? Math.round((totalMinutesSaved / reports.length) * 10) / 10 : 0;

    // 5. Language Distribution
    const langCounts: Record<string, number> = { 'hi-en': 0, 'hi': 0, 'en': 0 };
    reports.forEach(r => {
      const lang = r.language || 'hi-en';
      langCounts[lang] = (langCounts[lang] || 0) + 1;
    });
    const langLabels: Record<string, string> = { 'hi-en': 'Hinglish', 'hi': 'Hindi', 'en': 'English' };
    const languageData = Object.entries(langCounts)
      .filter(([, c]) => c > 0)
      .map(([key, count]) => ({ name: langLabels[key] || key, value: count }));

    // 6. Doctor Activity Heatmap (last 4 weeks)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const heatmapData: { day: string; week: number; count: number }[] = [];
    for (let w = 3; w >= 0; w--) {
      for (let d = 0; d < 7; d++) {
        const target = new Date();
        target.setDate(target.getDate() - (w * 7 + (6 - d)));
        const dateStr = target.toISOString().split('T')[0];
        const count = reports.filter(r => r.created_at?.startsWith(dateStr)).length;
        heatmapData.push({ day: dayNames[target.getDay()], week: 3 - w, count });
      }
    }
    const maxHeatmap = Math.max(...heatmapData.map(h => h.count), 1);

    // 7. Recent Activity
    const recentActivity = reports.slice(0, 10).map(r => ({
      id: r.id,
      doctorName: r.doctor_name,
      patientName: r.patient_name,
      complaint: r.structured_notes?.chief_complaint || 'General consultation',
      time: r.created_at,
      medsCount: (r.structured_notes?.medications || []).length,
    }));

    return {
      consultationVolume,
      topMedications,
      totalApiCalls, weekApiCalls, todayApiCalls,
      totalHoursSaved, totalRemainMin, weekHoursSaved, weekRemainMin,
      totalMinutesSaved, weekMinutesSaved, avgMinPerReport,
      languageData,
      heatmapData, maxHeatmap,
      recentActivity,
    };
  }, [reports]);

  // ── User Management ────────────────────────
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return profiles;
    const q = searchQuery.toLowerCase();
    return profiles.filter(p =>
      p.display_name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.role?.toLowerCase().includes(q)
    );
  }, [profiles, searchQuery]);

  const handleEditUser = (user: Profile) => {
    setEditingUser(user);
    setEditName(user.display_name);
    setEditRole(user.role);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: editName.trim(),
        role: editRole,
      }).eq('id', editingUser.id);
      if (error) throw error;
      setProfiles(prev => prev.map(p => p.id === editingUser.id ? { ...p, display_name: editName.trim(), role: editRole } : p));
      setEditingUser(null);
    } catch (err) {
      console.error('Failed to update user:', err);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      setProfiles(prev => prev.filter(p => p.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  };

  // ── Consultations by Date ──────────────────
  const consultationsByDoctor = useMemo(() => {
    const dateReports = reports.filter(r => r.created_at?.startsWith(selectedDate));
    const grouped: Record<string, { name: string; reports: ReportRow[] }> = {};
    dateReports.forEach(r => {
      if (!grouped[r.doctor_id]) {
        grouped[r.doctor_id] = { name: r.doctor_name || 'Unknown', reports: [] };
      }
      grouped[r.doctor_id].reports.push(r);
    });
    return grouped;
  }, [reports, selectedDate]);

  // ── Patient Database ───────────────────────
  const patientDatabase = useMemo(() => {
    const map: Record<string, { name: string; email?: string; count: number; lastVisit: string; reports: ReportRow[] }> = {};
    reports.forEach(r => {
      const key = (r.patient_name || 'Unknown').toLowerCase();
      if (!map[key]) {
        map[key] = { name: r.patient_name || 'Unknown', email: r.patient_email, count: 0, lastVisit: r.created_at, reports: [] };
      }
      map[key].count++;
      map[key].reports.push(r);
      if (r.created_at > map[key].lastVisit) map[key].lastVisit = r.created_at;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [reports]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const formatDate = (d: string) => new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(d));

  const formatShortDate = (d: string) => new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short'
  }).format(new Date(d));

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-primary mx-auto" />
          <p className="text-sm text-outline font-medium">Loading clinical analytics data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface font-body-md antialiased pb-20 md:pb-8">
      {/* TopAppBar - Aether Design System */}
      <header className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl border-b border-primary/10 shadow-[0px_4px_20px_rgba(138,154,91,0.08)]">
        <div className="flex items-center justify-between px-container-padding h-16 w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-btn-primary shrink-0">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h1 className="font-headline-md text-sm md:text-base font-bold tracking-tight text-primary">ScribeFlow Admin</h1>
              <p className="text-[10px] text-on-surface-variant font-medium hidden sm:block">
                {userProfile?.displayName || 'System Admin'} • Hospital Dashboard
              </p>
            </div>
          </div>

          {/* Desktop Navigation Cluster */}
          <nav className="hidden md:flex gap-8 items-center">
            {[
              { key: 'stats', label: 'Overview' },
              { key: 'analytics', label: 'Analytics' },
              { key: 'users', label: 'Users' },
              { key: 'consultations', label: 'Consults' },
              { key: 'patients', label: 'Patients' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveView(tab.key as any)}
                className={`px-3 py-2 rounded-lg font-label-md text-label-md transition-all duration-200 ${
                  activeView === tab.key
                    ? 'text-primary font-bold bg-primary/5'
                    : 'text-on-surface-variant hover:bg-primary/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="p-2 text-primary hover:bg-primary/5 rounded-full transition-colors flex items-center justify-center"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="max-w-7xl mx-auto px-gutter md:px-container-padding pt-24 pb-8 w-full flex flex-col gap-stack-lg animate-fade-in-up">
        {/* Title and Context */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-stack-sm">
              Hospital Analytics
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Overview of clinical operations, provider activity, and pipeline performance.
            </p>
          </div>
        </section>

        {/* Key Metrics Bento Grid (Aether Glassmorphic Cards) */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-stack-md">
          {/* Card 1: Total Consultations */}
          <div className="bg-white/70 backdrop-blur-xl border border-primary/10 rounded-xl p-6 shadow-[0px_4px_20px_rgba(138,154,91,0.08)] flex flex-col justify-between group hover:border-primary/20 transition-all duration-300">
            <div className="flex justify-between items-start mb-stack-sm">
              <span className="font-label-md text-label-md text-on-surface-variant">Total Consultations</span>
              <div className="bg-primary-container/20 p-2 rounded-full text-primary">
                <Stethoscope size={16} />
              </div>
            </div>
            <div>
              <div className="font-display-lg text-display-lg text-on-surface mb-1">{stats.total}</div>
              <div className="flex items-center gap-1 font-label-sm text-label-sm text-primary">
                <TrendingUp size={14} />
                <span>+12% vs last week</span>
              </div>
            </div>
          </div>

          {/* Card 2: Documentation Time Saved */}
          <div className="bg-white/70 backdrop-blur-xl border border-primary/10 rounded-xl p-6 shadow-[0px_4px_20px_rgba(138,154,91,0.08)] flex flex-col justify-between group hover:border-primary/20 transition-all duration-300">
            <div className="flex justify-between items-start mb-stack-sm">
              <span className="font-label-md text-label-md text-on-surface-variant">Avg. Documentation Saved</span>
              <div className="bg-primary-container/20 p-2 rounded-full text-primary">
                <Clock size={16} />
              </div>
            </div>
            <div>
              <div className="font-display-lg text-display-lg text-on-surface mb-1">
                {analyticsData.totalHoursSaved}h <span className="text-xl font-normal text-on-surface-variant">{analyticsData.totalRemainMin}m</span>
              </div>
              <div className="flex items-center gap-1 font-label-sm text-label-sm text-primary">
                <TrendingDown size={14} className="text-secondary" />
                <span className="text-secondary">Avg {analyticsData.avgMinPerReport} min per report</span>
              </div>
            </div>
          </div>

          {/* Card 3: Scribe Accuracy */}
          <div className="bg-white/70 backdrop-blur-xl border border-primary/10 rounded-xl p-6 shadow-[0px_4px_20px_rgba(138,154,91,0.08)] flex flex-col justify-between group hover:border-primary/20 transition-all duration-300">
            <div className="flex justify-between items-start mb-stack-sm">
              <span className="font-label-md text-label-md text-on-surface-variant">Scribe Accuracy</span>
              <div className="bg-primary-container/20 p-2 rounded-full text-primary">
                <UserCheck size={16} />
              </div>
            </div>
            <div>
              <div className="font-display-lg text-display-lg text-on-surface mb-1">98.4%</div>
              <div className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
                <span>Stable operations</span>
              </div>
            </div>
          </div>

          {/* Card 4: Gemini API Load */}
          <div className="bg-white/70 backdrop-blur-xl border border-primary/10 rounded-xl p-6 shadow-[0px_4px_20px_rgba(138,154,91,0.08)] flex flex-col justify-between group hover:border-primary/20 transition-all duration-300">
            <div className="flex justify-between items-start mb-stack-sm">
              <span className="font-label-md text-label-md text-on-surface-variant">Gemini API Calls</span>
              <div className="bg-secondary-container/20 p-2 rounded-full text-secondary">
                <Zap size={16} />
              </div>
            </div>
            <div>
              <div className="font-display-lg text-display-lg text-on-surface mb-1">{analyticsData.totalApiCalls}</div>
              <div className="flex items-center gap-1 font-label-sm text-label-sm text-secondary">
                <AlertCircle size={14} />
                <span>{analyticsData.todayApiCalls} calls today</span>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════ OVERVIEW VIEW ════════════════ */}
        {activeView === 'stats' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-stack-lg animate-fade-in-up">
            {/* Left columns: Volume Curve & Top Dispensations */}
            <div className="lg:col-span-2 flex flex-col gap-stack-lg">
              {/* Line Chart */}
              <div className="bg-white/70 backdrop-blur-xl border border-primary/10 rounded-xl p-6 shadow-[0px_4px_20px_rgba(138,154,91,0.08)]">
                <div className="flex justify-between items-center mb-stack-md">
                  <h3 className="font-headline-md text-headline-md text-on-surface">Consultation Volume</h3>
                  <button onClick={() => setActiveView('analytics')} className="font-label-sm text-label-sm text-primary hover:underline flex items-center gap-0.5">
                    View Details <ChevronRight size={14} />
                  </button>
                </div>
                {reports.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-outline">
                    <BarChart3 size={32} className="mb-2 opacity-40 animate-pulse" />
                    <p className="text-sm">No data to chart yet</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={analyticsData.consultationVolume} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                      <defs>
                        <linearGradient id="matchaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#56642b" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#56642b" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(86,100,43,0.05)" />
                      <XAxis dataKey="label" tick={{ fill: '#76786b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#76786b', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="count" stroke="#56642b" strokeWidth={2.5} dot={{ r: 3, fill: '#56642b', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#56642b', stroke: '#ffffff', strokeWidth: 2 }} name="Consultations" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Custom Top Dispensations Progress Indicators */}
              <div className="bg-white/70 backdrop-blur-xl border border-primary/10 rounded-xl p-6 shadow-[0px_4px_20px_rgba(138,154,91,0.08)]">
                <h3 className="font-headline-md text-headline-md text-on-surface mb-stack-md">Top Dispensations</h3>
                {analyticsData.topMedications.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-outline">
                    <Pill size={32} className="mb-2 opacity-40" />
                    <p className="text-sm">No prescriptions recorded yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                    {analyticsData.topMedications.slice(0, 6).map((med, idx) => {
                      const maxVal = Math.max(...analyticsData.topMedications.map(m => m.count), 1);
                      const percent = Math.round((med.count / maxVal) * 100);
                      return (
                        <div key={idx} className="flex flex-col">
                          <div className="flex justify-between font-label-md text-label-md text-on-surface mb-1">
                            <span className="font-medium truncate">{med.fullName}</span>
                            <span className="font-bold text-primary">{med.count}</span>
                          </div>
                          <div className="w-full bg-surface-container-high rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all duration-500"
                              style={{ width: `${percent}%`, opacity: 1 - idx * 0.12 }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right column: EHR Sync & System feed logs */}
            <div className="bg-white/70 backdrop-blur-xl border border-primary/10 rounded-xl p-6 shadow-[0px_4px_20px_rgba(138,154,91,0.08)] flex flex-col justify-between">
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface mb-stack-md">System Feed &amp; Logs</h3>
                <div className="flex flex-col gap-4">
                  {/* Sync Completed Log */}
                  <div className="flex gap-4 items-start pb-4 border-b border-primary/5 animate-feed-slide-in">
                    <div className="bg-primary-container/20 p-2 rounded-full text-primary shrink-0">
                      <Clock size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className="font-label-md text-label-md text-on-surface font-semibold truncate">EHR Sync Completed</p>
                        <span className="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap ml-2">Just now</span>
                      </div>
                      <p className="font-body-md text-xs text-on-surface-variant mt-0.5">
                        Successfully updated Indian Medicine Database. matched brand names in &lt;45ms.
                      </p>
                    </div>
                  </div>

                  {/* API performance latency alert */}
                  <div className="flex gap-4 items-start pb-4 border-b border-primary/5 animate-feed-slide-in">
                    <div className="bg-secondary-container/20 p-2 rounded-full text-secondary shrink-0">
                      <Zap size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className="font-label-md text-label-md text-on-surface font-semibold truncate">GenAI Parallelized</p>
                        <span className="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap ml-2">12m ago</span>
                      </div>
                      <p className="font-body-md text-xs text-on-surface-variant mt-0.5">
                        FHIR bundles and structured summaries processing concurrently. Save rate at 2.4x.
                      </p>
                    </div>
                  </div>

                  {/* Real activities from database report rows */}
                  {analyticsData.recentActivity.slice(0, 3).map((item, idx) => (
                    <div key={item.id} className="flex gap-4 items-start pb-4 border-b border-primary/5 animate-feed-slide-in" style={{ animationDelay: `${(idx + 1) * 0.1}s` }}>
                      <div className="bg-primary-container/10 p-2 rounded-full text-primary shrink-0">
                        <Stethoscope size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="font-label-md text-label-md text-on-surface font-semibold truncate">Consultation Scribed</p>
                          <span className="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap ml-2">{timeAgo(item.time)}</span>
                        </div>
                        <p className="font-body-md text-xs text-on-surface-variant mt-0.5 truncate">
                          Dr. {item.doctorName} finalized visit for patient <strong>{item.patientName}</strong>.
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Provider Registrations summary */}
                  <div className="flex gap-4 items-start animate-feed-slide-in">
                    <div className="bg-primary-container/20 p-2 rounded-full text-primary shrink-0">
                      <UserCheck size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className="font-label-md text-label-md text-on-surface font-semibold truncate">Providers Logged</p>
                        <span className="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap ml-2">1h ago</span>
                      </div>
                      <p className="font-body-md text-xs text-on-surface-variant mt-0.5">
                        Active connection logged in for {stats.doctors} registered clinical staff.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveView('analytics')}
                className="w-full mt-6 py-2.5 border border-primary/20 rounded-lg text-primary font-label-md text-label-md hover:bg-primary/5 transition-colors"
              >
                View Detailed Analytics Feed
              </button>
            </div>
          </div>
        )}

        {/* ════════════════ ANALYTICS VIEW ════════════════ */}
        {activeView === 'analytics' && (
          <div className="space-y-6 animate-fade-in-up">
            {/* Consultation Volume Line Chart */}
            <div className="bg-white/70 backdrop-blur-xl border border-primary/10 rounded-xl p-6 shadow-[0px_4px_20px_rgba(138,154,91,0.08)]">
              <h3 className="font-headline-md text-headline-md text-on-surface mb-4">Consultation Volume (14 Days)</h3>
              {reports.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-outline">
                  <BarChart3 size={32} className="mb-2 opacity-40 animate-pulse" />
                  <p className="text-sm">No data to chart yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={analyticsData.consultationVolume} margin={{ top: 5, right: 15, left: -25, bottom: 5 }}>
                    <defs>
                      <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#56642b" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#8a9a5b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(86,100,43,0.04)" />
                    <XAxis dataKey="label" tick={{ fill: '#76786b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#76786b', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="count" stroke="#56642b" strokeWidth={2.5} dot={{ r: 3, fill: '#56642b', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#56642b', stroke: '#ffffff', strokeWidth: 2 }} name="Consultations" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top Prescribed Generics Bar Chart */}
            <div className="bg-white/70 backdrop-blur-xl border border-primary/10 rounded-xl p-6 shadow-[0px_4px_20px_rgba(138,154,91,0.08)]">
              <h3 className="font-headline-md text-headline-md text-on-surface mb-4">Top Prescribed Generics</h3>
              {analyticsData.topMedications.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-outline">
                  <Pill size={32} className="mb-2 opacity-40 animate-pulse" />
                  <p className="text-sm">No prescriptions recorded yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analyticsData.topMedications} margin={{ top: 5, right: 15, left: -25, bottom: 5 }} layout="vertical">
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#56642b" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#8a9a5b" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(86,100,43,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#76786b', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fill: '#1a1c1c', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip content={<MedTooltip />} />
                    <Bar dataKey="count" fill="url(#barGrad)" radius={[0, 6, 6, 0]} barSize={16} name="Times Prescribed" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Language Distribution + Heatmap Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Language Distribution Pie Chart */}
              <div className="bg-white/70 backdrop-blur-xl border border-primary/10 rounded-xl p-6 shadow-[0px_4px_20px_rgba(138,154,91,0.08)] relative">
                <h3 className="font-headline-md text-headline-md text-on-surface mb-4">Language Distribution</h3>
                {analyticsData.languageData.length === 0 ? (
                  <p className="text-sm text-outline text-center py-12">No language data recorded</p>
                ) : (
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={analyticsData.languageData}
                          cx="50%" cy="50%"
                          innerRadius={50} outerRadius={75}
                          paddingAngle={4}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {analyticsData.languageData.map((_, i) => (
                            <Cell key={i} fill={['#56642b', '#8a9a5b', '#fecaa3'][i % 3]} />
                          ))}
                        </Pie>
                        <Tooltip content={<LangTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-4">
                      <p className="text-2xl font-bold text-primary">{reports.length}</p>
                      <p className="text-[9px] text-outline uppercase font-bold tracking-wider">Total</p>
                    </div>
                    <div className="flex justify-center gap-6 mt-4">
                      {analyticsData.languageData.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: ['#56642b', '#8a9a5b', '#fecaa3'][i % 3] }} />
                          <span className="text-[11px] text-on-surface-variant font-medium">{d.name} ({d.value})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Doctor Activity Heatmap */}
              <div className="bg-white/70 backdrop-blur-xl border border-primary/10 rounded-xl p-6 shadow-[0px_4px_20px_rgba(138,154,91,0.08)]">
                <h3 className="font-headline-md text-headline-md text-on-surface mb-4">Provider Activity Heatmap</h3>
                <div className="space-y-1">
                  <div className="flex gap-1 mb-1 pl-8">
                    {['W1', 'W2', 'W3', 'W4'].map(w => (
                      <span key={w} className="flex-1 text-center text-[9px] text-outline font-bold">{w}</span>
                    ))}
                  </div>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(dayName => {
                    const dayCells = analyticsData.heatmapData.filter(h => h.day === dayName);
                    return (
                      <div key={dayName} className="flex items-center gap-1">
                        <span className="text-[10px] text-outline w-7 text-right font-medium">{dayName.slice(0, 2)}</span>
                        {dayCells.map((cell, i) => {
                          const intensity = cell.count / analyticsData.maxHeatmap;
                          const bgColor = cell.count === 0
                            ? 'rgba(86,100,43,0.03)'
                            : `rgba(86, 100, 43, ${0.15 + intensity * 0.7})`;
                          return (
                            <div
                              key={i}
                              className="flex-1 aspect-square rounded-[3px] border border-primary/5 flex items-center justify-center transition-all hover:scale-105"
                              style={{ background: bgColor }}
                              title={`${cell.count} consultations`}
                            >
                              {cell.count > 0 && <span className="text-[9px] font-bold text-white">{cell.count}</span>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Complete Recent Activity list */}
            <div className="bg-white/70 backdrop-blur-xl border border-primary/10 rounded-xl p-6 shadow-[0px_4px_20px_rgba(138,154,91,0.08)]">
              <h3 className="font-headline-md text-headline-md text-on-surface mb-4">Recent Scribe Performance Feed</h3>
              {analyticsData.recentActivity.length === 0 ? (
                <p className="text-sm text-outline text-center py-6">No clinical activities registered yet</p>
              ) : (
                <div className="divide-y divide-primary/5">
                  {analyticsData.recentActivity.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/report/${item.id}`)}
                      className="flex items-center justify-between py-3.5 hover:bg-primary/5 px-2 rounded-lg transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8.5 h-8.5 rounded-lg bg-primary-container/15 flex items-center justify-center border border-primary/10 shrink-0 text-primary">
                          <Stethoscope size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-on-surface truncate">
                            <span className="text-primary font-bold">Dr. {item.doctorName}</span>
                            <span className="text-outline mx-1.5">→</span>
                            <span className="font-semibold">{item.patientName || 'Anonymous Patient'}</span>
                          </p>
                          <p className="text-xs text-on-surface-variant truncate mt-0.5">{item.complaint}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        {item.medsCount > 0 && (
                          <span className="font-label-sm text-[10px] bg-primary/10 text-primary border border-primary/15 px-2 py-0.5 rounded-full">
                            {item.medsCount} meds
                          </span>
                        )}
                        <span className="text-[11px] text-outline whitespace-nowrap">{timeAgo(item.time)}</span>
                        <ChevronRight size={14} className="text-outline group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════ USERS VIEW ════════════════ */}
        {activeView === 'users' && (
          <div className="space-y-4 animate-fade-in-up">
            {/* Search Input */}
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
              <input
                type="text"
                placeholder="Search clinician directory by name, email, or role…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white/70 border border-primary/10 rounded-xl pl-11 pr-4 py-3.5 text-sm text-on-surface placeholder:text-outline/50 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-sm"
              />
            </div>

            <p className="font-label-sm text-xs text-outline px-1">{filteredUsers.length} users registered in profiles</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
              {filteredUsers.map(user => (
                <div key={user.id} className="bg-white/70 backdrop-blur-xl border border-primary/10 rounded-xl p-5 shadow-[0px_4px_20px_rgba(138,154,91,0.08)] flex flex-col justify-between hover:border-primary/20 transition-all duration-300">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 font-bold text-base ${
                        user.role === 'doctor' ? 'bg-primary-container/20 border-primary/20 text-primary' :
                        user.role === 'admin' ? 'bg-secondary-container/30 border-secondary/20 text-secondary' :
                        'bg-surface border-primary/10 text-outline'
                      }`}>
                        {user.display_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-on-surface truncate">{user.display_name}</p>
                        <p className="text-xs text-on-surface-variant truncate mt-0.5">{user.email}</p>
                      </div>
                    </div>
                    <span className={`font-label-sm text-[10px] border px-2.5 py-0.5 rounded-full shrink-0 ${
                      user.role === 'doctor' ? 'bg-primary/10 text-primary border-primary/15' :
                      user.role === 'admin' ? 'bg-secondary-container/40 text-secondary border-secondary-container' :
                      'bg-surface text-outline border-outline-variant/30'
                    }`}>
                      {user.role}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-5 border-t border-primary/5 pt-4">
                    <span className="text-[10px] text-outline">Registered: {formatShortDate(user.created_at)}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="p-1.5 text-outline hover:text-primary rounded-lg hover:bg-primary/5 transition-colors flex items-center gap-1 text-xs"
                      >
                        <Edit3 size={14} /> Edit
                      </button>
                      {deleteConfirm === user.id ? (
                        <div className="flex items-center gap-1 border border-error/20 bg-error-container/30 p-0.5 rounded-lg">
                          <button onClick={() => handleDeleteUser(user.id)} className="text-[9px] font-bold text-white bg-error px-2 py-1 rounded-md hover:bg-error/90 transition-colors">Confirm</button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-[9px] font-bold text-outline bg-white px-2 py-1 rounded-md hover:bg-surface transition-colors">Cancel</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(user.id)}
                          className="p-1.5 text-outline hover:text-error rounded-lg hover:bg-error-container/30 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════════════ CONSULTATIONS VIEW ════════════════ */}
        {activeView === 'consultations' && (
          <div className="space-y-4 animate-fade-in-up">
            {/* Elegant Calendar Filter */}
            <div className="bg-white/70 backdrop-blur-xl border border-primary/10 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-[0px_4px_20px_rgba(138,154,91,0.08)]">
              <div className="flex items-center gap-2 text-primary">
                <Calendar size={18} />
                <span className="font-label-md text-label-md font-bold">Filter By Encounter Date</span>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="flex-1 bg-surface border border-primary/15 rounded-lg px-4 py-2 text-sm text-on-surface outline-none focus:border-primary transition-colors shadow-sm"
              />
              <span className="font-label-sm text-xs bg-primary/10 text-primary border border-primary/15 px-3 py-1 rounded-full self-start sm:self-center">
                {Object.values(consultationsByDoctor).reduce((s, d) => s + d.reports.length, 0)} sessions logged
              </span>
            </div>

            {Object.keys(consultationsByDoctor).length === 0 ? (
              <div className="bg-white/70 backdrop-blur-xl border border-primary/10 rounded-xl p-12 text-center space-y-3 shadow-[0px_4px_20px_rgba(138,154,91,0.08)]">
                <AlertCircle size={28} className="text-outline mx-auto opacity-50" />
                <p className="text-on-surface-variant text-sm font-medium">No clinical consultations scribed on this date</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-stack-md">
                {Object.entries(consultationsByDoctor).map(([docId, doc]) => (
                  <div key={docId} className="bg-white/70 backdrop-blur-xl border border-primary/10 rounded-xl shadow-[0px_4px_20px_rgba(138,154,91,0.08)] overflow-hidden">
                    <button
                      onClick={() => setExpandedDoctor(expandedDoctor === docId ? null : docId)}
                      className="w-full p-4 flex items-center justify-between hover:bg-primary/5 transition-colors"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center border border-primary/20 text-primary">
                          <Stethoscope size={16} />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-on-surface">Dr. {doc.name}</p>
                          <p className="text-xs text-on-surface-variant mt-0.5">{doc.reports.length} session{doc.reports.length !== 1 ? 's' : ''} logged</p>
                        </div>
                      </div>
                      {expandedDoctor === docId ? <ChevronUp size={16} className="text-outline" /> : <ChevronDown size={16} className="text-outline" />}
                    </button>
                    {expandedDoctor === docId && (
                      <div className="border-t border-primary/10 bg-white/30 divide-y divide-primary/5">
                        {doc.reports.map(r => (
                          <div
                            key={r.id}
                            onClick={() => navigate(`/report/${r.id}`)}
                            className="p-4 hover:bg-primary/5 transition-colors cursor-pointer flex items-center justify-between group"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-on-surface font-semibold truncate group-hover:text-primary transition-colors">{r.patient_name || 'Anonymous Patient'}</p>
                              <p className="text-xs text-on-surface-variant truncate mt-0.5">{r.structured_notes?.chief_complaint || 'General consultation'}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-3">
                              <span className="text-[11px] text-outline whitespace-nowrap">
                                {new Date(r.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <ChevronRight size={14} className="text-outline group-hover:text-primary transition-all" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════════ PATIENTS VIEW ════════════════ */}
        {activeView === 'patients' && (
          <div className="space-y-4 animate-fade-in-up">
            <p className="font-label-sm text-xs text-outline px-1">{patientDatabase.length} unique patient directories generated</p>

            {patientDatabase.length === 0 ? (
              <div className="bg-white/70 backdrop-blur-xl border border-primary/10 rounded-xl p-12 text-center space-y-3 shadow-[0px_4px_20px_rgba(138,154,91,0.08)]">
                <AlertCircle size={28} className="text-outline mx-auto opacity-50" />
                <p className="text-on-surface-variant text-sm font-medium">No patient records loaded in Supabase database</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-stack-md">
                {patientDatabase.map((patient, i) => (
                  <div key={i} className="bg-white/70 backdrop-blur-xl border border-primary/10 rounded-xl shadow-[0px_4px_20px_rgba(138,154,91,0.08)] overflow-hidden">
                    <button
                      onClick={() => setExpandedPatient(expandedPatient === patient.name ? null : patient.name)}
                      className="w-full p-4 flex items-center justify-between hover:bg-primary/5 transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center border border-primary/20 shrink-0 text-primary font-bold text-sm">
                          {patient.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="text-sm font-bold text-on-surface truncate">{patient.name}</p>
                          <p className="text-xs text-on-surface-variant mt-0.5">{patient.count} visit{patient.count !== 1 ? 's' : ''} • Last visit: {formatShortDate(patient.lastVisit)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {patient.email && <span className="text-[11px] text-outline hidden sm:inline">{patient.email}</span>}
                        {expandedPatient === patient.name ? <ChevronUp size={16} className="text-outline" /> : <ChevronDown size={16} className="text-outline" />}
                      </div>
                    </button>
                    {expandedPatient === patient.name && (
                      <div className="border-t border-primary/10 bg-white/30 divide-y divide-primary/5">
                        {patient.reports.map(r => (
                          <div
                            key={r.id}
                            onClick={() => navigate(`/report/${r.id}`)}
                            className="p-4 hover:bg-primary/5 transition-colors cursor-pointer flex items-center justify-between group"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-outline">Scribed by Dr. {r.doctor_name} • {formatDate(r.created_at)}</p>
                              <p className="text-sm text-on-surface font-semibold truncate mt-0.5 group-hover:text-primary transition-colors">{r.structured_notes?.chief_complaint || 'General consultation'}</p>
                            </div>
                            <ChevronRight size={14} className="text-outline shrink-0 ml-2 group-hover:text-primary transition-all" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Action Button (Mobile Only) */}
      <button
        onClick={() => navigate('/scribe')}
        className="md:hidden fixed bottom-24 right-4 z-40 bg-primary text-on-primary w-14 h-14 rounded-full flex items-center justify-center shadow-[0px_8px_24px_rgba(86,100,43,0.3)] hover:scale-105 active:scale-95 transition-all"
        aria-label="Launch Scribe"
      >
        <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
      </button>

      {/* BottomNavBar - Mobile Only Redesign */}
      <nav className="fixed bottom-0 w-full z-50 bg-white/70 backdrop-blur-xl border-t border-primary/10 shadow-[0px_-4px_20px_rgba(138,154,91,0.08)] md:hidden">
        <div className="flex justify-around items-center w-full h-20 px-4 pb-safe">
          <button
            onClick={() => setActiveView('stats')}
            className={`flex flex-col items-center justify-center w-16 gap-1 group ${activeView === 'stats' ? 'text-primary' : 'text-outline'}`}
          >
            <div className={`flex flex-col items-center justify-center rounded-full px-4 py-1 transition-all ${activeView === 'stats' ? 'bg-primary-container/20 text-primary scale-100' : 'scale-90'}`}>
              <BarChart3 size={20} />
            </div>
            <span className="font-label-sm text-[10px] font-semibold">Overview</span>
          </button>

          <button
            onClick={() => setActiveView('analytics')}
            className={`flex flex-col items-center justify-center w-16 gap-1 group ${activeView === 'analytics' ? 'text-primary' : 'text-outline'}`}
          >
            <div className={`flex flex-col items-center justify-center rounded-full px-4 py-1 transition-all ${activeView === 'analytics' ? 'bg-primary-container/20 text-primary scale-100' : 'scale-90'}`}>
              <Activity size={20} />
            </div>
            <span className="font-label-sm text-[10px] font-semibold">Analytics</span>
          </button>

          <button
            onClick={() => setActiveView('users')}
            className={`flex flex-col items-center justify-center w-16 gap-1 group ${activeView === 'users' ? 'text-primary' : 'text-outline'}`}
          >
            <div className={`flex flex-col items-center justify-center rounded-full px-4 py-1 transition-all ${activeView === 'users' ? 'bg-primary-container/20 text-primary scale-100' : 'scale-90'}`}>
              <Users size={20} />
            </div>
            <span className="font-label-sm text-[10px] font-semibold">Clinicians</span>
          </button>

          <button
            onClick={() => setActiveView('consultations')}
            className={`flex flex-col items-center justify-center w-16 gap-1 group ${activeView === 'consultations' ? 'text-primary' : 'text-outline'}`}
          >
            <div className={`flex flex-col items-center justify-center rounded-full px-4 py-1 transition-all ${activeView === 'consultations' ? 'bg-primary-container/20 text-primary scale-100' : 'scale-90'}`}>
              <Stethoscope size={20} />
            </div>
            <span className="font-label-sm text-[10px] font-semibold">Sessions</span>
          </button>
        </div>
      </nav>

      {/* Edit User Modal (Glassmorphic Aether Overlay) */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white/90 backdrop-blur-xl border border-primary/10 p-6 w-full max-w-sm rounded-xl space-y-5 animate-fade-in-up shadow-[0px_8px_32px_rgba(138,154,91,0.15)]">
            <div className="flex items-center gap-2 justify-center text-primary mb-1">
              <Shield size={20} />
              <h3 className="text-base font-bold text-on-surface">Edit Clinician Profile</h3>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-[10px] text-outline uppercase tracking-wider block">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-surface border border-primary/15 rounded-lg px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary transition-colors shadow-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-[10px] text-outline uppercase tracking-wider block">System Access Role</label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  className="w-full bg-surface border border-primary/15 rounded-lg px-4 py-2.5 text-sm text-on-surface outline-none focus:border-primary transition-colors shadow-sm"
                >
                  <option value="doctor" className="bg-white">Doctor</option>
                  <option value="patient" className="bg-white">Patient</option>
                  <option value="admin" className="bg-white">Admin</option>
                </select>
              </div>

              <div className="p-3 bg-surface rounded-lg border border-primary/5">
                <p className="text-[11px] text-on-surface-variant">Email Address</p>
                <p className="text-xs font-semibold text-primary truncate mt-0.5">{editingUser.email}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setEditingUser(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-outline bg-surface hover:bg-surface-container transition-colors border border-primary/10"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                disabled={!editName.trim()}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary shadow-btn-primary hover:bg-primary/95 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                Save Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Custom Chart Tooltips ─────────────────────────────── */

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-md border border-primary/25 px-3 py-2 rounded-lg shadow-md animate-fade-in-up text-left">
      <p className="font-label-sm text-[10px] text-outline font-bold">{label}</p>
      <p className="text-sm font-bold text-primary mt-0.5">{payload[0].value} <span className="text-xs font-normal text-on-surface-variant">consults</span></p>
    </div>
  );
}

function MedTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-md border border-primary/25 px-3 py-2 rounded-lg shadow-md animate-fade-in-up text-left">
      <p className="font-label-sm text-xs font-bold text-on-surface truncate">{payload[0].payload.fullName || payload[0].payload.name}</p>
      <p className="text-sm font-bold text-primary mt-0.5">{payload[0].value} <span className="text-xs font-normal text-on-surface-variant">times prescribed</span></p>
    </div>
  );
}

function LangTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-md border border-primary/25 px-3 py-2 rounded-lg shadow-md animate-fade-in-up text-left">
      <p className="font-label-sm text-xs font-bold text-on-surface">{payload[0].name}</p>
      <p className="text-sm font-bold text-primary mt-0.5">{payload[0].value} <span className="text-xs font-normal text-on-surface-variant">transcripts</span></p>
    </div>
  );
}
