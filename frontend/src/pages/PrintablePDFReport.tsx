/**
 * PrintablePDFReport — A white-background, professional clinical report
 * rendered offscreen and captured by html2pdf for high-quality PDF output.
 */

interface PrintablePDFReportProps {
  report: {
    patientName?: string;
    doctorName?: string;
    createdAt?: string;
    structuredNotes?: any;
    fhirBundle?: any;
    transcript?: string;
  };
}

export default function PrintablePDFReport({ report }: PrintablePDFReportProps) {
  const notes = report.structuredNotes;
  const formatDate = (ts: any) => {
    const d = typeof ts === 'string' ? new Date(ts) : new Date();
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(d);
  };

  return (
    <div
      id="pdf-print-area"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '20mm 18mm',
        backgroundColor: '#ffffff',
        color: '#1a1a1a',
        fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
        fontSize: '11pt',
        lineHeight: '1.6',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottom: '3px solid #4f46e5',
        paddingBottom: '14px',
        marginBottom: '20px',
      }}>
        <div>
          <h1 style={{
            fontSize: '20pt',
            fontWeight: 700,
            color: '#4f46e5',
            margin: 0,
            letterSpacing: '-0.5px',
          }}>
            Clinical Report
          </h1>
          <p style={{ fontSize: '9pt', color: '#6b7280', margin: '4px 0 0 0' }}>
            FHIR R4 Compliant • AI-Assisted Documentation
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '9pt', color: '#6b7280', margin: 0 }}>
            Generated: {formatDate(report.createdAt)}
          </p>
        </div>
      </div>

      {/* Patient & Doctor Info */}
      <div style={{
        display: 'flex',
        gap: '20px',
        marginBottom: '22px',
        padding: '14px 16px',
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '8pt', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px', margin: '0 0 4px 0' }}>Patient</p>
          <p style={{ fontSize: '13pt', fontWeight: 600, color: '#1e293b', margin: 0 }}>{report.patientName || 'N/A'}</p>
        </div>
        {report.doctorName && (
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '8pt', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px', margin: '0 0 4px 0' }}>Attending Physician</p>
            <p style={{ fontSize: '13pt', fontWeight: 600, color: '#1e293b', margin: 0 }}>Dr. {report.doctorName}</p>
          </div>
        )}
      </div>

      {notes && (
        <>
          {/* Chief Complaint */}
          {notes.chief_complaint && (
            <Section title="Chief Complaint" color="#f59e0b">
              <p style={{ margin: 0 }}>{notes.chief_complaint}</p>
            </Section>
          )}

          {/* History of Present Illness */}
          {notes.history_of_present_illness && (
            <Section title="History of Present Illness" color="#3b82f6">
              <p style={{ margin: 0 }}>{notes.history_of_present_illness}</p>
            </Section>
          )}

          {/* Vitals */}
          {notes.vitals?.length > 0 && (
            <Section title="Vitals" color="#ef4444">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {notes.vitals.map((v: any, i: number) => (
                  <div key={i} style={{
                    backgroundColor: '#fff1f2',
                    border: '1px solid #fecdd3',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    minWidth: '120px',
                  }}>
                    <p style={{ fontSize: '8pt', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700, margin: '0 0 2px 0' }}>{v.name}</p>
                    <p style={{ fontSize: '13pt', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                      {v.value} <span style={{ fontSize: '9pt', color: '#6b7280', fontWeight: 400 }}>{v.unit}</span>
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Examination Findings */}
          {notes.examination_findings && (
            <Section title="Examination Findings" color="#06b6d4">
              <p style={{ margin: 0 }}>{notes.examination_findings}</p>
            </Section>
          )}

          {/* Diagnoses */}
          {notes.diagnoses?.length > 0 && (
            <Section title="Diagnoses" color="#f97316">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #e2e8f0', fontSize: '8pt', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.5px' }}>Diagnosis</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '2px solid #e2e8f0', fontSize: '8pt', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.5px' }}>ICD Code</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px', borderBottom: '2px solid #e2e8f0', fontSize: '8pt', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.5px' }}>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {notes.diagnoses.map((dx: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{dx.name}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        {dx.icd_code && (
                          <span style={{
                            backgroundColor: '#fff7ed',
                            color: '#c2410c',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '9pt',
                            fontWeight: 600,
                            border: '1px solid #fed7aa',
                          }}>{dx.icd_code}</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{
                          color: dx.severity?.toLowerCase() === 'severe' ? '#dc2626' : dx.severity?.toLowerCase() === 'moderate' ? '#d97706' : '#16a34a',
                          fontWeight: 600,
                          fontSize: '9pt',
                        }}>{dx.severity || '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* Medications */}
          {notes.medications?.length > 0 && (
            <Section title="Medications Prescribed" color="#10b981">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0fdf4' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #d1fae5', fontSize: '8pt', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.5px' }}>Medication</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #d1fae5', fontSize: '8pt', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.5px' }}>Dosage</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #d1fae5', fontSize: '8pt', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.5px' }}>Frequency</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #d1fae5', fontSize: '8pt', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.5px' }}>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {notes.medications.map((m: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{m.name}</td>
                      <td style={{ padding: '8px 12px' }}>{m.dosage || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{m.frequency || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{m.duration || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* Follow-up */}
          {notes.follow_up && (
            <Section title="Follow-up" color="#6366f1">
              <p style={{ margin: 0 }}>{notes.follow_up}</p>
            </Section>
          )}

          {/* Advice */}
          {notes.advice && (
            <Section title="Advice" color="#14b8a6">
              <p style={{ margin: 0 }}>{notes.advice}</p>
            </Section>
          )}
        </>
      )}

      {/* Transcript */}
      {report.transcript && (
        <Section title="Conversation Transcript" color="#8b5cf6">
          <p style={{ margin: 0, fontSize: '10pt', color: '#4b5563' }}>{report.transcript}</p>
        </Section>
      )}

      {/* Footer */}
      <div style={{
        marginTop: '30px',
        paddingTop: '14px',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '8pt',
        color: '#9ca3af',
      }}>
        <span>FHIR Scribe — AI-Assisted Clinical Documentation</span>
        <span>Confidential Medical Record</span>
      </div>
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '10px',
      }}>
        <div style={{
          width: '4px',
          height: '18px',
          backgroundColor: color,
          borderRadius: '2px',
        }} />
        <h2 style={{
          fontSize: '11pt',
          fontWeight: 700,
          color: '#1e293b',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          margin: 0,
        }}>{title}</h2>
      </div>
      <div style={{ paddingLeft: '12px' }}>
        {children}
      </div>
    </div>
  );
}
