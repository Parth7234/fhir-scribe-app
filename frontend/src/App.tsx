import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Mic, Square, Loader2, FileText, Stethoscope, Activity,
  Pill, ChevronDown, ChevronUp, Clock, Zap, Languages,
  AlertCircle, Heart, Thermometer, ClipboardList, RefreshCw,
  CheckCircle2, XCircle, Shield, Edit3, Save, Download
} from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const DEMO_SCRIPTS = [
  {
    id: 'fever',
    title: 'Viral Fever (Hinglish)',
    text: 'Doctor: Hello Rohan, kya takleef ho rahi hai aapko?\nPatient: Doctor sahab, kal raat se bahut tez bukhar hai aur khasi bhi aa rahi hai.\nDoctor: Bukhar check kiya tha kitna hai?\nPatient: Haan, subah 102 tha.\nDoctor: Thik hai, main Dolo 650 likh raha hu, din me 3 baar khana aaram tbtk na mile. Aur Cofsils ki goli chuste rehna khasi ke liye. 3 din baad wapas dikhana.'
  },
  {
    id: 'diabetes',
    title: 'Diabetes Follow-up (English)',
    text: 'Doctor: Good morning Mrs. Sharma. How are your sugar levels?\nPatient: Good morning doctor. My fasting sugar was 110 today.\nDoctor: That is excellent. Are you taking the Metformin 500mg regularly?\nPatient: Yes, twice a day after meals as you told me.\nDoctor: Let\'s continue the same dosage. I want to see you again in 3 months with a fresh HbA1c report.'
  },
  {
    id: 'bp',
    title: 'Hypertension Check (Hindi)',
    text: 'Doctor: Namaste pitaji, blood pressure kaisa chal raha hai?\nPatient: Namaste doctor. Thoda chakkar aa raha tha kal se.\nDoctor: Dekhiye apka BP 150/90 hai, thoda zyada hai. Tel aur namak kam khayiye. Main Amlodipine 5mg ki roz subah ki goli shuru kar raha hu. Ek hafte baad aakar BP dubara check karwayein.'
  }
];

interface StructuredNotes {
  chief_complaint: string;
  history_of_present_illness: string;
  vitals: Array<{ name: string; value: string; unit: string }>;
  examination_findings: string;
  diagnoses: Array<{ name: string; icd_code: string; severity: string }>;
  medications: Array<{ name: string; dosage: string; frequency: string; duration: string; route: string }>;
  follow_up: string;
  advice: string;
}

