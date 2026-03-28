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
  ArrowLeft, UserPlus, Plus, Trash2
} from 'lucide-react';
import PrintablePDFReport from './PrintablePDFReport';
// @ts-ignore
import html2pdf from 'html2pdf.js';

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

  const handleFhirProcessing = async (text: string, isDemo = false) => {
    setIsProcessingFhir(true);
    if (isDemo) { setTranscript(text); setTranscriptionTimeMs(150); }
    try {
      const r = await axios.post(`${API_BASE_URL}/fhir/`, { transcript: text });
      setFhirData(r.data.fhir_bundle); setStructuredNotes(r.data.structured_notes);
      setEditedNotes(r.data.structured_notes); setIsEditing(false);
      setFhirTimeMs(r.data.total_processing_time_ms || 0);
      if (r.data.fhir_bundle) handleValidation(r.data.fhir_bundle);
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
    const el = document.getElementById('pdf-print-area');
    if (!el) return;
    html2pdf().set({
      margin: 0,
      filename: `prescription_${patientName.replace(/\s+/g, '_') || 'ai_scribe'}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    }).from(el).save();
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
    <div className="min-h-screen pb-8">
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-black/30 border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button onClick={() => navigate('/dashboard')} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"><ArrowLeft size={18} /></button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20"><Stethoscope size={18} className="text-white" /></div>
            <div><h1 className="text-sm font-bold text-white tracking-tight">{t('aiAmbientScribe')}</h1><p className="text-[10px] text-gray-400 font-medium">{t('fhirClinicalNotes')}</p></div>
          </div>
          <div className="flex items-center gap-1.5">
            <LanguageToggle />
            <Languages size={14} className="text-gray-400" />
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="custom-select bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500/50 transition-colors" id="language-selector">
              <option value="hi-en">Hinglish</option><option value="hi">Hindi</option><option value="en">English</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
        {/* Recording */}
        <div className="glass-card p-8 flex flex-col items-center space-y-5">
          <button id="record-button" onClick={isRecording ? stopRecording : startRecording}
            className={`recording-btn w-24 h-24 rounded-full flex justify-center items-center transition-all duration-300 transform hover:scale-105 active:scale-95 ${isRecording ? 'is-recording bg-gradient-to-br from-red-500 to-rose-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40'}`}>
            {isRecording ? <Square fill="currentColor" className="text-white" size={28} /> : <Mic className="text-white" size={32} />}
          </button>
          {isRecording ? (
            <div className="text-center space-y-2"><p className="text-red-400 font-semibold text-sm">{t('recordingConversation')}</p>
              <div className="flex items-center justify-center gap-2"><div className="flex items-center gap-0.5 h-8">{[...Array(7)].map((_,i) => <div key={i} className="waveform-bar bg-red-400/80" style={{animationDelay:`${i*0.15}s`}} />)}</div>
              <span className="text-red-400 font-mono text-lg font-bold tabular-nums">{formatTime(recordingTime)}</span></div></div>
          ) : <p className="text-gray-400 text-sm font-medium">{t('tapToRecord')}</p>}
          {!isRecording && !isTranscribing && !isProcessingFhir && (
            <div className="w-full mt-6 pt-5 border-t border-white/5 flex flex-col gap-3">
              <p className="text-center text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">{t('tryDemoConversation')}</p>
              <select value={selectedDemo} onChange={(e) => setSelectedDemo(e.target.value)} className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50 transition-colors">
                {DEMO_SCRIPTS.map(s => <option key={s.id} value={s.text} className="bg-gray-900">{s.title}</option>)}
              </select>
              <button onClick={() => handleFhirProcessing(selectedDemo, true)} className="w-full bg-white/[0.05] hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 group">
                <Zap size={16} className="text-yellow-400 group-hover:scale-110 transition-transform" /> {t('runDemoScript')}
              </button>
            </div>
          )}
        </div>

        {error && <div className="animate-fade-in-up flex items-start gap-3 glass-card p-4 border-red-500/20 bg-red-500/5"><AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" /><p className="text-red-300 text-sm font-medium flex-1">{error}</p><button onClick={() => setError('')} className="text-red-400/50 hover:text-red-400"><XCircle size={16} /></button></div>}
        {saveSuccess && <div className="animate-fade-in-up flex items-center gap-3 glass-card p-4 border-emerald-500/20 bg-emerald-500/5"><CheckCircle2 size={18} className="text-emerald-400" /><p className="text-emerald-300 text-sm font-medium">{t('reportSavedSuccess')}</p><button onClick={() => setSaveSuccess(false)} className="text-emerald-400/50 hover:text-emerald-400 ml-auto"><XCircle size={16} /></button></div>}

        {isTranscribing && <div className="glass-card p-5 animate-fade-in-up"><div className="flex items-center gap-3"><Loader2 className="animate-spin text-indigo-400" size={20} /><div><p className="text-indigo-300 font-semibold text-sm">{t('transcribingWithGemini')}</p><p className="text-gray-500 text-xs">{t('processingAudio')}</p></div></div><div className="mt-3 space-y-2"><div className="loading-shimmer h-3 w-full" /><div className="loading-shimmer h-3 w-4/5" /><div className="loading-shimmer h-3 w-3/5" /></div></div>}

        {transcript && <div className="glass-card p-5 space-y-3 animate-fade-in-up"><div className="flex items-center justify-between"><h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><FileText size={14} className="text-indigo-400" />{t('transcript')}</h2>{transcriptionTimeMs > 0 && <span className="metric-badge bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"><Zap size={10} /> {(transcriptionTimeMs/1000).toFixed(1)}s</span>}</div><p className="text-gray-300 leading-relaxed text-sm">{transcript}</p></div>}

        {isProcessingFhir && <div className="glass-card p-5 animate-fade-in-up"><div className="flex items-center gap-3"><Loader2 className="animate-spin text-purple-400" size={20} /><div><p className="text-purple-300 font-semibold text-sm">{t('extractingEntities')}</p><p className="text-gray-500 text-xs">{t('generatingFhir')}</p></div></div><div className="mt-3 grid grid-cols-2 gap-2">{[1,2,3,4].map(i => <div key={i} className="loading-shimmer h-20 rounded-xl" />)}</div></div>}

        {structuredNotes && editedNotes && <ClinicalNotesSection structuredNotes={structuredNotes} editedNotes={editedNotes} isEditing={isEditing} setEditedNotes={setEditedNotes} setStructuredNotes={setStructuredNotes} setIsEditing={setIsEditing} handleDownloadPdf={handleDownloadPdf} saveSuccess={saveSuccess} userRole={userProfile?.role} onSave={() => setShowSaveModal(true)} fhirData={fhirData} setFhirData={setFhirData} rebuildFhirFromNotes={rebuildFhirFromNotes} />}

        {validationResult && <ValidationSection validationResult={validationResult} showValidation={showValidation} setShowValidation={setShowValidation} />}

        {fhirData && <FhirJsonSection fhirData={fhirData} showFhirJson={showFhirJson} setShowFhirJson={setShowFhirJson} />}

        {totalTimeMs > 0 && <SpeedMetrics transcriptionTimeMs={transcriptionTimeMs} fhirTimeMs={fhirTimeMs} totalTimeMs={totalTimeMs} />}

        <div className="text-center py-4"><p className="text-[10px] text-gray-600">{t('footer')}</p></div>
      </div>

      {/* Hidden printable report for PDF */}
      {structuredNotes && (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
          <PrintablePDFReport report={pdfReport} />
        </div>
      )}

      {showSaveModal && <SaveModal patientName={patientName} setPatientName={setPatientName} patientEmail={patientEmail} setPatientEmail={setPatientEmail} isSaving={isSaving} onSave={handleSaveReport} onClose={() => setShowSaveModal(false)} />}
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

  const inp = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-indigo-500/50 transition-colors placeholder:text-gray-600";

  return (
    <div className="space-y-3 animate-fade-in-up">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><ClipboardList size={14} className="text-emerald-400" />{t('structuredClinicalNotes')}</h2>
        <div className="flex gap-2">
          {isEditing ? <button onClick={() => { setStructuredNotes(editedNotes); setFhirData(rebuildFhirFromNotes(editedNotes, fhirData)); setIsEditing(false); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/20 rounded-md hover:bg-emerald-500/30 transition-colors"><Save size={14} /> {t('saveEdits')}</button>
            : <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-300 bg-white/5 rounded-md hover:bg-white/10 transition-colors"><Edit3 size={14} /> {t('edit')}</button>}
          {!isEditing && <>
            <button onClick={handleDownloadPdf} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-300 bg-indigo-500/20 rounded-md hover:bg-indigo-500/30 transition-colors"><Download size={14} /> {t('pdf')}</button>
            {!saveSuccess && userRole === 'doctor' && <button onClick={onSave} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-300 bg-purple-500/20 rounded-md hover:bg-purple-500/30 transition-colors" id="save-report-btn"><UserPlus size={14} /> {t('save')}</button>}
          </>}
        </div>
      </div>
      <div className="space-y-3 bg-[#0f0f1a] p-2 rounded-xl">
        {/* Chief Complaint */}
        {(editedNotes.chief_complaint || isEditing) && <NoteSection icon={<AlertCircle size={13} className="text-amber-400" />} title={t('chiefComplaint')} color="amber" value={isEditing ? editedNotes.chief_complaint : structuredNotes.chief_complaint} isEditing={isEditing} onChange={(v:string) => setEditedNotes({...editedNotes, chief_complaint: v})} />}
        {/* History */}
        {(editedNotes.history_of_present_illness || isEditing) && <NoteSection icon={<FileText size={13} className="text-blue-400" />} title={t('historyOfPresentIllness')} color="blue" value={isEditing ? editedNotes.history_of_present_illness : structuredNotes.history_of_present_illness} isEditing={isEditing} onChange={(v:string) => setEditedNotes({...editedNotes, history_of_present_illness: v})} />}

        {/* Vitals — Editable */}
        {(editedNotes.vitals?.length > 0 || isEditing) && <div className="clinical-section">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-lg bg-rose-500/10 flex items-center justify-center"><Heart size={13} className="text-rose-400" /></div><h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider">{t('vitals')}</h3></div>
            {isEditing && <button onClick={addVital} className="text-[10px] font-bold text-rose-300 hover:text-rose-200 transition-colors"><Plus size={12} className="inline" /> {t('addVital')}</button>}
          </div>
          {isEditing ? (
            <div className="space-y-2">{(editedNotes.vitals || []).map((v:any, i:number) => (
              <div key={i} className="flex items-center gap-2">
                <input className={inp} placeholder={t('vitalName')} value={v.name} onChange={e => updateVital(i, 'name', e.target.value)} />
                <input className={inp} placeholder={t('value')} value={v.value} onChange={e => updateVital(i, 'value', e.target.value)} style={{maxWidth:'80px'}} />
                <input className={inp} placeholder={t('unit')} value={v.unit} onChange={e => updateVital(i, 'unit', e.target.value)} style={{maxWidth:'60px'}} />
                <button onClick={() => removeVital(i)} className="p-1 text-red-400/50 hover:text-red-400 shrink-0"><Trash2 size={14} /></button>
              </div>))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">{editedNotes.vitals.map((v:any,i:number) => <div key={i} className="flex items-center gap-2 bg-white/[0.02] rounded-xl p-3 border border-white/5"><Thermometer size={14} className="text-rose-400/60 shrink-0" /><div className="min-w-0"><p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold truncate">{v.name}</p><p className="text-sm text-white font-bold">{v.value} <span className="text-gray-500 text-xs font-normal">{v.unit}</span></p></div></div>)}</div>
          )}
        </div>}

        {/* Examination Findings */}
        {(editedNotes.examination_findings || isEditing) && <NoteSection icon={<Activity size={13} className="text-cyan-400" />} title={t('examinationFindings')} color="cyan" value={isEditing ? editedNotes.examination_findings : structuredNotes.examination_findings} isEditing={isEditing} onChange={(v:string) => setEditedNotes({...editedNotes, examination_findings: v})} />}

        {/* Diagnoses — Editable */}
        {(editedNotes.diagnoses?.length > 0 || isEditing) && <div className="clinical-section">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-lg bg-orange-500/10 flex items-center justify-center"><Stethoscope size={13} className="text-orange-400" /></div><h3 className="text-xs font-bold text-orange-300 uppercase tracking-wider">{t('diagnoses')}</h3></div>
            {isEditing && <button onClick={addDx} className="text-[10px] font-bold text-orange-300 hover:text-orange-200 transition-colors"><Plus size={12} className="inline" /> {t('addDiagnosis')}</button>}
          </div>
          {isEditing ? (
            <div className="space-y-2">{(editedNotes.diagnoses || []).map((dx:any, i:number) => (
              <div key={i} className="flex items-center gap-2">
                <input className={inp} placeholder={t('diagnosisName')} value={dx.name} onChange={e => updateDx(i, 'name', e.target.value)} />
                <input className={inp} placeholder={t('icdCode')} value={dx.icd_code} onChange={e => updateDx(i, 'icd_code', e.target.value)} style={{maxWidth:'80px'}} />
                <select className={inp + ' max-w-[80px]'} value={dx.severity || 'mild'} onChange={e => updateDx(i, 'severity', e.target.value)}>
                  <option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option>
                </select>
                <button onClick={() => removeDx(i)} className="p-1 text-red-400/50 hover:text-red-400 shrink-0"><Trash2 size={14} /></button>
              </div>))}
            </div>
          ) : (
            <div className="space-y-2">{editedNotes.diagnoses.map((dx:any,i:number) => <div key={i} className="flex items-center justify-between bg-white/[0.02] rounded-xl p-3 border border-white/5"><div className="flex items-center gap-2 min-w-0 flex-1"><div className={`w-2 h-2 rounded-full shrink-0 ${dx.severity?.toLowerCase()==='severe'?'bg-red-400':dx.severity?.toLowerCase()==='moderate'?'bg-yellow-400':'bg-green-400'}`} /><span className="text-sm text-gray-200 truncate">{dx.name}</span></div>{dx.icd_code && <span className="metric-badge bg-orange-500/10 text-orange-300 text-[10px] border border-orange-500/20 shrink-0 ml-2">{dx.icd_code}</span>}</div>)}</div>
          )}
        </div>}

        {/* Medications — Fully Editable */}
        {(editedNotes.medications?.length > 0 || isEditing) && <div className="clinical-section">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Pill size={13} className="text-emerald-400" /></div><h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">{t('medications')}</h3></div>
            {isEditing && <button onClick={addMed} className="text-[10px] font-bold text-emerald-300 hover:text-emerald-200 transition-colors"><Plus size={12} className="inline" /> {t('addMedication')}</button>}
          </div>
          {isEditing ? (
            <div className="space-y-3">{(editedNotes.medications || []).map((m:any, i:number) => (
              <div key={i} className="bg-white/[0.02] rounded-xl p-3 border border-white/5 space-y-2">
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
              </div>))}
            </div>
          ) : (
            <div className="space-y-2">{editedNotes.medications.map((m:any,i:number) => <div key={i} className="bg-white/[0.02] rounded-xl p-3 border border-white/5"><p className="text-sm text-white font-semibold">{m.name}</p><div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">{m.dosage && <span className="text-[11px] text-gray-400">{m.dosage}</span>}{m.frequency && <span className="text-[11px] text-emerald-400/70">• {m.frequency}</span>}{m.duration && <span className="text-[11px] text-purple-400/70">• {m.duration}</span>}{m.route && <span className="text-[11px] text-cyan-400/70">• {m.route}</span>}</div></div>)}</div>
          )}
        </div>}

        {/* Follow-up */}
        {(editedNotes.follow_up || isEditing) && <NoteSection icon={<RefreshCw size={13} className="text-indigo-400" />} title={t('followUp')} color="indigo" value={isEditing ? editedNotes.follow_up : structuredNotes.follow_up} isEditing={isEditing} onChange={(v:string) => setEditedNotes({...editedNotes, follow_up: v})} />}
        {/* Advice */}
        {(editedNotes.advice || isEditing) && <NoteSection icon={<ClipboardList size={13} className="text-teal-400" />} title={t('advice')} color="teal" value={isEditing ? editedNotes.advice : structuredNotes.advice} isEditing={isEditing} onChange={(v:string) => setEditedNotes({...editedNotes, advice: v})} />}

        {/* Custom Fields */}
        {(editedNotes.custom_fields?.length > 0 || isEditing) && <div className="clinical-section">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-lg bg-violet-500/10 flex items-center justify-center"><Plus size={13} className="text-violet-400" /></div><h3 className="text-xs font-bold text-violet-300 uppercase tracking-wider">{t('customFields')}</h3></div>
            {isEditing && <button onClick={addCustomField} className="text-[10px] font-bold text-violet-300 hover:text-violet-200 transition-colors"><Plus size={12} className="inline" /> {t('addCustomField')}</button>}
          </div>
          {isEditing ? (
            <div className="space-y-2">{(editedNotes.custom_fields || []).map((cf:any, i:number) => (
              <div key={i} className="flex items-center gap-2">
                <input className={inp} placeholder={t('fieldName')} value={cf.name} onChange={e => updateCustomField(i, 'name', e.target.value)} />
                <input className={inp + ' flex-1'} placeholder={t('fieldValue')} value={cf.value} onChange={e => updateCustomField(i, 'value', e.target.value)} />
                <button onClick={() => removeCustomField(i)} className="p-1 text-red-400/50 hover:text-red-400 shrink-0"><Trash2 size={14} /></button>
              </div>))}
            </div>
          ) : (
            <div className="space-y-2">{(editedNotes.custom_fields || []).map((cf:any, i:number) => (
              <div key={i} className="bg-white/[0.02] rounded-xl p-3 border border-white/5">
                <p className="text-[10px] text-violet-400/70 uppercase tracking-wider font-semibold">{cf.name}</p>
                <p className="text-sm text-gray-200 mt-1">{cf.value}</p>
              </div>))}
            </div>
          )}
        </div>}

        {/* Add Custom Field button when editing and no custom fields yet */}
        {isEditing && (!editedNotes.custom_fields || editedNotes.custom_fields.length === 0) && (
          <button onClick={addCustomField} className="w-full py-3 rounded-xl text-xs font-bold text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 transition-colors flex items-center justify-center gap-2">
            <Plus size={14} /> {t('addCustomField')}
          </button>
        )}
      </div>
    </div>
  );
}

function NoteSection({ icon, title, color, value, isEditing, onChange }: any) {
  return (
    <div className="clinical-section">
      <div className="flex items-center gap-2 mb-2"><div className={`w-6 h-6 rounded-lg bg-${color}-500/10 flex items-center justify-center`}>{icon}</div><h3 className={`text-xs font-bold text-${color}-300 uppercase tracking-wider`}>{title}</h3></div>
      {isEditing ? <textarea className={`w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-gray-200 outline-none focus:border-${color}-500/50 min-h-[80px]`} value={value || ''} onChange={(e) => onChange(e.target.value)} />
        : <p className="text-gray-300 text-sm leading-relaxed">{value}</p>}
    </div>
  );
}

function ValidationSection({ validationResult, showValidation, setShowValidation }: any) {
  const { t } = useLanguage();
  return (
    <div className="animate-fade-in-up">
      <button onClick={() => setShowValidation(!showValidation)} className="w-full glass-card p-4 flex items-center justify-between hover:bg-white/[0.06] transition-colors" id="validation-toggle">
        <div className="flex items-center gap-3"><Shield size={16} className={validationResult.is_valid ? 'text-emerald-400' : 'text-amber-400'} /><div className="text-left"><p className="text-xs font-bold text-gray-300">{t('fhirValidation')}: {validationResult.is_valid ? <span className="text-emerald-400">{t('passed')}</span> : <span className="text-amber-400">{validationResult.errors.length} {t('errors')}</span>}</p><p className="text-[10px] text-gray-500">{validationResult.total_entries} {t('resources')} • {validationResult.warnings.length} {t('warnings')}</p></div></div>
        {showValidation ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>
      {showValidation && <div className="glass-card mt-1 p-4 space-y-3 rounded-t-none border-t-0">
        <div className="flex flex-wrap gap-1.5">{Object.entries(validationResult.resource_summary).map(([t,c]) => <span key={t} className="metric-badge bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px]">{t}: {c as number}</span>)}</div>
        {validationResult.errors.length > 0 && <div className="space-y-1"><p className="text-[10px] font-bold text-red-400 uppercase">Errors</p>{validationResult.errors.map((e:string,i:number) => <div key={i} className="flex items-start gap-1.5"><XCircle size={10} className="text-red-400 shrink-0 mt-1" /><p className="text-xs text-red-300/80">{e}</p></div>)}</div>}
        {validationResult.warnings.length > 0 && <div className="space-y-1"><p className="text-[10px] font-bold text-amber-400 uppercase">Warnings</p>{validationResult.warnings.map((w:string,i:number) => <div key={i} className="flex items-start gap-1.5"><AlertCircle size={10} className="text-amber-400 shrink-0 mt-1" /><p className="text-xs text-amber-300/80">{w}</p></div>)}</div>}
        {validationResult.is_valid && validationResult.warnings.length === 0 && <div className="flex items-center gap-2 text-emerald-400"><CheckCircle2 size={14} /><p className="text-xs font-medium">{t('allChecksPassed')}</p></div>}
      </div>}
    </div>
  );
}

function FhirJsonSection({ fhirData, showFhirJson, setShowFhirJson }: any) {
  const { t } = useLanguage();
  return (
    <div className="animate-fade-in-up">
      <button onClick={() => setShowFhirJson(!showFhirJson)} className="w-full glass-card p-4 flex items-center justify-between hover:bg-white/[0.06] transition-colors" id="fhir-json-toggle">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Stethoscope size={14} className="text-purple-400" />{t('fhirBundle')}</h2>
        {showFhirJson ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>
      {showFhirJson && <div className="glass-card mt-1 p-0.5 rounded-t-none border-t-0"><div className="fhir-json-viewer"><pre className="text-emerald-300/90 whitespace-pre-wrap break-words">{JSON.stringify(fhirData, null, 2)}</pre></div></div>}
    </div>
  );
}

function SpeedMetrics({ transcriptionTimeMs, fhirTimeMs, totalTimeMs }: any) {
  const { t } = useLanguage();
  return (
    <div className="glass-card p-4 animate-fade-in-up">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Clock size={14} className="text-gray-500" /><span className="text-[11px] text-gray-500 font-medium">{t('pipelineSpeed')}</span></div><span className="text-[11px] text-gray-400 font-bold tabular-nums">{t('total')}: {(totalTimeMs/1000).toFixed(1)}s</span></div>
      <div className="mt-3 flex gap-2">
        <div className="flex-1 bg-indigo-500/10 rounded-lg p-2.5 border border-indigo-500/10"><p className="text-[9px] text-indigo-400/70 uppercase font-bold tracking-wider">{t('transcription')}</p><p className="text-lg text-indigo-300 font-bold tabular-nums">{(transcriptionTimeMs/1000).toFixed(1)}<span className="text-xs font-normal text-indigo-400/50">s</span></p></div>
        <div className="flex-1 bg-purple-500/10 rounded-lg p-2.5 border border-purple-500/10"><p className="text-[9px] text-purple-400/70 uppercase font-bold tracking-wider">{t('fhirNotes')}</p><p className="text-lg text-purple-300 font-bold tabular-nums">{(fhirTimeMs/1000).toFixed(1)}<span className="text-xs font-normal text-purple-400/50">s</span></p></div>
      </div>
      <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden flex"><div className="bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-l-full transition-all duration-500" style={{width:`${(transcriptionTimeMs/totalTimeMs)*100}%`}} /><div className="bg-gradient-to-r from-purple-500 to-purple-400 rounded-r-full transition-all duration-500" style={{width:`${(fhirTimeMs/totalTimeMs)*100}%`}} /></div>
    </div>
  );
}

function SaveModal({ patientName, setPatientName, patientEmail, setPatientEmail, isSaving, onSave, onClose }: any) {
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="glass-card p-6 w-full max-w-sm space-y-5 animate-fade-in-up border border-white/10">
        <h3 className="text-lg font-bold text-white text-center">{t('saveReport')}</h3>
        <p className="text-xs text-gray-400 text-center">{t('linkConsultation')}</p>
        <div className="space-y-3">
          <input type="text" placeholder={t('patientNameRequired')} value={patientName} onChange={(e) => setPatientName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder:text-gray-600 outline-none focus:border-purple-500/50 transition-colors" id="patient-name-input" />
          <input type="email" placeholder={t('patientEmailOptional')} value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder:text-gray-600 outline-none focus:border-purple-500/50 transition-colors" id="patient-email-input" />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-400 bg-white/5 hover:bg-white/10 transition-colors">{t('cancel')}</button>
          <button onClick={onSave} disabled={!patientName.trim() || isSaving} className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50" id="confirm-save-btn">
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{isSaving ? t('saving') : t('saveReport')}
          </button>
        </div>
      </div>
    </div>
  );
}
