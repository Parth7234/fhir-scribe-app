# AI Ambient Scribe — Mobile-First FHIR Clinical Notes

> **PS-1**: Mobile-First Ambient AI Scribe with Real-Time FHIR Conversion  
> **Team Eclipse** — Parth Singla (2401CS18) · Aditya Raj (2401MC56) · Aryan (2401CS48) · Manish Kumar (2401EE08)

A **production-deployed**, mobile-first AI-powered clinical documentation tool that converts doctor-patient conversations into structured, **FHIR R4-compliant clinical data** in real-time. Supports **Hindi, English, and Hinglish** with a full **Hindi/English UI toggle** — designed for Indian healthcare settings.

🌐 **Live App**: Frontend on [Vercel](https://vercel.com) · Backend on [Render](https://render.com)

---

## Screenshots

<p align="center">
  <img src="screenshots/login.png" alt="Doctor Login" width="250"/>
  &nbsp;&nbsp;
  <img src="screenshots/main.png" alt="Recording & Transcript" width="250"/>
  &nbsp;&nbsp;
  <img src="screenshots/clinical_notes.png" alt="Structured Clinical Notes" width="250"/>
  &nbsp;&nbsp;
  <img src="screenshots/fhir_bundle.png" alt="FHIR R4 Bundle & Validation" width="250"/>
</p>

---

## Proposed Approach & Solution

Indian healthcare faces a critical documentation bottleneck — doctors in Tier 2/3 cities spend nearly 30–40% of their consultation time manually writing notes, often in a mix of Hindi and English (Hinglish). This unstructured, paper-based workflow makes it nearly impossible to generate interoperable health records that comply with modern standards like HL7 FHIR R4. Existing voice-to-text solutions predominantly support English and lack clinical context understanding, making them ineffective for the Indian healthcare landscape.

Our solution, **AI Ambient Scribe**, is a mobile-first web application that passively listens to doctor-patient conversations in real-time and automatically produces structured, FHIR R4-compliant clinical documentation — all from a single tap on the doctor's phone.

The system works in a three-stage pipeline:

1. **Audio Capture & Transcription** — The recorded audio (captured via the browser's MediaRecorder API as WebM) is sent to the FastAPI backend, where **Google Gemini 2.5 Flash** performs multilingual transcription with automatic speaker diarization, accurately tagging each line as "Doctor" or "Patient" — even in code-mixed Hinglish conversations.

2. **AI-Powered Clinical Extraction** — The transcript is processed by two parallel **Gemini 2.5 Flash Lite** pipelines: one generates structured clinical notes (Chief Complaint, HPI, Vitals, Diagnoses with ICD-10 codes, Medications with RxNorm codes, Follow-up, and Advice), while the other maps clinical entities to a full **FHIR R4 Bundle** containing Patient, Encounter, Observation, Condition, and MedicationRequest resources with proper SNOMED-CT, LOINC, and RxNorm coding.

3. **Validation & Save** — The generated bundle is automatically validated against the FHIR R4 schema, and results are displayed with a pass/fail badge. The doctor can then **fully edit** every field (including individual medication dosage, frequency, duration, route, and custom fields), **save reports** linked to patients in the hospital's **Supabase** database, and **download** a polished prescription PDF.

Authentication is handled by **Supabase Auth** with separate Doctor and Patient Database flows. Doctors register with email verification and manage a hospital patient database — patients are registered by the hospital and accessed via email + hospital-assigned password. All API endpoints are secured with Supabase JWT verification (ES256). The frontend is deployed on **Vercel** and the backend on **Render**, making the app instantly accessible from any mobile browser.

---

## Features

| Feature | Description |
|---------|-------------|
| 🎤 **Hinglish Voice-to-Text** | Real-time transcription with **Doctor/Patient speaker tags** (diarization) using Gemini 2.5 Flash |
| 🌐 **Multilingual Support** | Hindi, English, and Hinglish (code-mixed) audio with language selector |
| 🇮🇳 **Hindi/English UI Toggle** | Full app UI available in Hindi and English with one-click toggle (150+ translated strings) |
| 📋 **Structured Clinical Notes** | Auto-extracted: Chief Complaint, HPI, Vitals, Diagnoses (ICD-10), Medications (RxNorm), Follow-up, Advice |
| ✏️ **Fully Editable Reports** | Edit every field inline — including individual medication name, dosage, frequency, duration, route, vitals, and diagnoses |
| ➕ **Custom Fields** | Doctors can add custom name/value fields to any clinical report during editing |
| 🔄 **Live FHIR Sync** | Edits to clinical notes automatically rebuild the FHIR R4 JSON bundle in real-time |
| 📄 **Downloadable PDF** | One-click polished A4 prescription PDF generation using html2pdf.js |
| 🏥 **FHIR R4 Bundle** | Patient, Encounter, Observation, Condition, MedicationRequest, DocumentReference resources |
| ✅ **FHIR Validation** | Real-time validation against R4 schema with coding system checks (SNOMED, ICD-10, LOINC, RxNorm) |
| ⚡ **Pipeline Speed Metrics** | Transcription + FHIR processing time displayed in real-time |
| 🔐 **Supabase Authentication** | Role-based auth (Doctor/Patient) with email verification and JWT-secured API |
| 🩺 **Doctor Dashboard** | Track patients, view report history, share reports with other doctors, start new consultations |
| 🏥 **Hospital Patient Database** | Register patients into the hospital database; access records via email + hospital password |
| 💾 **Report Saving** | Save consultation reports to Supabase, linked to patients by name/email |
| 📱 **Mobile-First PWA** | Glassmorphism dark theme, responsive design, installable on any phone |
| 🚀 **Production Deployed** | Frontend on **Vercel**, Backend on **Render** |
| 🎬 **Demo Scripts** | Built-in demo conversations (Viral Fever Hinglish, Diabetes English, Hypertension Hindi) for instant testing |

---

## Architecture

```mermaid
graph LR
    A[📱 Mobile Browser] -->|Audio WebM| C[FastAPI Backend]
    A -->|Supabase JWT| C
    C --> D[Gemini 2.5 Flash<br>Transcription]
    D --> E[Gemini 2.5 Flash Lite<br>FHIR Mapper]
    D --> F[Gemini 2.5 Flash Lite<br>Clinical Notes]
    E --> G[FHIR R4 Validator]
    E --> A
    F --> A
    G --> A
    A -->|Save Report| H[(Supabase PostgreSQL)]
    H -->|Fetch Records| A
    A -->|Auth| I[Supabase Auth]
```

### Pipeline Flow

```
🎤 Audio (WebM) → 📝 Hinglish Transcript → 📋 Structured Notes → 🏥 FHIR R4 Bundle → ✅ Validation → 💾 Supabase
                                                      ↕ Doctor Edits ↕                      ↕ Auto-Sync ↕
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + TypeScript + Vite + Tailwind CSS |
| **Backend** | Python FastAPI + Uvicorn |
| **AI Engine** | Google Gemini 2.5 Flash (Transcription) + Gemini 2.5 Flash Lite (FHIR + Notes) |
| **Authentication** | Supabase Auth (Email/Password, ES256 JWT, email verification) |
| **Database** | Supabase (PostgreSQL — profiles, reports, shared reports) |
| **Data Standard** | HL7 FHIR R4 |
| **Internationalization** | Custom i18n system (English + Hindi, 150+ strings) |
| **PDF Generation** | html2pdf.js |
| **Frontend Hosting** | Vercel |
| **Backend Hosting** | Render |
| **Design** | Glassmorphism dark theme, mobile-first responsive |

---

## Quick Start

### Prerequisites
- **Node.js** 18+
- **Python** 3.10+
- **Gemini API Key** — [Get one here](https://aistudio.google.com/apikey)
- **Supabase Project** — [Create one here](https://supabase.com/dashboard)

### 1. Supabase Setup

1. Create a new project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Enable **Email/Password** sign-in (Authentication → Providers → Email)
3. Run the following SQL in the SQL Editor to create required tables:

```sql
-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('doctor', 'patient')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports table
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_name TEXT,
  patient_name TEXT NOT NULL,
  patient_email TEXT,
  transcript TEXT,
  structured_notes JSONB,
  fhir_bundle JSONB,
  language TEXT DEFAULT 'hi-en',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shared reports table
CREATE TABLE shared_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  shared_by UUID REFERENCES profiles(id),
  shared_with_email TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow authenticated users full access)
CREATE POLICY "Authenticated users can manage profiles" ON profiles
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage reports" ON reports
  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage shared_reports" ON shared_reports
  FOR ALL USING (auth.uid() IS NOT NULL);
```

4. Note your **Project URL**, **Anon Key**, and **JWT Secret** from Project Settings → API

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cat > .env << EOF
GEMINI_API_KEY=your_gemini_api_key_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=your_jwt_secret_here
EOF

# Start server
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cat > .env << EOF
VITE_API_URL=http://localhost:8000/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
EOF

# Start dev server
npm run dev
```

### 4. Open the app
Navigate to **http://localhost:5173** — register as a Doctor or register a Patient into the hospital database!

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/` | ❌ | Health check |
| `POST` | `/api/transcribe/?language=hi-en` | 🔐 | Audio → Text transcription |
| `POST` | `/api/fhir/` | 🔐 | Transcript → FHIR Bundle + Structured Notes |
| `POST` | `/api/fhir/validate` | 🔐 | Validate a FHIR R4 Bundle |

All protected endpoints require a valid `Authorization: Bearer <supabase_jwt>` header.

---

## Project Structure

```
fhir-scribe-app/
├── backend/
│   ├── main.py                 # FastAPI app with CORS & logging
│   ├── requirements.txt        # Python dependencies
│   ├── render.yaml             # Render deployment config
│   ├── .env                    # GEMINI_API_KEY + SUPABASE_URL + SUPABASE_JWT_SECRET
│   └── services/
│       ├── auth.py             # Supabase JWT verification (ES256 via JWKS)
│       ├── transcription.py    # Audio → text (Gemini 2.5 Flash + multilingual + diarization)
│       ├── fhir_mapper.py      # Text → FHIR R4 + structured notes (Gemini 2.5 Flash Lite)
│       └── fhir_validator.py   # FHIR R4 validation engine
├── frontend/
│   ├── index.html              # PWA-ready HTML
│   ├── vercel.json             # Vercel deployment config (SPA rewrites)
│   ├── src/
│   │   ├── supabase.ts         # Supabase client initialization
│   │   ├── i18n/
│   │   │   └── translations.ts # English + Hindi translations (150+ strings)
│   │   ├── components/
│   │   │   └── LanguageToggle.tsx # Hindi/English toggle button
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx  # Supabase Auth state, login/register/logout
│   │   │   └── LanguageContext.tsx # i18n language provider with localStorage
│   │   ├── hooks/
│   │   │   └── usePwaInstall.ts # PWA install prompt hook
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx       # Doctor login + Hospital Patient Database access
│   │   │   ├── RegisterPage.tsx    # Doctor registration + Hospital patient registration
│   │   │   ├── DoctorDashboard.tsx # Patient tracking, reports, share with other doctors
│   │   │   ├── PatientDashboard.tsx# Patient medical records view
│   │   │   ├── ScribePage.tsx      # Recording, FHIR pipeline, full editing, FHIR sync
│   │   │   ├── ReportDetailPage.tsx# Full report detail view
│   │   │   └── PrintablePDFReport.tsx # A4 prescription PDF template
│   │   ├── App.tsx             # Router with protected & role-based routes
│   │   ├── App.css             # Custom animations & glassmorphism
│   │   ├── index.css           # Tailwind + base styles
│   │   └── main.tsx            # React entry with AuthProvider + LanguageProvider
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── presentation/               # Hackathon presentation (HTML slides)
├── screenshots/                # App screenshots
└── README.md
```

---

## PS-1 Objectives Mapping

| Objective | Implementation | Status |
|-----------|---------------|--------|
| Capture conversations in real-time (Hindi + English mix) | MediaRecorder API → Gemini 2.5 Flash transcription with Hinglish prompt & speaker diarization | ✅ |
| Convert speech into structured clinical notes | Structured Notes extraction (CC, HPI, Vitals, Dx, Rx, Follow-up, Advice) — all fully editable with add/remove | ✅ |
| Map entities to FHIR resources | Patient, Encounter, Observation, Condition, MedicationRequest with SNOMED/ICD-10/LOINC/RxNorm — auto-synced on edit | ✅ |
| Demonstrate documentation speed improvement | Real-time speed metrics panel showing transcription + FHIR processing times | ✅ |
| Functional Prototype (Mobile App) | Mobile-first PWA deployed on Vercel — works on any phone browser, installable | ✅ |
| FHIR Mapping Layer | Full FHIR R4 Bundle generation with auto-validation engine + live edit sync | ✅ |
| Multilingual Capability | Hindi, English, Hinglish audio + full Hindi/English UI toggle | ✅ |
| Role-Based Access Control | Doctor dashboard + Hospital Patient Database with Supabase Auth (JWT) | ✅ |

---

## Deployment

| Component | Platform | Environment Variables |
|-----------|----------|-----------------------|
| **Frontend** | Vercel | `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| **Backend** | Render | `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `ALLOWED_ORIGINS` |

> **Important**: Set `ALLOWED_ORIGINS` on Render to your Vercel production URL (e.g., `https://your-app.vercel.app`).  
> Update the Supabase **Site URL** and **Redirect URLs** in Authentication → URL Configuration to your production domain.

---

## Team Eclipse

| Member | Roll No |
|--------|---------|
| **Parth Singla** | 2401CS18 |
| **Aditya Raj** | 2401MC56 |
| **Aryan** | 2401CS48 |
| **Manish Kumar** | 2401EE08 |

---
