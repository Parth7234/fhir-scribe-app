import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft, Loader2, AlertCircle, FileText, Heart, Thermometer,
  Stethoscope, Pill, Activity, RefreshCw, ClipboardList, Clock,
  ChevronDown, ChevronUp, Download, Share2, Send
} from 'lucide-react';
import PrintablePDFReport from './PrintablePDFReport';
// @ts-ignore
import html2pdf from 'html2pdf.js';

export default function ReportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFhir, setShowFhir] = useState(false);
  const [error, setError] = useState('');

  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  useEffect(() => {
    if (id) fetchReport();
  }, [id]);

  const fetchReport = async () => {
    try {
      const { data, error: err } = await supabase
        .from('reports')
        .select('*')
        .eq('id', id!)
        .single();

      if (err || !data) {
        setError('Report not found.');
      } else {
        setReport({
          id: data.id,
          patientName: data.patient_name,
          doctorName: data.doctor_name,
          transcript: data.transcript,
          structuredNotes: data.structured_notes,
          fhirBundle: data.fhir_bundle,
          createdAt: data.created_at,
        });
      }
    } catch (err) {
      console.error('Failed to fetch report:', err);
      setError('Failed to load report.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    const el = document.getElementById('pdf-print-area');
    if (!el) return;
    html2pdf().set({
      margin: 0,
      filename: `clinical_report_${report?.patientName?.replace(/\s+/g, '_') || id}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(el).save();
  };

  const handleShare = async () => {
    if (!shareEmail.trim() || !id || !userProfile) return;
    setShareLoading(true);
    try {
      const { error } = await supabase.from('shared_reports').insert({
        report_id: id,
        sender_id: userProfile.uid,
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

  const formatDate = (ts: any) => {
    const d = typeof ts === 'string' ? new Date(ts) : ts?.toDate?.() || new Date();
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(d);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-indigo-400" />
    </div>
  );

  if (error || !report) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-card p-8 text-center space-y-3 max-w-sm">
        <AlertCircle size={28} className="text-red-400 mx-auto" />
        <p className="text-red-300 text-sm">{error || 'Report not found.'}</p>
        <button onClick={() => navigate('/dashboard')} className="text-indigo-400 text-sm font-medium hover:text-indigo-300">← Back to Dashboard</button>
      </div>
    </div>
  );

  const notes = report.structuredNotes;

  return (
    <div className="min-h-screen pb-8">
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-black/30 border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button onClick={() => navigate('/dashboard')} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"><ArrowLeft size={18} /></button>
            <div><h1 className="text-sm font-bold text-white tracking-tight">{report.patientName}</h1><p className="text-[10px] text-gray-400 font-medium">{formatDate(report.createdAt)}</p></div>
          </div>
          <div className="flex items-center gap-2">
            {userProfile?.role === 'doctor' && (
              <button
                onClick={() => { setShareEmail(''); setShareMessage(''); setShareSuccess(false); setShareModalOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-teal-300 bg-teal-500/20 rounded-xl hover:bg-teal-500/30 transition-colors"
              >
                <Share2 size={14} /> Share
              </button>
            )}
            <button onClick={handleDownloadPdf} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-300 bg-indigo-500/20 rounded-xl hover:bg-indigo-500/30 transition-colors"><Download size={14} /> PDF</button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
        {/* Meta */}
        <div className="glass-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><Clock size={12} className="text-gray-500" /><span className="text-xs text-gray-400">{formatDate(report.createdAt)}</span></div>
          {report.doctorName && <span className="text-xs text-gray-500">Dr. {report.doctorName}</span>}
        </div>

        {notes && <>
          {notes.chief_complaint && <div className="clinical-section"><div className="flex items-center gap-2 mb-2"><div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center"><AlertCircle size={13} className="text-amber-400" /></div><h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">Chief Complaint</h3></div><p className="text-gray-300 text-sm leading-relaxed">{notes.chief_complaint}</p></div>}

          {notes.history_of_present_illness && <div className="clinical-section"><div className="flex items-center gap-2 mb-2"><div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center"><FileText size={13} className="text-blue-400" /></div><h3 className="text-xs font-bold text-blue-300 uppercase tracking-wider">History of Present Illness</h3></div><p className="text-gray-300 text-sm leading-relaxed">{notes.history_of_present_illness}</p></div>}

          {notes.vitals?.length > 0 && <div className="clinical-section"><div className="flex items-center gap-2 mb-3"><div className="w-6 h-6 rounded-lg bg-rose-500/10 flex items-center justify-center"><Heart size={13} className="text-rose-400" /></div><h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider">Vitals</h3></div><div className="grid grid-cols-2 gap-2">{notes.vitals.map((v:any,i:number) => <div key={i} className="flex items-center gap-2 bg-white/[0.02] rounded-xl p-3 border border-white/5"><Thermometer size={14} className="text-rose-400/60 shrink-0" /><div><p className="text-[10px] text-gray-500 uppercase font-semibold">{v.name}</p><p className="text-sm text-white font-bold">{v.value} <span className="text-gray-500 text-xs">{v.unit}</span></p></div></div>)}</div></div>}

          {notes.examination_findings && <div className="clinical-section"><div className="flex items-center gap-2 mb-2"><div className="w-6 h-6 rounded-lg bg-cyan-500/10 flex items-center justify-center"><Activity size={13} className="text-cyan-400" /></div><h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Examination Findings</h3></div><p className="text-gray-300 text-sm leading-relaxed">{notes.examination_findings}</p></div>}

          {notes.diagnoses?.length > 0 && <div className="clinical-section"><div className="flex items-center gap-2 mb-3"><div className="w-6 h-6 rounded-lg bg-orange-500/10 flex items-center justify-center"><Stethoscope size={13} className="text-orange-400" /></div><h3 className="text-xs font-bold text-orange-300 uppercase tracking-wider">Diagnoses</h3></div><div className="space-y-2">{notes.diagnoses.map((dx:any,i:number) => <div key={i} className="flex items-center justify-between bg-white/[0.02] rounded-xl p-3 border border-white/5"><div className="flex items-center gap-2 flex-1"><div className={`w-2 h-2 rounded-full shrink-0 ${dx.severity?.toLowerCase()==='severe'?'bg-red-400':dx.severity?.toLowerCase()==='moderate'?'bg-yellow-400':'bg-green-400'}`} /><span className="text-sm text-gray-200">{dx.name}</span></div>{dx.icd_code && <span className="metric-badge bg-orange-500/10 text-orange-300 text-[10px] border border-orange-500/20 ml-2">{dx.icd_code}</span>}</div>)}</div></div>}

          {notes.medications?.length > 0 && <div className="clinical-section"><div className="flex items-center gap-2 mb-3"><div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Pill size={13} className="text-emerald-400" /></div><h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Medications</h3></div><div className="space-y-2">{notes.medications.map((m:any,i:number) => <div key={i} className="bg-white/[0.02] rounded-xl p-3 border border-white/5"><p className="text-sm text-white font-semibold">{m.name}</p><div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">{m.dosage && <span className="text-[11px] text-gray-400">{m.dosage}</span>}{m.frequency && <span className="text-[11px] text-emerald-400/70">• {m.frequency}</span>}{m.duration && <span className="text-[11px] text-purple-400/70">• {m.duration}</span>}{m.route && <span className="text-[11px] text-cyan-400/70">• {m.route}</span>}</div></div>)}</div></div>}

          {notes.follow_up && <div className="clinical-section"><div className="flex items-center gap-2 mb-2"><div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center"><RefreshCw size={13} className="text-indigo-400" /></div><h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Follow-up</h3></div><p className="text-gray-300 text-sm leading-relaxed">{notes.follow_up}</p></div>}

          {notes.advice && <div className="clinical-section"><div className="flex items-center gap-2 mb-2"><div className="w-6 h-6 rounded-lg bg-teal-500/10 flex items-center justify-center"><ClipboardList size={13} className="text-teal-400" /></div><h3 className="text-xs font-bold text-teal-300 uppercase tracking-wider">Advice</h3></div><p className="text-gray-300 text-sm leading-relaxed">{notes.advice}</p></div>}
        </>}

        {/* Transcript */}
        {report.transcript && <div className="glass-card p-5 space-y-3"><h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><FileText size={14} className="text-indigo-400" />Transcript</h2><p className="text-gray-300 leading-relaxed text-sm">{report.transcript}</p></div>}

        {/* FHIR JSON */}
        {report.fhirBundle && <div>
          <button onClick={() => setShowFhir(!showFhir)} className="w-full glass-card p-4 flex items-center justify-between hover:bg-white/[0.06] transition-colors">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Stethoscope size={14} className="text-purple-400" />FHIR R4 Bundle</h2>
            {showFhir ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
          </button>
          {showFhir && <div className="glass-card mt-1 p-0.5 rounded-t-none border-t-0"><div className="fhir-json-viewer"><pre className="text-emerald-300/90 whitespace-pre-wrap break-words">{JSON.stringify(report.fhirBundle, null, 2)}</pre></div></div>}
        </div>}
      </div>

      {/* Hidden printable report for PDF */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <PrintablePDFReport report={report} />
      </div>

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-card p-6 w-full max-w-sm space-y-5 animate-fade-in-up border border-white/10">
            <h3 className="text-lg font-bold text-white text-center">Share Report</h3>
            <p className="text-xs text-gray-400 text-center">Send this report to another doctor</p>
            {shareSuccess ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <Send size={28} className="text-teal-400" />
                <p className="text-teal-300 font-medium text-sm">Report shared successfully!</p>
              </div>
            ) : (
              <div className="space-y-3">
                <input type="email" placeholder="Recipient doctor's email *" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder:text-gray-600 outline-none focus:border-teal-500/50 transition-colors" />
                <textarea placeholder="Optional message..." value={shareMessage} onChange={(e) => setShareMessage(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder:text-gray-600 outline-none focus:border-teal-500/50 transition-colors min-h-[80px] resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => setShareModalOpen(false)} className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-400 bg-white/5 hover:bg-white/10 transition-colors">Cancel</button>
                  <button onClick={handleShare} disabled={!shareEmail.trim() || shareLoading} className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-teal-500 to-emerald-600 shadow-lg shadow-teal-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50">
                    {shareLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {shareLoading ? 'Sharing...' : 'Share'}
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
