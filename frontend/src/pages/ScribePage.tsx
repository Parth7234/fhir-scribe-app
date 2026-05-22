import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageToggle from '../components/LanguageToggle';
import {
  Mic, Square, Loader2, FileText, Stethoscope, Activity,
  Pill, ChevronDown, ChevronUp, Clock, Zap, Languages,
  AlertCircle, Heart, Thermometer, ClipboardList, RefreshCw,
  CheckCircle2, XCircle, Shield, Edit3, Save, Download,
  ArrowLeft, UserPlus, Plus, Trash2, Calendar, User, Mail
} from 'lucide-react';
import PrintablePDFReport from './PrintablePDFReport';
import { downloadPdf } from '../utils/pdfDownload';
import { Capacitor } from '@capacitor/core';

const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (Capacitor.isNativePlatform()) {
    return envUrl || 'http://10.0.2.2:8000/api';
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:8000/api';
    }
  }
  return envUrl || 'http://localhost:8000/api';
};

const API_BASE_URL = getApiBaseUrl();

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

export default function ScribePage() {
  const { userProfile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

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
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [patientDob, setPatientDob] = useState('');
  const [showIntakeForm, setShowIntakeForm] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  const formatTime = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  // Rebuild FHIR bundle from edited structured notes
  const rebuildFhirFromNotes = (notes: any, existingBundle: any) => {
    if (!existingBundle || !existingBundle.entry) return existingBundle;
    const bundle = JSON.parse(JSON.stringify(existingBundle)); // deep clone
    const uuid = () => 'urn:uuid:' + crypto.randomUUID();
    const patientRef = bundle.entry.find((e: any) => e.resource?.resourceType === 'Patient')?.fullUrl || uuid();

    // Update Conditions from diagnoses
    bundle.entry = bundle.entry.filter((e: any) => e.resource?.resourceType !== 'Condition');
    (notes.diagnoses || []).forEach((dx: any) => {
      if (!dx.name) return;
      bundle.entry.push({
        fullUrl: uuid(),
        resource: {
          resourceType: 'Condition',
          subject: { reference: patientRef },
          code: {
            coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: dx.icd_code || '', display: dx.name }],
            text: dx.name,
          },
          severity: dx.severity ? { text: dx.severity } : undefined,
          clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
        },
      });
    });

    // Update MedicationRequests from medications
    bundle.entry = bundle.entry.filter((e: any) => e.resource?.resourceType !== 'MedicationRequest');
    (notes.medications || []).forEach((m: any) => {
      if (!m.name) return;
      bundle.entry.push({
        fullUrl: uuid(),
        resource: {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          subject: { reference: patientRef },
          medicationCodeableConcept: {
            coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', display: m.name }],
            text: m.name,
          },
          dosageInstruction: [{
            text: [m.dosage, m.frequency, m.duration, m.route].filter(Boolean).join(' • '),
            ...(m.route ? { route: { text: m.route } } : {}),
            ...(m.dosage ? { doseAndRate: [{ doseQuantity: { value: 0, unit: m.dosage } }] } : {}),
          }],
        },
      });
    });

    // Update Observations from vitals
    bundle.entry = bundle.entry.filter((e: any) => e.resource?.resourceType !== 'Observation');
    (notes.vitals || []).forEach((v: any) => {
      if (!v.name) return;
      bundle.entry.push({
        fullUrl: uuid(),
        resource: {
          resourceType: 'Observation',
          status: 'final',
          subject: { reference: patientRef },
          code: { coding: [{ system: 'http://loinc.org', display: v.name }], text: v.name },
          valueQuantity: { value: parseFloat(v.value) || 0, unit: v.unit || '' },
        },
      });
    });

    // Update Encounter note text with chief complaint + HPI
    const encounterEntry = bundle.entry.find((e: any) => e.resource?.resourceType === 'Encounter');
    if (encounterEntry) {
      encounterEntry.resource.reasonCode = notes.chief_complaint
        ? [{ text: notes.chief_complaint }]
        : encounterEntry.resource.reasonCode;
    }

    // Add custom fields as a DocumentReference if any
    bundle.entry = bundle.entry.filter((e: any) => !(e.resource?.resourceType === 'DocumentReference' && e.resource?.type?.text === 'Custom Clinical Fields'));
    if (notes.custom_fields?.length > 0) {
      const nonEmpty = notes.custom_fields.filter((cf: any) => cf.name && cf.value);
      if (nonEmpty.length > 0) {
        bundle.entry.push({
          fullUrl: uuid(),
          resource: {
            resourceType: 'DocumentReference',
            status: 'current',
            type: { text: 'Custom Clinical Fields' },
            description: 'Doctor-added custom clinical fields',
            content: nonEmpty.map((cf: any) => ({
              attachment: { contentType: 'text/plain', title: cf.name, data: btoa(cf.value) },
            })),
          },
        });
      }
    }

    return bundle;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        await handleTranscription(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      audioChunksRef.current = [];
      mediaRecorderRef.current.start();
      setIsRecording(true); setError(''); setTranscript(''); setFhirData(null);
      setStructuredNotes(null); setEditedNotes(null); setIsEditing(false);
      setValidationResult(null); setTranscriptionTimeMs(0); setFhirTimeMs(0); setSaveSuccess(false);
    } catch { setError(t('micPermission')); }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); } };

  const handleTranscription = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    try {
      const r = await axios.post(`${API_BASE_URL}/transcribe/?language=${language}`, formData);
      setTranscript(r.data.transcript); setTranscriptionTimeMs(r.data.transcription_time_ms || 0);
      handleFhirProcessing(r.data.transcript);
    } catch { setError(t('failedTranscribe')); } finally { setIsTranscribing(false); }
  };

  // Inject patient intake info into the FHIR Patient resource
  const injectPatientInfo = (bundle: any) => {
    if (!bundle?.entry) return bundle;
    const patientEntry = bundle.entry.find((e: any) => e.resource?.resourceType === 'Patient');
    if (patientEntry) {
      const p = patientEntry.resource;
      if (patientName.trim()) {
        p.name = [{ use: 'official', text: patientName.trim() }];
      }
      if (patientGender) {
        p.gender = patientGender;
      }
      if (patientDob) {
        p.birthDate = patientDob;
      }
      if (patientEmail.trim()) {
        p.telecom = [
          ...(p.telecom || []).filter((t: any) => t.system !== 'email'),
          { system: 'email', value: patientEmail.trim() }
        ];
      }
    }
    return bundle;
  };

  const handleFhirProcessing = async (text: string, isDemo = false) => {
    setIsProcessingFhir(true);
    if (isDemo) { setTranscript(text); setTranscriptionTimeMs(150); }
    try {
      const r = await axios.post(`${API_BASE_URL}/fhir/`, { transcript: text });
      const enrichedBundle = injectPatientInfo(r.data.fhir_bundle);
      setFhirData(enrichedBundle); setStructuredNotes(r.data.structured_notes);
      setEditedNotes(r.data.structured_notes); setIsEditing(false);
      setFhirTimeMs(r.data.total_processing_time_ms || 0);
      if (enrichedBundle) handleValidation(enrichedBundle);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setError(t('sessionExpired'));
      } else {
        setError(t('failedExtract'));
      }
    } finally { setIsProcessingFhir(false); }
  };

  const handleValidation = useCallback(async (bundle: any) => {
    setIsValidating(true);
    try { const r = await axios.post(`${API_BASE_URL}/fhir/validate`, { bundle }); setValidationResult(r.data); }
    catch { console.error('Validation failed'); } finally { setIsValidating(false); }
  }, []);

  const handleDownloadPdf = () => {
    const filename = `prescription_${patientName.replace(/\s+/g, '_') || 'ai_scribe'}.pdf`;
    downloadPdf('pdf-print-area', filename);
  };

  const handleSaveReport = async () => {
    if (!patientName.trim() || !userProfile) return;
    setIsSaving(true);
    try {
      const { error: insertError } = await supabase.from('reports').insert({
        doctor_id: userProfile.uid,
        doctor_name: userProfile.displayName,
        patient_name: patientName.trim(),
        patient_email: patientEmail.trim().toLowerCase() || null,
        transcript,
        structured_notes: structuredNotes,
        fhir_bundle: fhirData,
        language,
      });
      if (insertError) throw insertError;
      setSaveSuccess(true); setShowSaveModal(false); setPatientName(''); setPatientEmail('');
    } catch (err) { console.error('Save failed:', err); setError(t('failedSave')); }
    finally { setIsSaving(false); }
  };

  const totalTimeMs = transcriptionTimeMs + fhirTimeMs;

  // Build report object for PrintablePDFReport
  const pdfReport = {
    patientName: patientName || undefined,
    doctorName: userProfile?.displayName,
    createdAt: new Date().toISOString(),
    structuredNotes,
    transcript,
  };

  return (
    <div className="min-h-screen pb-24 md:pb-8 bg-surface text-on-surface">
      <header className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl border-b border-primary/10 shadow-glass">
        <div className="max-w-7xl mx-auto px-container-padding h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="p-2 text-on-surface-variant hover:text-primary rounded-full hover:bg-primary/5 transition-colors"><ArrowLeft size={18} /></button>
            <div className="text-headline-md font-bold tracking-tight text-primary">ScribeFlow</div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Languages size={14} className="text-outline" />
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="custom-select bg-surface-container-lowest border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors" id="language-selector">
              <option value="hi-en">Hinglish</option><option value="hi">Hindi</option><option value="en">English</option>
            </select>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-gutter md:px-container-padding pt-24 pb-8 space-y-5">
        {/* Patient Intake Form */}
        {showIntakeForm && (
          <div className="glass-card p-5 space-y-4 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary-container/20 flex items-center justify-center">
                  <UserPlus size={16} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-on-surface">Patient Information</h2>
                  <p className="text-[10px] text-on-surface-variant">Fill before consultation (optional)</p>
                </div>
              </div>
              <button onClick={() => setShowIntakeForm(false)} className="text-label-sm text-primary hover:text-primary-fixed-dim px-2 py-1 rounded-lg hover:bg-primary/5 transition-colors">Skip →</button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="relative">
                <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
                <input type="text" placeholder="Patient Name" value={patientName} onChange={(e) => setPatientName(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-10 pr-4 py-3 text-sm text-on-surface placeholder:text-outline-variant/70 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors" />
              </div>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" />
                <input type="email" placeholder="Email (optional)" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-10 pr-4 py-3 text-sm text-on-surface placeholder:text-outline-variant/70 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select value={patientGender} onChange={(e) => setPatientGender(e.target.value)} className="bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors appearance-none">
                  <option value="">Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
                  <input type="date" placeholder="Date of Birth" value={patientDob} onChange={(e) => setPatientDob(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-10 pr-4 py-3 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors" />
                </div>
              </div>
            </div>
            {patientName.trim() && (
              <button onClick={() => setShowIntakeForm(false)} className="w-full py-2.5 rounded-lg text-label-md font-medium text-primary bg-primary/10 hover:bg-primary/15 border border-primary/20 transition-colors flex items-center justify-center gap-2">
                <CheckCircle2 size={14} /> Continue to Consultation
              </button>
            )}
          </div>
        )}

        {/* Recording */}
        <div className="glass-card p-6 md:p-8 flex flex-col items-center space-y-6 relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none"></div>
          
          {/* Aether Premium Sensing / Standby Header */}
          <div className="flex items-center justify-between w-full pb-3 border-b border-primary/10 relative z-10">
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-2 transition-all duration-300 ${
                isRecording 
                  ? 'bg-secondary-container/40 text-secondary border border-secondary-container' 
                  : 'bg-primary/10 text-primary border border-primary/20'
              }`}>
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isRecording ? 'bg-secondary' : 'bg-primary'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isRecording ? 'bg-secondary' : 'bg-primary'}`}></span>
                </span>
                {isRecording ? 'Live Ambient Sensing' : 'Scribe Standby'}
              </span>
            </div>
            <span className="text-[11px] text-outline font-medium tracking-wider">ROOM 4A · DR. JENKINS</span>
          </div>

          <div className="text-display-lg text-on-surface relative z-10 tabular-nums">{formatTime(recordingTime)}</div>
          
          {/* Waveform Animation */}
          {isRecording && (
            <div className="flex items-center justify-center gap-1.5 h-16 w-full max-w-[240px] relative z-10">
              {[...Array(14)].map((_, i) => {
                // Alternating Matcha and Peach heights for natural voice simulation
                const isEven = i % 2 === 0;
                return (
                  <div
                    key={i}
                    className={`waveform-bar ${isEven ? 'bg-primary' : 'bg-secondary-container'}`}
                    style={{
                      animationDelay: `${i * 0.08}s`,
                      height: `${25 + Math.sin(i) * 30 + Math.random() * 20}%`,
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Giant Record Button */}
          <button
            id="record-button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-20 h-20 rounded-full flex justify-center items-center transition-all duration-300 transform hover:scale-105 active:scale-95 relative z-10 ${
              isRecording
                ? 'bg-secondary text-on-secondary shadow-[0px_8px_32px_rgba(124,86,55,0.4)] animate-pulse'
                : 'bg-primary text-on-primary shadow-[0px_8px_32px_rgba(86,100,43,0.3)]'
            }`}
          >
            {isRecording ? <Square fill="currentColor" size={24} /> : <Mic size={32} />}
          </button>
          
          {isRecording ? (
            <p className="text-label-md text-secondary font-semibold animate-pulse relative z-10">Listening actively...</p>
          ) : (
            <p className="text-label-md text-primary font-semibold relative z-10">{t('tapToRecord')}</p>
          )}

          {!isRecording && !isTranscribing && !isProcessingFhir && (
            <div className="w-full mt-6 pt-5 border-t border-primary/10 flex flex-col gap-3 relative z-10">
              <p className="text-center text-label-sm uppercase tracking-wider text-outline mb-1">{t('tryDemoConversation')}</p>
              <select value={selectedDemo} onChange={(e) => setSelectedDemo(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors">
                {DEMO_SCRIPTS.map(s => <option key={s.id} value={s.text}>{s.title}</option>)}
              </select>
              <button onClick={() => handleFhirProcessing(selectedDemo, true)} className="w-full bg-primary/5 hover:bg-primary/10 border border-primary/20 text-primary px-4 py-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 group">
                <Zap size={16} className="text-secondary group-hover:scale-110 transition-transform" /> {t('runDemoScript')}
              </button>
            </div>
          )}
        </div>

        {error && <div className="animate-fade-in-up flex items-start gap-3 glass-card p-4 border-error/20"><AlertCircle size={18} className="text-error shrink-0 mt-0.5" /><p className="text-on-error-container text-sm font-medium flex-1">{error}</p><button onClick={() => setError('')} className="text-error/50 hover:text-error"><XCircle size={16} /></button></div>}
        {saveSuccess && <div className="animate-fade-in-up flex items-center gap-3 glass-card p-4 border-primary/20"><CheckCircle2 size={18} className="text-primary" /><p className="text-primary text-sm font-medium">{t('reportSavedSuccess')}</p><button onClick={() => setSaveSuccess(false)} className="text-primary/50 hover:text-primary ml-auto"><XCircle size={16} /></button></div>}

        {isTranscribing && <div className="glass-card p-5 animate-fade-in-up"><div className="flex items-center gap-3"><Loader2 className="animate-spin text-primary" size={20} /><div><p className="text-on-surface font-semibold text-sm">{t('transcribingWithGemini')}</p><p className="text-on-surface-variant text-xs">{t('processingAudio')}</p></div></div><div className="mt-3 space-y-2"><div className="loading-shimmer h-3 w-full" /><div className="loading-shimmer h-3 w-4/5" /><div className="loading-shimmer h-3 w-3/5" /></div></div>}

        {transcript && <div className="glass-card p-5 space-y-3 animate-fade-in-up"><div className="flex items-center justify-between"><h2 className="text-label-sm text-on-surface-variant uppercase tracking-widest flex items-center gap-2"><FileText size={14} className="text-primary" />{t('transcript')}</h2>{transcriptionTimeMs > 0 && <span className="metric-badge bg-primary/10 text-primary border border-primary/20"><Zap size={10} /> {(transcriptionTimeMs/1000).toFixed(1)}s</span>}</div><p className="text-on-surface leading-relaxed text-body-lg">{transcript}</p></div>}

        {isProcessingFhir && <div className="glass-card p-5 animate-fade-in-up"><div className="flex items-center gap-3"><Loader2 className="animate-spin text-primary" size={20} /><div><p className="text-on-surface font-semibold text-sm">{t('extractingEntities')}</p><p className="text-on-surface-variant text-xs">{t('generatingFhir')}</p></div></div><div className="mt-3 grid grid-cols-2 gap-2">{[1,2,3,4].map(i => <div key={i} className="loading-shimmer h-20 rounded-xl" />)}</div></div>}

        {structuredNotes && editedNotes && <ClinicalNotesSection structuredNotes={structuredNotes} editedNotes={editedNotes} isEditing={isEditing} setEditedNotes={setEditedNotes} setStructuredNotes={setStructuredNotes} setIsEditing={setIsEditing} handleDownloadPdf={handleDownloadPdf} saveSuccess={saveSuccess} userRole={userProfile?.role} onSave={() => setShowSaveModal(true)} fhirData={fhirData} setFhirData={setFhirData} rebuildFhirFromNotes={rebuildFhirFromNotes} />}

        {validationResult && <ValidationSection validationResult={validationResult} showValidation={showValidation} setShowValidation={setShowValidation} />}

        {fhirData && <FhirJsonSection fhirData={fhirData} showFhirJson={showFhirJson} setShowFhirJson={setShowFhirJson} />}

        {totalTimeMs > 0 && <SpeedMetrics transcriptionTimeMs={transcriptionTimeMs} fhirTimeMs={fhirTimeMs} totalTimeMs={totalTimeMs} />}

        <div className="text-center py-4"><p className="text-[10px] text-outline">{t('footer')}</p></div>
      </div>

      {/* Hidden printable report for PDF */}
      {structuredNotes && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <PrintablePDFReport report={pdfReport} />
        </div>
      )}

      {showSaveModal && <SaveModal patientName={patientName} setPatientName={setPatientName} patientEmail={patientEmail} setPatientEmail={setPatientEmail} isSaving={isSaving} onSave={handleSaveReport} onClose={() => setShowSaveModal(false)} hasIntakeName={!!patientName.trim()} />}
    </div>
  );
}

/* === Sub-components to keep the file manageable === */

function ClinicalNotesSection({ structuredNotes, editedNotes, isEditing, setEditedNotes, setStructuredNotes, setIsEditing, handleDownloadPdf, saveSuccess, userRole, onSave, fhirData, setFhirData, rebuildFhirFromNotes }: any) {
  const { t } = useLanguage();

  const updateMed = (i: number, field: string, val: string) => {
    const meds = [...editedNotes.medications];
    meds[i] = { ...meds[i], [field]: val };
    setEditedNotes({ ...editedNotes, medications: meds });
  };
  const removeMed = (i: number) => {
    setEditedNotes({ ...editedNotes, medications: editedNotes.medications.filter((_:any, j:number) => j !== i) });
  };
  const addMed = () => {
    setEditedNotes({ ...editedNotes, medications: [...(editedNotes.medications || []), { name: '', dosage: '', frequency: '', duration: '', route: '' }] });
  };

  const updateDx = (i: number, field: string, val: string) => {
    const dxs = [...editedNotes.diagnoses];
    dxs[i] = { ...dxs[i], [field]: val };
    setEditedNotes({ ...editedNotes, diagnoses: dxs });
  };
  const removeDx = (i: number) => {
    setEditedNotes({ ...editedNotes, diagnoses: editedNotes.diagnoses.filter((_:any, j:number) => j !== i) });
  };
  const addDx = () => {
    setEditedNotes({ ...editedNotes, diagnoses: [...(editedNotes.diagnoses || []), { name: '', icd_code: '', severity: 'mild' }] });
  };

  const updateVital = (i: number, field: string, val: string) => {
    const vitals = [...editedNotes.vitals];
    vitals[i] = { ...vitals[i], [field]: val };
    setEditedNotes({ ...editedNotes, vitals: vitals });
  };
  const removeVital = (i: number) => {
    setEditedNotes({ ...editedNotes, vitals: editedNotes.vitals.filter((_:any, j:number) => j !== i) });
  };
  const addVital = () => {
    setEditedNotes({ ...editedNotes, vitals: [...(editedNotes.vitals || []), { name: '', value: '', unit: '' }] });
  };

  const addCustomField = () => {
    setEditedNotes({ ...editedNotes, custom_fields: [...(editedNotes.custom_fields || []), { name: '', value: '' }] });
  };
  const updateCustomField = (i: number, field: string, val: string) => {
    const cf = [...(editedNotes.custom_fields || [])];
    cf[i] = { ...cf[i], [field]: val };
    setEditedNotes({ ...editedNotes, custom_fields: cf });
  };
  const removeCustomField = (i: number) => {
    setEditedNotes({ ...editedNotes, custom_fields: (editedNotes.custom_fields || []).filter((_:any, j:number) => j !== i) });
  };

  const inp = "w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors placeholder:text-outline-variant/70";

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-label-sm text-on-surface-variant uppercase tracking-widest flex items-center gap-2"><ClipboardList size={14} className="text-primary" />{t('structuredClinicalNotes')}</h2>
        <div className="flex gap-2">
          {isEditing ? <button onClick={() => { setStructuredNotes(editedNotes); setFhirData(rebuildFhirFromNotes(editedNotes, fhirData)); setIsEditing(false); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary bg-primary/10 rounded-xl hover:bg-primary/15 transition-all"><Save size={14} /> {t('saveEdits')}</button>
            : <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-on-surface bg-surface-container hover:bg-surface-container-high rounded-xl transition-all border border-outline-variant/35 shadow-sm"><Edit3 size={14} /> {t('edit')}</button>}
          {!isEditing && <>
            <button onClick={handleDownloadPdf} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary bg-primary/15 rounded-xl hover:bg-primary/25 transition-all border border-primary/10"><Download size={14} /> {t('pdf')}</button>
            {!saveSuccess && userRole === 'doctor' && <button onClick={onSave} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-on-primary bg-primary rounded-xl hover:bg-primary/90 shadow-btn-primary transition-all active:scale-95" id="save-report-btn"><UserPlus size={14} /> {t('save')}</button>}
          </>}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: CC, HPI, Exam, Vitals */}
        <div className="space-y-6">
          {/* Chief Complaint */}
          {(editedNotes.chief_complaint || isEditing) && (
            <NoteSection
              icon={<AlertCircle size={14} />}
              title={t('chiefComplaint')}
              color="amber"
              value={isEditing ? editedNotes.chief_complaint : structuredNotes.chief_complaint}
              isEditing={isEditing}
              onChange={(v: string) => setEditedNotes({ ...editedNotes, chief_complaint: v })}
            />
          )}

          {/* History of Present Illness */}
          {(editedNotes.history_of_present_illness || isEditing) && (
            <NoteSection
              icon={<FileText size={14} />}
              title={t('historyOfPresentIllness')}
              color="blue"
              value={isEditing ? editedNotes.history_of_present_illness : structuredNotes.history_of_present_illness}
              isEditing={isEditing}
              onChange={(v: string) => setEditedNotes({ ...editedNotes, history_of_present_illness: v })}
            />
          )}

          {/* Examination Findings */}
          {(editedNotes.examination_findings || isEditing) && (
            <NoteSection
              icon={<Activity size={14} />}
              title={t('examinationFindings')}
              color="cyan"
              value={isEditing ? editedNotes.examination_findings : structuredNotes.examination_findings}
              isEditing={isEditing}
              onChange={(v: string) => setEditedNotes({ ...editedNotes, examination_findings: v })}
            />
          )}

          {/* Vitals — Editable */}
          {(editedNotes.vitals?.length > 0 || isEditing) && (
            <div className="clinical-section bg-white border border-[#56642b]/10 rounded-2xl p-5 shadow-[0px_4px_20px_rgba(138,154,91,0.02)]">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-rose-500/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600">
                    <Heart size={14} />
                  </div>
                  <h3 className="text-xs font-extrabold text-rose-800 uppercase tracking-wider">{t('vitals')}</h3>
                </div>
                {isEditing && (
                  <button onClick={addVital} className="text-[10px] font-bold text-rose-800 hover:text-rose-700 transition-colors">
                    <Plus size={12} className="inline" /> {t('addVital')}
                  </button>
                )}
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  {(editedNotes.vitals || []).map((v: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <input className={inp} placeholder={t('vitalName')} value={v.name} onChange={e => updateVital(i, 'name', e.target.value)} />
                      <input className={inp} placeholder={t('value')} value={v.value} onChange={e => updateVital(i, 'value', e.target.value)} style={{ maxWidth: '80px' }} />
                      <input className={inp} placeholder={t('unit')} value={v.unit} onChange={e => updateVital(i, 'unit', e.target.value)} style={{ maxWidth: '60px' }} />
                      <button onClick={() => removeVital(i)} className="p-1 text-red-400/50 hover:text-red-400 shrink-0"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {editedNotes.vitals.map((v: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 bg-[#fdf8f4] border border-[#f5e6da] rounded-xl p-3.5 hover:scale-[1.02] hover:shadow-sm transition-all">
                      <Thermometer size={16} className="text-rose-500/70 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[9px] text-[#7c5637] uppercase font-black tracking-wider truncate">{v.name}</p>
                        <p className="text-base text-gray-800 font-black mt-0.5">
                          {v.value} <span className="text-gray-500 text-xs font-bold">{v.unit}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Diagnoses, Follow-up, Advice, Custom Fields */}
        <div className="space-y-6">
          {/* Diagnoses — Editable */}
          {(editedNotes.diagnoses?.length > 0 || isEditing) && (
            <div className="clinical-section bg-white border border-[#56642b]/10 rounded-2xl p-5 shadow-[0px_4px_20px_rgba(138,154,91,0.02)]">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-orange-500/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                    <Stethoscope size={14} />
                  </div>
                  <h3 className="text-xs font-extrabold text-orange-800 uppercase tracking-wider">{t('diagnoses')}</h3>
                </div>
                {isEditing && (
                  <button onClick={addDx} className="text-[10px] font-bold text-orange-800 hover:text-orange-700 transition-colors">
                    <Plus size={12} className="inline" /> {t('addDiagnosis')}
                  </button>
                )}
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  {(editedNotes.diagnoses || []).map((dx: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <input className={inp} placeholder={t('diagnosisName')} value={dx.name} onChange={e => updateDx(i, 'name', e.target.value)} />
                      <input className={inp} placeholder={t('icdCode')} value={dx.icd_code} onChange={e => updateDx(i, 'icd_code', e.target.value)} style={{ maxWidth: '80px' }} />
                      <select className={inp + ' max-w-[80px]'} value={dx.severity || 'mild'} onChange={e => updateDx(i, 'severity', e.target.value)}>
                        <option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option>
                      </select>
                      <button onClick={() => removeDx(i)} className="p-1 text-red-400/50 hover:text-red-400 shrink-0"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {editedNotes.diagnoses.map((dx: any, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-[#fffaf5] border border-[#ffedd5] rounded-xl p-3.5 hover:scale-[1.01] hover:shadow-sm transition-all">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white ${dx.severity?.toLowerCase() === 'severe' ? 'bg-red-500 animate-pulse' : dx.severity?.toLowerCase() === 'moderate' ? 'bg-amber-500' : 'bg-green-500'}`} />
                        <span className="text-sm text-gray-800 font-bold truncate">{dx.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {dx.icd_code && (
                          <span className="bg-white text-[#7c5637] border border-[#ffedd5] text-[10px] px-2.5 py-1 rounded-lg font-bold shadow-sm">
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
              )}
            </div>
          )}

          {/* Follow-up */}
          {(editedNotes.follow_up || isEditing) && (
            <NoteSection
              icon={<RefreshCw size={14} />}
              title={t('followUp')}
              color="indigo"
              value={isEditing ? editedNotes.follow_up : structuredNotes.follow_up}
              isEditing={isEditing}
              onChange={(v: string) => setEditedNotes({ ...editedNotes, follow_up: v })}
            />
          )}

          {/* Advice */}
          {(editedNotes.advice || isEditing) && (
            <NoteSection
              icon={<ClipboardList size={14} />}
              title={t('advice')}
              color="teal"
              value={isEditing ? editedNotes.advice : structuredNotes.advice}
              isEditing={isEditing}
              onChange={(v: string) => setEditedNotes({ ...editedNotes, advice: v })}
            />
          )}

          {/* Custom Fields */}
          {(editedNotes.custom_fields?.length > 0 || isEditing) && (
            <div className="clinical-section bg-white border border-[#56642b]/10 rounded-2xl p-5 shadow-[0px_4px_20px_rgba(138,154,91,0.02)]">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-violet-500/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-600">
                    <Plus size={14} />
                  </div>
                  <h3 className="text-xs font-extrabold text-violet-800 uppercase tracking-wider">{t('customFields')}</h3>
                </div>
                {isEditing && (
                  <button onClick={addCustomField} className="text-[10px] font-bold text-violet-800 hover:text-violet-700 transition-colors">
                    <Plus size={12} className="inline" /> {t('addCustomField')}
                  </button>
                )}
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  {(editedNotes.custom_fields || []).map((cf: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <input className={inp} placeholder={t('fieldName')} value={cf.name} onChange={e => updateCustomField(i, 'name', e.target.value)} />
                      <input className={inp + ' flex-1'} placeholder={t('fieldValue')} value={cf.value} onChange={e => updateCustomField(i, 'value', e.target.value)} />
                      <button onClick={() => removeCustomField(i)} className="p-1 text-red-400/50 hover:text-red-400 shrink-0"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {(editedNotes.custom_fields || []).map((cf: any, i: number) => (
                    <div key={i} className="bg-[#f5f2fb] border border-[#dcd3ee] rounded-xl p-4 flex flex-col hover:scale-[1.01] hover:shadow-sm transition-all">
                      <p className="text-[10px] text-violet-800 uppercase tracking-wider font-extrabold">{cf.name}</p>
                      <p className="text-sm text-gray-800 mt-1 font-semibold">{cf.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Medications — Spans both columns on large screen layouts */}
        {(editedNotes.medications?.length > 0 || isEditing) && (
          <div className="lg:col-span-2 clinical-section bg-white border border-[#56642b]/10 rounded-2xl p-5 shadow-[0px_4px_20px_rgba(138,154,91,0.02)]">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-emerald-500/10">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <Pill size={14} />
                </div>
                <h3 className="text-xs font-extrabold text-[#56642b] uppercase tracking-wider">{t('medications')}</h3>
              </div>
              {isEditing && (
                <button onClick={addMed} className="text-[10px] font-bold text-[#56642b] hover:text-[#56642b]/80 transition-colors">
                  <Plus size={12} className="inline" /> {t('addMedication')}
                </button>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-3">
                {(editedNotes.medications || []).map((m: any, i: number) => (
                  <div key={i} className="bg-surface-container-low rounded-xl p-3 border border-outline-variant/35 space-y-2">
                    <div className="flex items-center gap-2">
                      <input className={inp + ' flex-1 font-semibold'} placeholder={t('medName')} value={m.name} onChange={e => updateMed(i, 'name', e.target.value)} />
                      <button onClick={() => removeMed(i)} className="p-1.5 text-red-400/50 hover:text-red-400 shrink-0"><Trash2 size={14} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input className={inp} placeholder={t('dosage')} value={m.dosage} onChange={e => updateMed(i, 'dosage', e.target.value)} />
                      <input className={inp} placeholder={t('frequency')} value={m.frequency} onChange={e => updateMed(i, 'frequency', e.target.value)} />
                      <input className={inp} placeholder={t('duration')} value={m.duration} onChange={e => updateMed(i, 'duration', e.target.value)} />
                      <input className={inp} placeholder={t('route')} value={m.route} onChange={e => updateMed(i, 'route', e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editedNotes.medications.map((m: any, i: number) => (
                  <div key={i} className="bg-[#f4f6f0] border border-[#d3dcd0] rounded-xl p-4 flex flex-col hover:scale-[1.01] hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                      <p className="text-base text-[#56642b] font-black">{m.matched_name || m.name}</p>
                      {m.therapeutic_class && (
                        <span className="bg-primary/10 text-primary border border-primary/20 text-[9px] font-black px-2.5 py-0.5 rounded-lg shrink-0 shadow-sm ml-2">
                          {m.therapeutic_class}
                        </span>
                      )}
                    </div>
                    {m.composition && <p className="text-[10px] text-[#7c5637] font-semibold mt-1">💊 {m.composition}</p>}
                    {m.manufacturer && <p className="text-[9px] text-[#7c5637]/70 font-semibold mt-0.5">🏭 {m.manufacturer}</p>}
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      {m.dosage && (
                        <span className="bg-white border border-[#d3dcd0] text-gray-800 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-sm">
                          {m.dosage}
                        </span>
                      )}
                      {m.frequency && (
                        <span className="bg-[#56642b]/15 text-[#56642b] px-2.5 py-1 rounded-lg text-[10px] font-extrabold shadow-sm">
                          {m.frequency}
                        </span>
                      )}
                      {m.duration && (
                        <span className="bg-[#fdf8f4] border border-[#f5e6da] text-[#7c5637] px-2.5 py-1 rounded-lg text-[10px] font-extrabold shadow-sm">
                          {m.duration}
                        </span>
                      )}
                      {m.route && (
                        <span className="bg-cyan-50 border border-cyan-100 text-cyan-800 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-sm">
                          {m.route}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Custom Field button when editing and no custom fields yet */}
      {isEditing && (!editedNotes.custom_fields || editedNotes.custom_fields.length === 0) && (
        <button onClick={addCustomField} className="w-full py-3 rounded-xl text-xs font-bold text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 transition-colors flex items-center justify-center gap-2">
          <Plus size={14} /> {t('addCustomField')}
        </button>
      )}
    </div>
  );
}

function NoteSection({ icon, title, color, value, isEditing, onChange }: any) {
  const colorMap: Record<string, { bg: string, border: string, iconColor: string, titleText: string }> = {
    amber: { bg: 'bg-[#fdfbf7]', border: 'border-[#f5d0a9]/40', iconColor: 'text-[#d97706]', titleText: 'text-[#92400e]' },
    blue: { bg: 'bg-[#f7fafc]', border: 'border-[#bee3f8]/50', iconColor: 'text-[#2b6cb0]', titleText: 'text-[#2c5282]' },
    cyan: { bg: 'bg-[#f0fdf2]', border: 'border-[#bbf7d0]/40', iconColor: 'text-[#0d9488]', titleText: 'text-[#115e59]' },
    indigo: { bg: 'bg-[#f5f3ff]', border: 'border-[#ddd6fe]/40', iconColor: 'text-[#6d28d9]', titleText: 'text-[#5b21b6]' },
    teal: { bg: 'bg-[#f0fdf4]', border: 'border-[#bbf7d0]/40', iconColor: 'text-[#15803d]', titleText: 'text-[#166534]' },
    primary: { bg: 'bg-[#f4f6f0]', border: 'border-[#d3dcd0]/40', iconColor: 'text-[#56642b]', titleText: 'text-[#3e4c16]' },
  };

  const scheme = colorMap[color] || colorMap.primary;

  return (
    <div className={`clinical-section ${scheme.bg} border ${scheme.border} rounded-2xl p-5 shadow-[0px_4px_20px_rgba(138,154,91,0.02)] transition-all hover:shadow-[0px_8px_30px_rgba(138,154,91,0.05)]`}>
      <div className="flex items-center gap-2.5 pb-2 mb-2 border-b border-primary/5">
        <div className={`w-7 h-7 rounded-xl bg-white border ${scheme.border} flex items-center justify-center ${scheme.iconColor} shadow-sm`}>
          {icon}
        </div>
        <h3 className={`text-xs font-black uppercase tracking-wider ${scheme.titleText}`}>{title}</h3>
      </div>
      {isEditing ? (
        <textarea
          className="w-full bg-white border border-outline-variant rounded-lg p-3 text-sm text-gray-800 outline-none focus:ring-1 focus:ring-primary focus:border-primary min-h-[80px] shadow-inner"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <p className="text-gray-800 text-sm leading-relaxed font-semibold whitespace-pre-wrap">{value}</p>
      )}
    </div>
  );
}

function ValidationSection({ validationResult, showValidation, setShowValidation }: any) {
  const { t } = useLanguage();
  return (
    <div className="animate-fade-in-up">
      <button onClick={() => setShowValidation(!showValidation)} className="w-full glass-card p-4 flex items-center justify-between hover:border-primary/20 transition-colors" id="validation-toggle">
        <div className="flex items-center gap-3"><Shield size={16} className={validationResult.is_valid ? 'text-primary' : 'text-secondary'} /><div className="text-left"><p className="text-xs font-bold text-on-surface">{t('fhirValidation')}: {validationResult.is_valid ? <span className="text-primary">{t('passed')}</span> : <span className="text-secondary">{validationResult.errors.length} {t('errors')}</span>}</p><p className="text-[10px] text-on-surface-variant">{validationResult.total_entries} {t('resources')} • {validationResult.warnings.length} {t('warnings')}</p></div></div>
        {showValidation ? <ChevronUp size={16} className="text-outline" /> : <ChevronDown size={16} className="text-outline" />}
      </button>
      {showValidation && <div className="glass-card mt-1 p-4 space-y-3 rounded-t-none border-t-0">
        <div className="flex flex-wrap gap-1.5">{Object.entries(validationResult.resource_summary).map(([t,c]) => <span key={t} className="metric-badge bg-primary/10 text-primary border border-primary/20 text-[10px]">{t}: {c as number}</span>)}</div>
        {validationResult.errors.length > 0 && <div className="space-y-1"><p className="text-[10px] font-bold text-error uppercase">Errors</p>{validationResult.errors.map((e:string,i:number) => <div key={i} className="flex items-start gap-1.5"><XCircle size={10} className="text-error shrink-0 mt-1" /><p className="text-xs text-on-error-container">{e}</p></div>)}</div>}
        {validationResult.warnings.length > 0 && <div className="space-y-1"><p className="text-[10px] font-bold text-secondary uppercase">Warnings</p>{validationResult.warnings.map((w:string,i:number) => <div key={i} className="flex items-start gap-1.5"><AlertCircle size={10} className="text-secondary shrink-0 mt-1" /><p className="text-xs text-on-secondary-container">{w}</p></div>)}</div>}
        {validationResult.is_valid && validationResult.warnings.length === 0 && <div className="flex items-center gap-2 text-primary"><CheckCircle2 size={14} /><p className="text-xs font-medium">{t('allChecksPassed')}</p></div>}
      </div>}
    </div>
  );
}

function FhirJsonSection({ fhirData, showFhirJson, setShowFhirJson }: any) {
  const { t } = useLanguage();
  return (
    <div className="animate-fade-in-up">
      <button onClick={() => setShowFhirJson(!showFhirJson)} className="w-full glass-card p-4 flex items-center justify-between hover:border-primary/20 transition-colors" id="fhir-json-toggle">
        <h2 className="text-label-sm text-on-surface-variant uppercase tracking-widest flex items-center gap-2"><Stethoscope size={14} className="text-primary" />{t('fhirBundle')}</h2>
        {showFhirJson ? <ChevronUp size={16} className="text-outline" /> : <ChevronDown size={16} className="text-outline" />}
      </button>
      {showFhirJson && <div className="glass-card mt-1 p-0.5 rounded-t-none border-t-0"><div className="fhir-json-viewer"><pre className="text-primary whitespace-pre-wrap break-words">{JSON.stringify(fhirData, null, 2)}</pre></div></div>}
    </div>
  );
}

function SpeedMetrics({ transcriptionTimeMs, fhirTimeMs, totalTimeMs }: any) {
  const { t } = useLanguage();
  return (
    <div className="glass-card p-4 animate-fade-in-up">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Clock size={14} className="text-outline" /><span className="text-[11px] text-on-surface-variant font-medium">{t('pipelineSpeed')}</span></div><span className="text-[11px] text-on-surface font-bold tabular-nums">{t('total')}: {(totalTimeMs/1000).toFixed(1)}s</span></div>
      <div className="mt-3 flex gap-2">
        <div className="flex-1 bg-primary/10 rounded-lg p-2.5 border border-primary/10"><p className="text-[9px] text-primary/70 uppercase font-bold tracking-wider">{t('transcription')}</p><p className="text-lg text-primary font-bold tabular-nums">{(transcriptionTimeMs/1000).toFixed(1)}<span className="text-xs font-normal text-primary/50">s</span></p></div>
        <div className="flex-1 bg-secondary/10 rounded-lg p-2.5 border border-secondary/10"><p className="text-[9px] text-secondary/70 uppercase font-bold tracking-wider">{t('fhirNotes')}</p><p className="text-lg text-secondary font-bold tabular-nums">{(fhirTimeMs/1000).toFixed(1)}<span className="text-xs font-normal text-secondary/50">s</span></p></div>
      </div>
      <div className="mt-3 h-1.5 bg-surface-container-high rounded-full overflow-hidden flex"><div className="bg-primary rounded-l-full transition-all duration-500" style={{width:`${(transcriptionTimeMs/totalTimeMs)*100}%`}} /><div className="bg-secondary-container rounded-r-full transition-all duration-500" style={{width:`${(fhirTimeMs/totalTimeMs)*100}%`}} /></div>
    </div>
  );
}

function SaveModal({ patientName, setPatientName, patientEmail, setPatientEmail, isSaving, onSave, onClose, hasIntakeName }: any) {
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-on-surface/40 backdrop-blur-sm px-4">
      <div className="glass-card p-6 w-full max-w-sm space-y-5 animate-fade-in-up border border-primary/10">
        <h3 className="text-headline-md text-on-surface text-center font-semibold">{t('saveReport')}</h3>
        <p className="text-label-sm text-on-surface-variant text-center">{hasIntakeName ? 'Confirm and save this consultation.' : t('linkConsultation')}</p>
        <div className="space-y-3">
          {!hasIntakeName && (
            <>
              <input type="text" placeholder={t('patientNameRequired')} value={patientName} onChange={(e) => setPatientName(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 text-body-md text-on-surface placeholder:text-outline-variant/70 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors" id="patient-name-input" />
              <input type="email" placeholder={t('patientEmailOptional')} value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 text-body-md text-on-surface placeholder:text-outline-variant/70 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors" id="patient-email-input" />
            </>
          )}
          {hasIntakeName && (
            <div className="bg-surface-container-low rounded-xl p-4 border border-primary/5 space-y-2">
              <div className="flex justify-between"><span className="text-label-sm text-outline">Patient</span><span className="text-body-md text-on-surface font-medium">{patientName}</span></div>
              {patientEmail && <div className="flex justify-between"><span className="text-label-sm text-outline">Email</span><span className="text-body-md text-on-surface-variant">{patientEmail}</span></div>}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-lg text-label-md font-medium text-on-surface-variant border border-primary/20 hover:bg-primary/5 transition-colors">{t('cancel')}</button>
          <button onClick={onSave} disabled={!patientName.trim() || isSaving} className="flex-1 py-3 rounded-lg text-label-md font-medium text-on-primary bg-primary shadow-btn-primary transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50" id="confirm-save-btn">
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{isSaving ? t('saving') : t('saveReport')}
          </button>
        </div>
      </div>
    </div>
  );
}
