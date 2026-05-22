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
import { downloadPdf } from '../utils/pdfDownload';

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
    const filename = `clinical_report_${report?.patientName?.replace(/\s+/g, '_') || id}.pdf`;
    downloadPdf('pdf-print-area', filename);
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
    <div className="min-h-screen bg-[#F9F9F9] pb-12">
      {/* Premium Glassmorphic Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-[#56642b]/10 shadow-[0_1px_4px_rgba(86,100,43,0.05)]">
        <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/dashboard')} 
              className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-all"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-sm font-extrabold text-gray-800 tracking-tight">{report.patientName}</h1>
              <p className="text-[10px] text-[#7c5637] font-bold mt-0.5">{formatDate(report.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {userProfile?.role === 'doctor' && (
              <button
                onClick={() => { setShareEmail(''); setShareMessage(''); setShareSuccess(false); setShareModalOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-secondary bg-secondary/15 rounded-xl hover:bg-secondary/25 transition-colors border border-secondary/10"
              >
                <Share2 size={14} /> Share
              </button>
            )}
            <button 
              onClick={handleDownloadPdf} 
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-primary bg-primary/15 rounded-xl hover:bg-primary/25 transition-colors border border-primary/10"
            >
              <Download size={14} /> PDF
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
        {/* Meta Info Block */}
        <div className="bg-white border border-[#56642b]/10 rounded-2xl p-4.5 flex items-center justify-between shadow-[0px_4px_20px_rgba(138,154,91,0.04)]">
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-[#7c5637]" />
            <span className="text-xs text-gray-500 font-semibold">{formatDate(report.createdAt)}</span>
          </div>
          {report.doctorName && (
            <span className="text-xs text-[#56642b] font-bold bg-[#f4f6f0] px-2.5 py-1 rounded-lg border border-[#d3dcd0]">
              Dr. {report.doctorName}
            </span>
          )}
        </div>

        {notes && (
          <>
            {/* Chief Complaint */}
            {notes.chief_complaint && (
              <div className="bg-white border border-[#56642b]/10 rounded-2xl p-5 shadow-[0px_4px_20px_rgba(138,154,91,0.04)] space-y-3">
                <div className="flex items-center gap-2.5 pb-2 border-b border-amber-500/10">
                  <div className="w-7 h-7 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <AlertCircle size={14} />
                  </div>
                  <h3 className="text-xs font-extrabold text-amber-800 uppercase tracking-wider">Chief Complaint</h3>
                </div>
                <p className="text-gray-800 text-sm leading-relaxed font-semibold">{notes.chief_complaint}</p>
              </div>
            )}

            {/* History of Present Illness */}
            {notes.history_of_present_illness && (
              <div className="bg-white border border-[#56642b]/10 rounded-2xl p-5 shadow-[0px_4px_20px_rgba(138,154,91,0.04)] space-y-3">
                <div className="flex items-center gap-2.5 pb-2 border-b border-blue-500/10">
                  <div className="w-7 h-7 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                    <FileText size={14} />
                  </div>
                  <h3 className="text-xs font-extrabold text-blue-800 uppercase tracking-wider">History of Present Illness</h3>
                </div>
                <p className="text-gray-800 text-sm leading-relaxed font-semibold">{notes.history_of_present_illness}</p>
              </div>
            )}

            {/* Vitals */}
            {notes.vitals?.length > 0 && (
              <div className="bg-white border border-[#56642b]/10 rounded-2xl p-5 shadow-[0px_4px_20px_rgba(138,154,91,0.04)] space-y-3.5">
                <div className="flex items-center gap-2.5 pb-1">
                  <div className="w-7 h-7 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600">
                    <Heart size={14} />
                  </div>
                  <h3 className="text-xs font-extrabold text-rose-800 uppercase tracking-wider">Vitals</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {notes.vitals.map((v: any, i: number) => (
                    <div 
                      key={i} 
                      className="flex items-center gap-3 bg-[#fdf8f4] border border-[#f5e6da] rounded-xl p-3.5 hover:scale-[1.02] transition-transform"
                    >
                      <Thermometer size={16} className="text-rose-500/70 shrink-0" />
                      <div>
                        <p className="text-[9px] text-[#7c5637] uppercase font-black tracking-wider">{v.name}</p>
                        <p className="text-base text-gray-800 font-black mt-0.5">
                          {v.value} <span className="text-gray-500 text-xs font-bold">{v.unit}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Examination Findings */}
            {notes.examination_findings && (
              <div className="bg-white border border-[#56642b]/10 rounded-2xl p-5 shadow-[0px_4px_20px_rgba(138,154,91,0.04)] space-y-3">
                <div className="flex items-center gap-2.5 pb-2 border-b border-cyan-500/10">
                  <div className="w-7 h-7 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-600">
                    <Activity size={14} />
                  </div>
                  <h3 className="text-xs font-extrabold text-cyan-800 uppercase tracking-wider">Examination Findings</h3>
                </div>
                <p className="text-gray-800 text-sm leading-relaxed font-semibold">{notes.examination_findings}</p>
              </div>
            )}

            {/* Diagnoses */}
            {notes.diagnoses?.length > 0 && (
              <div className="bg-white border border-[#56642b]/10 rounded-2xl p-5 shadow-[0px_4px_20px_rgba(138,154,91,0.04)] space-y-3.5">
                <div className="flex items-center gap-2.5 pb-1">
                  <div className="w-7 h-7 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                    <Stethoscope size={14} />
                  </div>
                  <h3 className="text-xs font-extrabold text-orange-800 uppercase tracking-wider">Diagnoses</h3>
                </div>
                <div className="space-y-2.5">
                  {notes.diagnoses.map((dx: any, i: number) => (
                    <div 
                      key={i} 
                      className="flex items-center justify-between bg-[#fdf8f4] border border-[#f5e6da] rounded-xl p-3.5 hover:scale-[1.01] transition-transform"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white ${dx.severity?.toLowerCase() === 'severe' ? 'bg-red-500' : dx.severity?.toLowerCase() === 'moderate' ? 'bg-amber-500' : 'bg-green-500'}`} />
                        <span className="text-sm text-gray-800 font-bold truncate">{dx.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {dx.icd_code && (
                          <span className="bg-[#fdf8f4] text-[#7c5637] border border-[#e9c4a6] text-[10px] px-2.5 py-1 rounded-lg font-bold shadow-sm">
                            {dx.icd_code}
                          </span>
                        )}
                        {dx.severity && (
                          <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-1 rounded-lg ${dx.severity.toLowerCase() === 'severe' ? 'text-red-700 bg-red-100' : dx.severity.toLowerCase() === 'moderate' ? 'text-amber-700 bg-amber-100' : 'text-green-700 bg-green-100'}`}>
                            {dx.severity}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Medications */}
            {notes.medications?.length > 0 && (
              <div className="bg-white border border-[#56642b]/10 rounded-2xl p-5 shadow-[0px_4px_20px_rgba(138,154,91,0.04)] space-y-3.5">
                <div className="flex items-center gap-2.5 pb-1">
                  <div className="w-7 h-7 rounded-xl bg-[#f4f6f0] flex items-center justify-center text-[#56642b]">
                    <Pill size={14} />
                  </div>
                  <h3 className="text-xs font-extrabold text-[#56642b] uppercase tracking-wider">Medications</h3>
                </div>
                <div className="space-y-3">
                  {notes.medications.map((m: any, i: number) => (
                    <div 
                      key={i} 
                      className="bg-[#f4f6f0] border border-[#d3dcd0] rounded-xl p-4 flex flex-col hover:scale-[1.01] transition-transform"
                    >
                      <p className="text-base text-[#56642b] font-black">{m.name}</p>
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        {m.dosage && (
                          <span className="bg-white border border-[#d3dcd0] text-gray-800 px-2 py-1 rounded-lg text-[10px] font-bold">
                            {m.dosage}
                          </span>
                        )}
                        {m.frequency && (
                          <span className="bg-[#56642b]/15 text-[#56642b] px-2.5 py-1 rounded-lg text-[10px] font-extrabold">
                            {m.frequency}
                          </span>
                        )}
                        {m.duration && (
                          <span className="bg-[#fdf8f4] border border-[#f5e6da] text-[#7c5637] px-2.5 py-1 rounded-lg text-[10px] font-extrabold">
                            {m.duration}
                          </span>
                        )}
                        {m.route && (
                          <span className="bg-cyan-50 border border-cyan-100 text-cyan-800 px-2 py-1 rounded-lg text-[10px] font-bold">
                            {m.route}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Follow-up */}
            {notes.follow_up && (
              <div className="bg-white border border-[#56642b]/10 rounded-2xl p-5 shadow-[0px_4px_20px_rgba(138,154,91,0.04)] space-y-3">
                <div className="flex items-center gap-2.5 pb-2 border-b border-indigo-500/10">
                  <div className="w-7 h-7 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                    <RefreshCw size={14} />
                  </div>
                  <h3 className="text-xs font-extrabold text-indigo-800 uppercase tracking-wider">Follow-up</h3>
                </div>
                <p className="text-gray-800 text-sm leading-relaxed font-semibold">{notes.follow_up}</p>
              </div>
            )}

            {/* Advice */}
            {notes.advice && (
              <div className="bg-white border border-[#56642b]/10 rounded-2xl p-5 shadow-[0px_4px_20px_rgba(138,154,91,0.04)] space-y-3">
                <div className="flex items-center gap-2.5 pb-2 border-b border-teal-500/10">
                  <div className="w-7 h-7 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600">
                    <ClipboardList size={14} />
                  </div>
                  <h3 className="text-xs font-extrabold text-teal-800 uppercase tracking-wider">Advice</h3>
                </div>
                <p className="text-gray-800 text-sm leading-relaxed font-semibold">{notes.advice}</p>
              </div>
            )}
          </>
        )}

        {/* Transcript */}
        {report.transcript && (
          <div className="bg-white border border-[#56642b]/10 p-5 rounded-2xl shadow-[0px_4px_20px_rgba(138,154,91,0.04)] space-y-3">
            <h2 className="text-xs font-extrabold text-[#7c5637] uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-[#56642b]/5">
              <FileText size={14} className="text-[#7c5637]" />
              Consultation Transcript
            </h2>
            <div className="text-gray-800 leading-relaxed text-sm bg-gray-50 border border-gray-100 rounded-xl p-4 max-h-[250px] overflow-y-auto whitespace-pre-line font-semibold">
              {report.transcript}
            </div>
          </div>
        )}

        {/* FHIR JSON */}
        {report.fhirBundle && (
          <div className="space-y-1">
            <button 
              onClick={() => setShowFhir(!showFhir)} 
              className="w-full bg-white border border-[#56642b]/10 p-4 rounded-2xl flex items-center justify-between hover:bg-[#f4f6f0] transition-colors shadow-[0px_4px_20px_rgba(138,154,91,0.04)]"
            >
              <h2 className="text-xs font-extrabold text-[#56642b] uppercase tracking-wider flex items-center gap-2">
                <Stethoscope size={14} className="text-[#56642b]" />
                FHIR R4 Bundle
              </h2>
              {showFhir ? <ChevronUp size={16} className="text-[#56642b]" /> : <ChevronDown size={16} className="text-[#56642b]" />}
            </button>
            {showFhir && (
              <div className="bg-[#1e1e1e] p-4 rounded-2xl border border-black font-mono text-emerald-400 text-xs overflow-x-auto shadow-inner mt-1.5 max-h-[400px]">
                <pre className="whitespace-pre-wrap break-words">{JSON.stringify(report.fhirBundle, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hidden printable report for PDF */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <PrintablePDFReport report={report} />
      </div>

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white border border-[#56642b]/10 p-6 w-full max-w-sm space-y-5 rounded-2xl shadow-2xl animate-fade-in-up">
            <h3 className="text-lg font-black text-gray-800 text-center">Share Report</h3>
            <p className="text-xs text-[#7c5637] font-semibold text-center">Send this report to another medical practitioner</p>
            {shareSuccess ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <Send size={28} className="text-[#56642b]" />
                <p className="text-[#56642b] font-black text-sm">Report shared successfully!</p>
              </div>
            ) : (
              <div className="space-y-3">
                <input 
                  type="email" 
                  placeholder="Recipient doctor's email *" 
                  value={shareEmail} 
                  onChange={(e) => setShareEmail(e.target.value)} 
                  className="w-full bg-[#f4f6f0] border border-[#d3dcd0] rounded-xl px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-[#56642b] focus:bg-white transition-all font-semibold" 
                />
                <textarea 
                  placeholder="Optional message..." 
                  value={shareMessage} 
                  onChange={(e) => setShareMessage(e.target.value)} 
                  className="w-full bg-[#f4f6f0] border border-[#d3dcd0] rounded-xl px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-[#56642b] focus:bg-white transition-all min-h-[80px] resize-none font-semibold" 
                />
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShareModalOpen(false)} 
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleShare} 
                    disabled={!shareEmail.trim() || shareLoading} 
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-primary shadow-md shadow-primary/20 hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
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
