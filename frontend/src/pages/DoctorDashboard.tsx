import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Stethoscope, LogOut, Plus, Users, FileText, Clock,
  ChevronRight, Loader2, AlertCircle
} from 'lucide-react';

interface Report {
  id: string;
  patientName: string;
  patientEmail?: string;
  chiefComplaint: string;
  createdAt: any;
  language: string;
}

interface PatientSummary {
  name: string;
  email?: string;
  reportCount: number;
  lastVisit: Date;
}

export default function DoctorDashboard() {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'patients' | 'reports'>('patients');

  useEffect(() => {
    fetchReports();
  }, [userProfile]);

  const fetchReports = async () => {
    if (!userProfile) return;
    try {
      const q = query(
        collection(db, 'reports'),
        where('doctorId', '==', userProfile.uid)
      );
      const snapshot = await getDocs(q);
      const fetchedReports: Report[] = [];
      const patientMap = new Map<string, PatientSummary>();

      snapshot.forEach((doc) => {
        const data = doc.data();
        const report: Report = {
          id: doc.id,
          patientName: data.patientName || 'Unknown',
          patientEmail: data.patientEmail,
          chiefComplaint: data.structuredNotes?.chief_complaint || 'General consultation',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          language: data.language || 'en',
        };
        fetchedReports.push(report);

        // Aggregate patient info
        const key = data.patientName?.toLowerCase() || 'unknown';
        const existing = patientMap.get(key);
        if (existing) {
          existing.reportCount++;
          if (report.createdAt > existing.lastVisit) {
            existing.lastVisit = report.createdAt;
          }
        } else {
          patientMap.set(key, {
            name: data.patientName || 'Unknown',
            email: data.patientEmail,
            reportCount: 1,
            lastVisit: report.createdAt,
          });
        }
      });

      // Sort client-side (newest first)
      fetchedReports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      setReports(fetchedReports);
      setPatients(Array.from(patientMap.values()));
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
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
              <p className="text-[10px] text-gray-400 font-medium">Doctor Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="new-consultation-btn"
              onClick={() => navigate('/scribe')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all active:scale-95"
            >
              <Plus size={14} />
              New Consultation
            </button>
            <button
              id="logout-btn"
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-5">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users size={14} className="text-indigo-400" />
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Total Patients</span>
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">{patients.length}</p>
          </div>
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={14} className="text-purple-400" />
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Total Reports</span>
            </div>
            <p className="text-2xl font-bold text-white tabular-nums">{reports.length}</p>
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
            My Patients
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
            All Reports
          </button>
        </div>

        {loading ? (
          <div className="glass-card p-8 flex flex-col items-center justify-center gap-3">
            <Loader2 size={24} className="animate-spin text-indigo-400" />
            <p className="text-sm text-gray-400">Loading your data...</p>
          </div>
        ) : activeView === 'patients' ? (
          /* Patients List */
          <div className="space-y-2">
            {patients.length === 0 ? (
              <div className="glass-card p-8 text-center space-y-3">
                <AlertCircle size={24} className="text-gray-600 mx-auto" />
                <p className="text-gray-400 text-sm">No patients yet.</p>
                <p className="text-gray-600 text-xs">Start a new consultation to add your first patient.</p>
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
        ) : (
          /* Reports List */
          <div className="space-y-2">
            {reports.length === 0 ? (
              <div className="glass-card p-8 text-center space-y-3">
                <AlertCircle size={24} className="text-gray-600 mx-auto" />
                <p className="text-gray-400 text-sm">No reports yet.</p>
                <p className="text-gray-600 text-xs">Record a consultation to create your first report.</p>
              </div>
            ) : (
              reports.map((report) => (
                <div
                  key={report.id}
                  onClick={() => navigate(`/report/${report.id}`)}
                  className="glass-card p-4 hover:bg-white/[0.06] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-white">{report.patientName}</p>
                    <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-1">{report.chiefComplaint}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Clock size={10} className="text-gray-600" />
                    <span className="text-[10px] text-gray-600">{formatDate(report.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
