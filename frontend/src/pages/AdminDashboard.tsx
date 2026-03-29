import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import {
  Shield, LogOut, Users, FileText, ChevronRight,
  Loader2, AlertCircle, Stethoscope, Calendar, Search,
  Edit3, Trash2, Save, Activity, TrendingUp,
  UserCheck, Heart, ChevronDown, ChevronUp,
  BarChart3, Clock, Zap,
  Pill, Globe, Timer
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';

/**
 * Estimates minutes a doctor would spend manually writing a clinical note,
 * based on the actual complexity of each report's structured data.
 *
 * Formula:
 *   Base Documentation Time:         2.0 min  (opening EMR, patient header, saving)
 *   + per Vital Sign:                0.3 min  (reading & typing each value + unit)
 *   + per Diagnosis:                 0.5 min  (writing name + severity)
 *     └ with ICD code:              +0.25 min (looking up & entering code)
 *   + per Medication:                0.75 min (drug + dosage + frequency + duration + route)
 *   + HPI text length:               ~0.4 min per 100 chars
 *   + Examination findings length:   ~0.3 min per 100 chars
 *   + Follow-up / Advice present:   +0.25 min each
 *   + Custom fields:                +0.2 min each
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

  // Medications (most time-consuming to document)
  const meds = notes.medications || [];
  mins += meds.length * 0.75;

  // Text sections — longer text = more documentation effort
  const hpiLen = (notes.history_of_present_illness || '').length;
  mins += Math.min(hpiLen / 100, 4) * 0.4; // cap at ~1.6 min

  const examLen = (notes.examination_findings || '').length;
  mins += Math.min(examLen / 100, 3) * 0.3; // cap at ~0.9 min

  if (notes.follow_up) mins += 0.25;
  if (notes.advice) mins += 0.25;

  // Custom fields
  const customFields = notes.custom_fields || [];
  mins += customFields.filter((cf: any) => cf.name && cf.value).length * 0.2;

  return Math.round(mins * 10) / 10; // round to 1 decimal
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

    return { doctors: doctors.length, patients: patients.length, total: reports.length, today: todayReports.length, week: weekReports.length, topDoctors, topDiagnoses };
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
    const totalApiCalls = reports.length * 3; // 1 transcription + 1 FHIR + 1 structured notes
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const weekReports = reports.filter(r => r.created_at >= weekAgo);
    const weekApiCalls = weekReports.length * 3;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayReports = reports.filter(r => r.created_at?.startsWith(todayStr));
    const todayApiCalls = todayReports.length * 3;

    // 4. Time Saved (complexity-based per-report scoring)
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

    // 6. Doctor Activity Heatmap (last 4 weeks, 7 days per week)
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

  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const formatDate = (d: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
  const formatShortDate = (d: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(d));

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 size={28} className="animate-spin text-amber-400 mx-auto" />
          <p className="text-sm text-gray-400">Loading admin data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-black/30 border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">Admin Dashboard</h1>
              <p className="text-[10px] text-gray-400 font-medium">{userProfile?.displayName} • Hospital Management</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-5">
        {/* View Toggle */}
        <div className="glass-card p-1.5 flex gap-1">
          {[
            { key: 'stats', icon: <TrendingUp size={14} />, label: 'Overview' },
            { key: 'analytics', icon: <BarChart3 size={14} />, label: 'Analytics' },
            { key: 'users', icon: <Users size={14} />, label: 'Users' },
            { key: 'consultations', icon: <Stethoscope size={14} />, label: 'Consults' },
            { key: 'patients', icon: <Heart size={14} />, label: 'Patients' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveView(tab.key as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-300 ${
                activeView === tab.key
                  ? 'bg-white/10 text-white border border-white/10'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ════════════════ STATS / OVERVIEW VIEW ════════════════ */}
        {activeView === 'stats' && (
          <div className="space-y-5 animate-fade-in-up">

            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={<UserCheck size={14} className="text-indigo-400" />} label="Doctors" value={stats.doctors} />
              <StatCard icon={<Heart size={14} className="text-rose-400" />} label="Patients" value={stats.patients} />
              <StatCard icon={<FileText size={14} className="text-purple-400" />} label="Total Reports" value={stats.total} />
              <StatCard icon={<Activity size={14} className="text-emerald-400" />} label="Today" value={stats.today} />
            </div>

            {/* Time Saved + API Usage Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Total Time Saved */}
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Timer size={14} className="text-violet-400" />
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Time Saved This Week</span>
                </div>
                <p className="text-2xl font-bold text-white tabular-nums counter-value">
                  {analyticsData.weekHoursSaved}<span className="text-sm text-gray-500 font-normal">h</span>{' '}
                  {analyticsData.weekRemainMin}<span className="text-sm text-gray-500 font-normal">m</span>
                </p>
                <div className="mt-2 space-y-1">
                  <p className="text-[10px] text-gray-600">
                    All-time: <span className="text-gray-400 font-semibold">{analyticsData.totalHoursSaved}h {analyticsData.totalRemainMin}m</span> across {stats.total} reports
                  </p>
                  <p className="text-[10px] text-gray-600">
                    Avg complexity: <span className="text-violet-300 font-semibold">{analyticsData.avgMinPerReport} min</span>/report
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-white/5 text-gray-500">Base 2m</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-400">Vitals ×0.3m</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-400">Dx ×0.5m</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400">Meds ×0.75m</span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400">+Text</span>
                  </div>
                </div>
              </div>

              {/* Gemini API Usage */}
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={14} className="text-amber-400" />
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Gemini API Usage</span>
                </div>
                <p className="text-2xl font-bold text-white tabular-nums counter-value">
                  {analyticsData.totalApiCalls} <span className="text-sm text-gray-500 font-normal">calls</span>
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-gray-600">Today: <span className={`font-bold ${analyticsData.todayApiCalls > 500 ? 'text-red-400' : analyticsData.todayApiCalls > 100 ? 'text-amber-400' : 'text-emerald-400'}`}>{analyticsData.todayApiCalls}</span></span>
                  <span className="text-[10px] text-gray-600">Week: <span className="font-bold text-gray-400">{analyticsData.weekApiCalls}</span></span>
                </div>
                {analyticsData.todayApiCalls > 100 && (
                  <div className={`mt-2 flex items-center gap-1.5 text-[10px] font-bold ${analyticsData.todayApiCalls > 500 ? 'text-red-400' : 'text-amber-400'}`}>
                    <AlertCircle size={10} />
                    {analyticsData.todayApiCalls > 500 ? 'High usage — monitor rate limits!' : 'Moderate usage today'}
                  </div>
                )}
              </div>
            </div>

            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={14} className="text-amber-400" />
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">This Week</span>
              </div>
              <p className="text-2xl font-bold text-white tabular-nums">{stats.week} <span className="text-sm text-gray-500 font-normal">consultations</span></p>
            </div>

            {/* Top Doctors */}
            <div className="glass-card p-5 space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Stethoscope size={14} className="text-indigo-400" /> Top Doctors
              </h3>
              {stats.topDoctors.length === 0 ? (
                <p className="text-sm text-gray-500">No consultations yet</p>
              ) : (
                <div className="space-y-2">
                  {stats.topDoctors.map((d, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                          <span className="text-[10px] font-bold text-indigo-300">{i + 1}</span>
                        </div>
                        <span className="text-sm text-gray-200">Dr. {d.name}</span>
                      </div>
                      <span className="metric-badge bg-indigo-500/10 text-indigo-300 text-[10px] border border-indigo-500/20">{d.count} reports</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Diagnoses */}
            <div className="glass-card p-5 space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Activity size={14} className="text-orange-400" /> Common Diagnoses
              </h3>
              {stats.topDiagnoses.length === 0 ? (
                <p className="text-sm text-gray-500">No diagnoses data yet</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {stats.topDiagnoses.map(([name, count], i) => (
                    <span key={i} className="metric-badge bg-orange-500/10 text-orange-300 text-xs border border-orange-500/20 px-3 py-1.5">
                      {name} <span className="text-orange-400/50 ml-1">×{count}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════ ANALYTICS VIEW ════════════════ */}
        {activeView === 'analytics' && (
          <div className="space-y-5 animate-fade-in-up">
            {/* Consultation Volume Line Chart */}
            <div className="glass-card p-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                <TrendingUp size={14} className="text-amber-400" /> Consultation Volume (14 Days)
              </h3>
              {reports.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-gray-600">
                  <BarChart3 size={32} className="mb-2 opacity-40" />
                  <p className="text-sm">No data to chart yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={analyticsData.consultationVolume} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0.3} />
                      </linearGradient>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="count" stroke="url(#lineGrad)" strokeWidth={2.5} dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#f59e0b', stroke: '#0f0f1a', strokeWidth: 2 }} name="Consultations" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top Prescribed Generics Bar Chart */}
            <div className="glass-card p-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                <Pill size={14} className="text-emerald-400" /> Top Prescribed Generics
              </h3>
              {analyticsData.topMedications.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-gray-600">
                  <Pill size={32} className="mb-2 opacity-40" />
                  <p className="text-sm">No prescriptions recorded yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={analyticsData.topMedications} margin={{ top: 5, right: 10, left: -20, bottom: 5 }} layout="vertical">
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fill: '#d1d5db', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip content={<MedTooltip />} />
                    <Bar dataKey="count" fill="url(#barGrad)" radius={[0, 6, 6, 0]} barSize={18} name="Times Prescribed" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Language Distribution + Heatmap Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Language Distribution Pie Chart */}
              <div className="glass-card p-5">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <Globe size={14} className="text-sky-400" /> Language Distribution
                </h3>
                {analyticsData.languageData.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No data</p>
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
                            <Cell key={i} fill={['#818cf8', '#f472b6', '#34d399'][i % 3]} />
                          ))}
                        </Pie>
                        <Tooltip content={<LangTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="donut-center">
                      <p className="text-lg font-bold text-white">{reports.length}</p>
                      <p className="text-[9px] text-gray-500 uppercase font-bold">Total</p>
                    </div>
                    <div className="flex justify-center gap-4 mt-2">
                      {analyticsData.languageData.map((d, i) => (
                        <div key={d.name} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: ['#818cf8', '#f472b6', '#34d399'][i % 3] }} />
                          <span className="text-[10px] text-gray-400">{d.name} ({d.value})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Doctor Activity Heatmap */}
              <div className="glass-card p-5">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <Activity size={14} className="text-orange-400" /> Activity Heatmap (4 Weeks)
                </h3>
                <div className="space-y-1">
                  {/* Day labels */}
                  <div className="flex gap-1 mb-1 pl-8">
                    {['W1', 'W2', 'W3', 'W4'].map(w => (
                      <span key={w} className="flex-1 text-center text-[8px] text-gray-600 font-bold">{w}</span>
                    ))}
                  </div>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(dayName => {
                    const dayCells = analyticsData.heatmapData.filter(h => h.day === dayName);
                    return (
                      <div key={dayName} className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-600 w-7 text-right font-medium">{dayName.slice(0, 2)}</span>
                        {dayCells.map((cell, i) => {
                          const intensity = cell.count / analyticsData.maxHeatmap;
                          const bgColor = cell.count === 0
                            ? 'rgba(255,255,255,0.03)'
                            : `rgba(245, 158, 11, ${0.15 + intensity * 0.7})`;
                          return (
                            <div
                              key={i}
                              className="heatmap-cell flex-1 aspect-square flex items-center justify-center"
                              style={{ background: bgColor }}
                              title={`${cell.count} consultation${cell.count !== 1 ? 's' : ''}`}
                            >
                              {cell.count > 0 && <span className="text-[8px] font-bold text-white/80">{cell.count}</span>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Recent Activity Feed */}
            <div className="glass-card p-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                <Clock size={14} className="text-cyan-400" /> Recent Activity
              </h3>
              {analyticsData.recentActivity.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
              ) : (
                <div className="space-y-1">
                  {analyticsData.recentActivity.map((item, i) => (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/report/${item.id}`)}
                      className="feed-item flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer"
                      style={{ opacity: 0, animationDelay: `${i * 0.05}s`, animationFillMode: 'forwards' }}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/15 to-blue-500/15 flex items-center justify-center border border-cyan-500/15 shrink-0">
                          <Stethoscope size={14} className="text-cyan-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-gray-200 truncate">
                            <span className="text-indigo-300 font-semibold">Dr. {item.doctorName}</span>
                            <span className="text-gray-500"> → </span>
                            <span className="text-gray-300">{item.patientName || 'Unknown'}</span>
                          </p>
                          <p className="text-[10px] text-gray-600 truncate">{item.complaint}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {item.medsCount > 0 && (
                          <span className="metric-badge bg-emerald-500/10 text-emerald-300 text-[9px] border border-emerald-500/15">
                            {item.medsCount} meds
                          </span>
                        )}
                        <span className="text-[10px] text-gray-600 whitespace-nowrap">{timeAgo(item.time)}</span>
                        <ChevronRight size={12} className="text-gray-700" />
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
          <div className="space-y-3 animate-fade-in-up">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search by name, email, or role…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-200 placeholder:text-gray-600 outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>

            <p className="text-[10px] text-gray-500 px-1">{filteredUsers.length} users found</p>

            {filteredUsers.map(user => (
              <div key={user.id} className="glass-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
                      user.role === 'doctor' ? 'bg-indigo-500/10 border-indigo-500/20' :
                      user.role === 'admin' ? 'bg-amber-500/10 border-amber-500/20' :
                      'bg-teal-500/10 border-teal-500/20'
                    }`}>
                      <span className={`text-sm font-bold ${
                        user.role === 'doctor' ? 'text-indigo-300' :
                        user.role === 'admin' ? 'text-amber-300' :
                        'text-teal-300'
                      }`}>{user.display_name?.charAt(0)?.toUpperCase() || '?'}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{user.display_name}</p>
                      <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`metric-badge text-[10px] border ${
                      user.role === 'doctor' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' :
                      user.role === 'admin' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                      'bg-teal-500/10 text-teal-300 border-teal-500/20'
                    }`}>{user.role}</span>
                    <button onClick={() => handleEditUser(user)} className="p-1.5 text-gray-500 hover:text-amber-400 rounded-lg hover:bg-amber-500/10 transition-colors">
                      <Edit3 size={14} />
                    </button>
                    {deleteConfirm === user.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDeleteUser(user.id)} className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded-lg hover:bg-red-500/20 transition-colors">Delete</button>
                        <button onClick={() => setDeleteConfirm(null)} className="text-[10px] font-bold text-gray-400 bg-white/5 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(user.id)} className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-gray-600">Joined: {formatDate(user.created_at)}</p>
              </div>
            ))}
          </div>
        )}

        {/* ════════════════ CONSULTATIONS VIEW ════════════════ */}
        {activeView === 'consultations' && (
          <div className="space-y-4 animate-fade-in-up">
            {/* Date Picker */}
            <div className="glass-card p-4 flex items-center gap-3">
              <Calendar size={16} className="text-amber-400 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500/50 transition-colors"
              />
              <span className="text-xs text-gray-400 shrink-0">
                {Object.values(consultationsByDoctor).reduce((s, d) => s + d.reports.length, 0)} consultations
              </span>
            </div>

            {Object.keys(consultationsByDoctor).length === 0 ? (
              <div className="glass-card p-8 text-center space-y-3">
                <AlertCircle size={24} className="text-gray-600 mx-auto" />
                <p className="text-gray-400 text-sm">No consultations on this date</p>
              </div>
            ) : (
              Object.entries(consultationsByDoctor).map(([docId, doc]) => (
                <div key={docId} className="glass-card overflow-hidden">
                  <button
                    onClick={() => setExpandedDoctor(expandedDoctor === docId ? null : docId)}
                    className="w-full p-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/20">
                        <Stethoscope size={16} className="text-indigo-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-white">Dr. {doc.name}</p>
                        <p className="text-[11px] text-gray-500">{doc.reports.length} consultation{doc.reports.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {expandedDoctor === docId ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                  </button>
                  {expandedDoctor === docId && (
                    <div className="border-t border-white/5 divide-y divide-white/5">
                      {doc.reports.map(r => (
                        <div
                          key={r.id}
                          onClick={() => navigate(`/report/${r.id}`)}
                          className="p-4 hover:bg-white/[0.03] transition-colors cursor-pointer flex items-center justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-200 font-medium truncate">{r.patient_name || 'Unknown Patient'}</p>
                            <p className="text-xs text-gray-500 truncate">{r.structured_notes?.chief_complaint || 'General consultation'}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <span className="text-[10px] text-gray-600">{new Date(r.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                            <ChevronRight size={14} className="text-gray-600" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ════════════════ PATIENTS VIEW ════════════════ */}
        {activeView === 'patients' && (
          <div className="space-y-3 animate-fade-in-up">
            <p className="text-[10px] text-gray-500 px-1">{patientDatabase.length} patients found</p>

            {patientDatabase.length === 0 ? (
              <div className="glass-card p-8 text-center space-y-3">
                <AlertCircle size={24} className="text-gray-600 mx-auto" />
                <p className="text-gray-400 text-sm">No patients yet</p>
              </div>
            ) : (
              patientDatabase.map((patient, i) => (
                <div key={i} className="glass-card overflow-hidden">
                  <button
                    onClick={() => setExpandedPatient(expandedPatient === patient.name ? null : patient.name)}
                    className="w-full p-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/20 shrink-0">
                        <span className="text-sm font-bold text-emerald-300">{patient.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{patient.name}</p>
                        <p className="text-[11px] text-gray-500">{patient.count} visit{patient.count !== 1 ? 's' : ''} • Last: {formatShortDate(patient.lastVisit)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {patient.email && <span className="text-[10px] text-gray-600 hidden sm:inline">{patient.email}</span>}
                      {expandedPatient === patient.name ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                    </div>
                  </button>
                  {expandedPatient === patient.name && (
                    <div className="border-t border-white/5 divide-y divide-white/5">
                      {patient.reports.map(r => (
                        <div
                          key={r.id}
                          onClick={() => navigate(`/report/${r.id}`)}
                          className="p-4 hover:bg-white/[0.03] transition-colors cursor-pointer flex items-center justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-400">Dr. {r.doctor_name} • {formatDate(r.created_at)}</p>
                            <p className="text-sm text-gray-200 truncate">{r.structured_notes?.chief_complaint || 'General consultation'}</p>
                          </div>
                          <ChevronRight size={14} className="text-gray-600 shrink-0 ml-2" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        <div className="text-center py-4"><p className="text-[10px] text-gray-600">AI Ambient Scribe • Admin Panel</p></div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-card p-6 w-full max-w-sm space-y-5 animate-fade-in-up border border-white/10">
            <h3 className="text-lg font-bold text-white text-center">Edit User</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1 block">Display Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1 block">Role</label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 outline-none focus:border-amber-500/50 transition-colors"
                >
                  <option value="doctor" className="bg-gray-900">Doctor</option>
                  <option value="patient" className="bg-gray-900">Patient</option>
                  <option value="admin" className="bg-gray-900">Admin</option>
                </select>
              </div>
              <p className="text-[10px] text-gray-600">Email: {editingUser.email}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingUser(null)} className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-400 bg-white/5 hover:bg-white/10 transition-colors">Cancel</button>
              <button
                onClick={handleSaveUser}
                disabled={!editName.trim()}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-red-600 shadow-lg shadow-amber-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={14} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-Components ─────────────────────────────── */

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white tabular-nums counter-value">{value}</p>
    </div>
  );
}

/* ── Chart Tooltips ─────────────────────────────── */

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="label">{label}</p>
      <p className="value">{payload[0].value} <span style={{ fontSize: 11, color: '#9ca3af' }}>consultations</span></p>
    </div>
  );
}

function MedTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="label">{payload[0].payload.fullName || payload[0].payload.name}</p>
      <p className="value">{payload[0].value} <span style={{ fontSize: 11, color: '#9ca3af' }}>times prescribed</span></p>
    </div>
  );
}

function LangTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="label">{payload[0].name}</p>
      <p className="value">{payload[0].value} <span style={{ fontSize: 11, color: '#9ca3af' }}>transcripts</span></p>
    </div>
  );
}