interface ValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  resource_summary: Record<string, number>;
  total_entries: number;
}

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [fhirData, setFhirData] = useState<any>(null);
  const [structuredNotes, setStructuredNotes] = useState<StructuredNotes | null>(null);
  const [editedNotes, setEditedNotes] = useState<StructuredNotes | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessingFhir, setIsProcessingFhir] = useState(false);
  const [, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('hi-en');
  const [showFhirJson, setShowFhirJson] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcriptionTimeMs, setTranscriptionTimeMs] = useState(0);
  const [fhirTimeMs, setFhirTimeMs] = useState(0);
  const [selectedDemo, setSelectedDemo] = useState(DEMO_SCRIPTS[0].text);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        await handleTranscription(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      audioChunksRef.current = [];
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setError('');
      setTranscript('');
      setFhirData(null);
      setStructuredNotes(null);
      setEditedNotes(null);
      setIsEditing(false);
      setValidationResult(null);
      setTranscriptionTimeMs(0);
      setFhirTimeMs(0);
    } catch {
      setError('Could not access microphone. Please allow microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTranscription = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');

    try {
      const response = await axios.post(
        `${API_BASE_URL}/transcribe/?language=${language}`,
        formData
      );
      const transcriptText = response.data.transcript;
      setTranscript(transcriptText);
      setTranscriptionTimeMs(response.data.transcription_time_ms || 0);
      handleFhirProcessing(transcriptText);
    } catch {
      setError('Failed to transcribe audio. Please check if the backend is running.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleFhirProcessing = async (text: string, isDemo = false) => {
    setIsProcessingFhir(true);
    if (isDemo) {
      setTranscript(text);
      setTranscriptionTimeMs(150); // Fake rapid transcription time for demo
    }
    
    try {
      const response = await axios.post(`${API_BASE_URL}/fhir/`, { transcript: text });
      setFhirData(response.data.fhir_bundle);
      setStructuredNotes(response.data.structured_notes);
      setEditedNotes(response.data.structured_notes);
      setIsEditing(false);
      setFhirTimeMs(response.data.total_processing_time_ms || 0);

      // Auto-validate
      if (response.data.fhir_bundle) {
        handleValidation(response.data.fhir_bundle);
      }
    } catch {
      setError('Failed to extract clinical entities. Please try again.');
    } finally {
      setIsProcessingFhir(false);
    }
  };

  const handleValidation = useCallback(async (bundle: any) => {
    setIsValidating(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/fhir/validate`, { bundle });
      setValidationResult(response.data);
    } catch {
      console.error('Validation failed');
    } finally {
      setIsValidating(false);
    }
  }, []);

  const handleDownloadPdf = () => {
    const element = document.getElementById('clinical-notes-print-area');
    if (!element) return;

    const opt = {
      margin: 15,
      filename: 'prescription_ai_scribe.pdf',
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };

    html2pdf().set(opt).from(element).save();
  };

  const totalTimeMs = transcriptionTimeMs + fhirTimeMs;

  return (
    <div className="min-h-screen pb-8">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-black/30 border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Stethoscope size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">AI Ambient Scribe</h1>
              <p className="text-[10px] text-gray-400 font-medium">FHIR R4 Clinical Notes</p>
            </div>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-1.5">
            <Languages size={14} className="text-gray-400" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="custom-select bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500/50 transition-colors"
              id="language-selector"
            >
              <option value="hi-en">Hinglish</option>
              <option value="hi">Hindi</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">

        {/* === Recording Section === */}
        <div className="glass-card p-8 flex flex-col items-center space-y-5">
          <button
            id="record-button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`recording-btn w-24 h-24 rounded-full flex justify-center items-center transition-all duration-300 transform hover:scale-105 active:scale-95 ${
              isRecording
                ? 'is-recording bg-gradient-to-br from-red-500 to-rose-600'
                : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40'
            }`}
          >
            {isRecording
              ? <Square fill="currentColor" className="text-white" size={28} />
              : <Mic className="text-white" size={32} />
            }
          </button>

          {isRecording ? (
            <div className="text-center space-y-2">
              <p className="text-red-400 font-semibold text-sm">Recording Conversation</p>
              <div className="flex items-center justify-center gap-2">
                <div className="flex items-center gap-0.5 h-8">
                  {[...Array(7)].map((_, i) => (
                    <div
                      key={i}
                      className="waveform-bar bg-red-400/80"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <span className="text-red-400 font-mono text-lg font-bold tabular-nums">
                  {formatTime(recordingTime)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm font-medium">Tap to record consultation</p>
          )}

          {/* Demo Actions */}
          {!isRecording && !isTranscribing && !isProcessingFhir && (
            <div className="w-full mt-6 pt-5 border-t border-white/5 flex flex-col gap-3">
              <p className="text-center text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Or Try a Demo Conversation</p>
              <select
                value={selectedDemo}
                onChange={(e) => setSelectedDemo(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50 transition-colors"
              >
                {DEMO_SCRIPTS.map(script => (
                  <option key={script.id} value={script.text} className="bg-gray-900">{script.title}</option>
                ))}
              </select>
              <button
                onClick={() => handleFhirProcessing(selectedDemo, true)}
                className="w-full bg-white/[0.05] hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 group"
              >
                <Zap size={16} className="text-yellow-400 group-hover:scale-110 transition-transform" />
                Run Demo Script
              </button>
            </div>
          )}
        </div>

        {/* === Error Display === */}
        {error && (
          <div className="animate-fade-in-up flex items-start gap-3 glass-card p-4 border-red-500/20 bg-red-500/5">
            <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-300 text-sm font-medium">{error}</p>
            </div>
            <button onClick={() => setError('')} className="text-red-400/50 hover:text-red-400">
              <XCircle size={16} />
            </button>
          </div>
        )}

        {/* === Transcribing Loading State === */}
        {isTranscribing && (
          <div className="glass-card p-5 animate-fade-in-up">
            <div className="flex items-center gap-3">
              <Loader2 className="animate-spin text-indigo-400" size={20} />
              <div>
                <p className="text-indigo-300 font-semibold text-sm">Transcribing with Gemini...</p>
                <p className="text-gray-500 text-xs">Processing audio to text</p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <div className="loading-shimmer h-3 w-full" />
              <div className="loading-shimmer h-3 w-4/5" />
              <div className="loading-shimmer h-3 w-3/5" />
            </div>
          </div>
        )}

        {/* === Transcript Display === */}
        {transcript && (
          <div className="glass-card p-5 space-y-3 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <FileText size={14} className="text-indigo-400" />
                Transcript
              </h2>
              {transcriptionTimeMs > 0 && (
                <span className="metric-badge bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  <Zap size={10} /> {(transcriptionTimeMs / 1000).toFixed(1)}s
                </span>
              )}
            </div>
            <p className="text-gray-300 leading-relaxed text-sm">{transcript}</p>
          </div>
        )}

        {/* === FHIR Processing Loading === */}
        {isProcessingFhir && (
          <div className="glass-card p-5 animate-fade-in-up">
            <div className="flex items-center gap-3">
              <Loader2 className="animate-spin text-purple-400" size={20} />
              <div>
                <p className="text-purple-300 font-semibold text-sm">Extracting Clinical Entities...</p>
                <p className="text-gray-500 text-xs">Generating FHIR R4 Bundle & Structured Notes</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="loading-shimmer h-20 rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* === Structured Clinical Notes === */}
        {structuredNotes && editedNotes && (
          <div className="space-y-3 animate-fade-in-up">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <ClipboardList size={14} className="text-emerald-400" />
                Structured Clinical Notes
              </h2>
              <div className="flex gap-2">
                {isEditing ? (
                  <button onClick={() => { setStructuredNotes(editedNotes); setIsEditing(false); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/20 rounded-md transition-colors hover:bg-emerald-500/30">
                    <Save size={14} /> Save Edits
                  </button>
                ) : (
                  <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-300 bg-white/5 rounded-md hover:bg-white/10 transition-colors">
                    <Edit3 size={14} /> Edit
                  </button>
                )}
                {!isEditing && (
                  <button onClick={handleDownloadPdf} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-300 bg-indigo-500/20 rounded-md hover:bg-indigo-500/30 transition-colors">
                    <Download size={14} /> PDF
                  </button>
                )}
              </div>
            </div>

            <div id="clinical-notes-print-area" className="space-y-3 bg-[#0f0f1a] p-2 rounded-xl">

            {/* Chief Complaint */}
            {editedNotes.chief_complaint && (
              <div className="clinical-section">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center pt-pr">
                    <AlertCircle size={13} className="text-amber-400" />
                  </div>
                  <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">Chief Complaint</h3>
                </div>
                {isEditing ? (
                  <textarea className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-gray-200 outline-none focus:border-amber-500/50 min-h-[80px]" value={editedNotes.chief_complaint} onChange={(e) => setEditedNotes({...editedNotes, chief_complaint: e.target.value})} />
                ) : (
                  <p className="text-gray-300 text-sm leading-relaxed">{structuredNotes.chief_complaint}</p>
                )}
              </div>
            )}

            {/* HPI */}
            {editedNotes.history_of_present_illness && (
              <div className="clinical-section">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center pt-pr">
                    <FileText size={13} className="text-blue-400" />
                  </div>
                  <h3 className="text-xs font-bold text-blue-300 uppercase tracking-wider">History of Present Illness</h3>
                </div>
                {isEditing ? (
                  <textarea className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-gray-200 outline-none focus:border-blue-500/50 min-h-[100px]" value={editedNotes.history_of_present_illness} onChange={(e) => setEditedNotes({...editedNotes, history_of_present_illness: e.target.value})} />
                ) : (
                  <p className="text-gray-300 text-sm leading-relaxed">{structuredNotes.history_of_present_illness}</p>
                )}
              </div>
            )}

            {/* Vitals */}
            {editedNotes.vitals && editedNotes.vitals.length > 0 && (
              <div className="clinical-section">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-rose-500/10 flex items-center justify-center">
                    <Heart size={13} className="text-rose-400" />
                  </div>
                  <h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider">Vitals</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {editedNotes.vitals.map((vital, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white/[0.02] rounded-xl p-3 border border-white/5">
                      <Thermometer size={14} className="text-rose-400/60 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold truncate">{vital.name}</p>
                        <p className="text-sm text-white font-bold">{vital.value} <span className="text-gray-500 text-xs font-normal">{vital.unit}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Examination Findings */}
            {editedNotes.examination_findings && (
              <div className="clinical-section">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/10 flex items-center justify-center pt-pr">
                    <Activity size={13} className="text-cyan-400" />
                  </div>
                  <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Examination Findings</h3>
                </div>
                {isEditing ? (
                  <textarea className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-gray-200 outline-none focus:border-cyan-500/50 min-h-[80px]" value={editedNotes.examination_findings} onChange={(e) => setEditedNotes({...editedNotes, examination_findings: e.target.value})} />
                ) : (
                  <p className="text-gray-300 text-sm leading-relaxed">{structuredNotes.examination_findings}</p>
                )}
              </div>
            )}

            {/* Diagnoses */}
            {editedNotes.diagnoses && editedNotes.diagnoses.length > 0 && (
              <div className="clinical-section">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Stethoscope size={13} className="text-orange-400" />
                  </div>
                  <h3 className="text-xs font-bold text-orange-300 uppercase tracking-wider">Diagnoses</h3>
                </div>
                <div className="space-y-2">
                  {editedNotes.diagnoses.map((dx, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/[0.02] rounded-xl p-3 border border-white/5 break-inside-avoid">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          dx.severity?.toLowerCase() === 'severe' ? 'bg-red-400' :
                          dx.severity?.toLowerCase() === 'moderate' ? 'bg-yellow-400' :
                          'bg-green-400'
                        }`} />
                        <span className="text-sm text-gray-200 truncate">{dx.name}</span>
                      </div>
                      {dx.icd_code && (
                        <span className="metric-badge bg-orange-500/10 text-orange-300 text-[10px] border border-orange-500/20 shrink-0 ml-2">
                          {dx.icd_code}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Medications */}
            {editedNotes.medications && editedNotes.medications.length > 0 && (
              <div className="clinical-section">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Pill size={13} className="text-emerald-400" />
                  </div>
                  <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Medications</h3>
                </div>
                <div className="space-y-2">
                  {editedNotes.medications.map((med, i) => (
                    <div key={i} className="bg-white/[0.02] rounded-xl p-3 border border-white/5 break-inside-avoid">
                      <p className="text-sm text-white font-semibold">{med.name}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                        {med.dosage && <span className="text-[11px] text-gray-400">{med.dosage}</span>}
                        {med.frequency && <span className="text-[11px] text-emerald-400/70">• {med.frequency}</span>}
                        {med.duration && <span className="text-[11px] text-purple-400/70">• {med.duration}</span>}
                        {med.route && <span className="text-[11px] text-cyan-400/70">• {med.route}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Follow-up */}
            {editedNotes.follow_up && (
              <div className="clinical-section break-inside-avoid">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center pt-pr">
                    <RefreshCw size={13} className="text-indigo-400" />
                  </div>
                  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Follow-up</h3>
                </div>
                {isEditing ? (
                  <textarea className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-gray-200 outline-none focus:border-indigo-500/50 min-h-[60px]" value={editedNotes.follow_up} onChange={(e) => setEditedNotes({...editedNotes, follow_up: e.target.value})} />
                ) : (
                  <p className="text-gray-300 text-sm leading-relaxed">{structuredNotes.follow_up}</p>
                )}
              </div>
            )}

            {/* Advice */}
            {editedNotes.advice && (
              <div className="clinical-section break-inside-avoid">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-teal-500/10 flex items-center justify-center pt-pr">
                    <ClipboardList size={13} className="text-teal-400" />
                  </div>
                  <h3 className="text-xs font-bold text-teal-300 uppercase tracking-wider">Advice</h3>
                </div>
                {isEditing ? (
                  <textarea className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-gray-200 outline-none focus:border-teal-500/50 min-h-[80px]" value={editedNotes.advice} onChange={(e) => setEditedNotes({...editedNotes, advice: e.target.value})} />
                ) : (
                  <p className="text-gray-300 text-sm leading-relaxed">{structuredNotes.advice}</p>
                )}
              </div>
            )}
            </div>
          </div>
        )}

        {/* === FHIR Validation Badge === */}
        {validationResult && (
          <div className="animate-fade-in-up">
            <button
              onClick={() => setShowValidation(!showValidation)}
              className="w-full glass-card p-4 flex items-center justify-between hover:bg-white/[0.06] transition-colors"
              id="validation-toggle"
            >
              <div className="flex items-center gap-3">
                <Shield size={16} className={validationResult.is_valid ? 'text-emerald-400' : 'text-amber-400'} />
                <div className="text-left">
                  <p className="text-xs font-bold text-gray-300">
                    FHIR R4 Validation: {validationResult.is_valid ?
                      <span className="text-emerald-400">PASSED</span> :
                      <span className="text-amber-400">{validationResult.errors.length} errors</span>
                    }
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {validationResult.total_entries} resources • {validationResult.warnings.length} warnings
                  </p>
                </div>
              </div>
              {showValidation ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
            </button>

            {showValidation && (
              <div className="glass-card mt-1 p-4 space-y-3 rounded-t-none border-t-0">
                {/* Resource summary */}
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(validationResult.resource_summary).map(([type, count]) => (
                    <span key={type} className="metric-badge bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px]">
                      {type}: {count}
                    </span>
                  ))}
                </div>

                {validationResult.errors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-red-400 uppercase">Errors</p>
                    {validationResult.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <XCircle size={10} className="text-red-400 shrink-0 mt-1" />
                        <p className="text-xs text-red-300/80">{err}</p>
                      </div>
                    ))}
                  </div>
                )}

                {validationResult.warnings.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-amber-400 uppercase">Warnings</p>
                    {validationResult.warnings.map((warn, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <AlertCircle size={10} className="text-amber-400 shrink-0 mt-1" />
                        <p className="text-xs text-amber-300/80">{warn}</p>
                      </div>
                    ))}
                  </div>
                )}

                {validationResult.is_valid && validationResult.warnings.length === 0 && (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 size={14} />
                    <p className="text-xs font-medium">All checks passed</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* === Collapsible FHIR JSON === */}
        {fhirData && (
          <div className="animate-fade-in-up">
            <button
              onClick={() => setShowFhirJson(!showFhirJson)}
              className="w-full glass-card p-4 flex items-center justify-between hover:bg-white/[0.06] transition-colors"
              id="fhir-json-toggle"
            >
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Stethoscope size={14} className="text-purple-400" />
                FHIR R4 Bundle (JSON)
              </h2>
              {showFhirJson ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
            </button>

            {showFhirJson && (
              <div className="glass-card mt-1 p-0.5 rounded-t-none border-t-0">
                <div className="fhir-json-viewer">
                  <pre className="text-emerald-300/90 whitespace-pre-wrap break-words">
                    {JSON.stringify(fhirData, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === Speed Metrics Footer === */}
        {totalTimeMs > 0 && (
          <div className="glass-card p-4 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-gray-500" />
                <span className="text-[11px] text-gray-500 font-medium">Pipeline Speed</span>
              </div>
              <span className="text-[11px] text-gray-400 font-bold tabular-nums">
                Total: {(totalTimeMs / 1000).toFixed(1)}s
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <div className="flex-1 bg-indigo-500/10 rounded-lg p-2.5 border border-indigo-500/10">
                <p className="text-[9px] text-indigo-400/70 uppercase font-bold tracking-wider">Transcription</p>
                <p className="text-lg text-indigo-300 font-bold tabular-nums">{(transcriptionTimeMs / 1000).toFixed(1)}<span className="text-xs font-normal text-indigo-400/50">s</span></p>
              </div>
              <div className="flex-1 bg-purple-500/10 rounded-lg p-2.5 border border-purple-500/10">
                <p className="text-[9px] text-purple-400/70 uppercase font-bold tracking-wider">FHIR + Notes</p>
                <p className="text-lg text-purple-300 font-bold tabular-nums">{(fhirTimeMs / 1000).toFixed(1)}<span className="text-xs font-normal text-purple-400/50">s</span></p>
              </div>
            </div>
            {/* Speed bar */}
            <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden flex">
              <div
                className="bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-l-full transition-all duration-500"
                style={{ width: `${(transcriptionTimeMs / totalTimeMs) * 100}%` }}
              />
              <div
                className="bg-gradient-to-r from-purple-500 to-purple-400 rounded-r-full transition-all duration-500"
                style={{ width: `${(fhirTimeMs / totalTimeMs) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-[10px] text-gray-600">
            Powered by Gemini AI • FHIR R4 Compliant • Built for Indian Healthcare
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
