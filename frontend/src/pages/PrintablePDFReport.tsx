import React from 'react';

/**
 * PrintablePDFReport — A white-background, professional clinical report
 * rendered offscreen and captured by html2pdf for high-quality PDF output.
 * Cohesively styled with the premium Aether Clinical Design System (Matcha Green & Soft Peach).
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

  // Cohesive, professional clinical colors replacing the messy random rainbow
  const colors = {
    matcha: '#56642b',
    matchaLight: '#f4f6f0',
    matchaBorder: '#d3dcd0',
    peachDark: '#7c5637',
    peachLight: '#fdf8f4',
    peachBorder: '#f5e6da',
    charcoal: '#111827',
    neutralDark: '#1e293b',
    neutralLight: '#4b5563',
    borderLight: '#e2e8f0',
    white: '#ffffff',
  };

  return (
    <div
      id="pdf-print-area"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '20mm 18mm',
        backgroundColor: colors.white,
        color: colors.charcoal,
        fontFamily: "'Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
        fontSize: '10.5pt',
        lineHeight: '1.6',
      }}
    >
      {/* Header Letterhead */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderBottom: `2.5px solid ${colors.matcha}`,
        paddingBottom: '16px',
        marginBottom: '24px',
      }}>
        <div>
          <span style={{
            fontSize: '8pt',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            color: colors.peachDark,
            display: 'block',
            marginBottom: '4px'
          }}>
            ScribeFlow Clinical Portal
          </span>
          <h1 style={{
            fontSize: '22pt',
            fontWeight: 800,
            color: colors.matcha,
            margin: 0,
            letterSpacing: '-0.75px',
            lineHeight: '1.1',
          }}>
            Clinical Note & Summary
          </h1>
          <p style={{ fontSize: '9pt', color: colors.neutralLight, margin: '6px 0 0 0', fontWeight: 500 }}>
            FHIR R4 Compliant • AI-Assisted Medical Record
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            display: 'inline-block',
            padding: '4px 10px',
            backgroundColor: colors.matchaLight,
            borderRadius: '6px',
            border: `1.5px solid ${colors.matchaBorder}`,
            fontSize: '8.5pt',
            fontWeight: 600,
            color: colors.matcha,
          }}>
            Generated: {formatDate(report.createdAt)}
          </div>
        </div>
      </div>

      {/* Patient & Doctor Card Block */}
      <div style={{
        display: 'flex',
        gap: '20px',
        marginBottom: '26px',
        padding: '16px 20px',
        backgroundColor: colors.matchaLight,
        borderRadius: '10px',
        border: `1.5px solid ${colors.matchaBorder}`,
      }}>
        <div style={{ flex: 1 }}>
          <span style={{ 
            fontSize: '7.5pt', 
            color: colors.matcha, 
            textTransform: 'uppercase', 
            fontWeight: 800, 
            letterSpacing: '1px', 
            display: 'block',
            marginBottom: '4px' 
          }}>
            Patient Name
          </span>
          <p style={{ fontSize: '13pt', fontWeight: 700, color: colors.neutralDark, margin: 0 }}>
            {report.patientName || 'N/A'}
          </p>
        </div>
        {report.doctorName && (
          <div style={{ flex: 1, borderLeft: `1px solid ${colors.matchaBorder}`, paddingLeft: '20px' }}>
            <span style={{ 
              fontSize: '7.5pt', 
              color: colors.matcha, 
              textTransform: 'uppercase', 
              fontWeight: 800, 
              letterSpacing: '1px', 
              display: 'block',
              marginBottom: '4px' 
            }}>
              Attending Physician
            </span>
            <p style={{ fontSize: '13pt', fontWeight: 700, color: colors.neutralDark, margin: 0 }}>
              Dr. {report.doctorName}
            </p>
          </div>
        )}
      </div>

      {notes && (
        <>
          {/* Chief Complaint */}
          {notes.chief_complaint && (
            <Section title="Chief Complaint" color={colors.matcha}>
              <p style={{ margin: 0, fontWeight: 500, color: colors.charcoal }}>{notes.chief_complaint}</p>
            </Section>
          )}

          {/* History of Present Illness */}
          {notes.history_of_present_illness && (
            <Section title="History of Present Illness" color={colors.peachDark}>
              <p style={{ margin: 0, color: colors.neutralDark }}>{notes.history_of_present_illness}</p>
            </Section>
          )}

          {/* Vitals */}
          {notes.vitals?.length > 0 && (
            <Section title="Patient Vitals" color={colors.matcha}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '6px' }}>
                {notes.vitals.map((v: any, i: number) => (
                  <div key={i} style={{
                    backgroundColor: colors.peachLight,
                    border: `1.5px solid ${colors.peachBorder}`,
                    borderRadius: '8px',
                    padding: '10px 14px',
                    minWidth: '125px',
                    flex: '1 1 calc(25% - 12px)',
                  }}>
                    <p style={{ fontSize: '7.5pt', color: colors.peachDark, textTransform: 'uppercase', fontWeight: 800, margin: '0 0 4px 0', letterSpacing: '0.5px' }}>{v.name}</p>
                    <p style={{ fontSize: '13pt', fontWeight: 800, color: colors.neutralDark, margin: 0 }}>
                      {v.value} <span style={{ fontSize: '9.5pt', color: colors.neutralLight, fontWeight: 500 }}>{v.unit}</span>
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Examination Findings */}
          {notes.examination_findings && (
            <Section title="Clinical Examination Findings" color={colors.matcha}>
              <p style={{ margin: 0, color: colors.neutralDark }}>{notes.examination_findings}</p>
            </Section>
          )}

          {/* Diagnoses */}
          {notes.diagnoses?.length > 0 && (
            <Section title="Assessments & Diagnoses" color={colors.peachDark}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt', marginTop: '6px', border: `1px solid ${colors.borderLight}` }}>
                <thead>
                  <tr style={{ backgroundColor: colors.peachLight }}>
                    <th style={{ textAlign: 'left', padding: '10px 14px', borderBottom: `2.5px solid ${colors.peachBorder}`, fontSize: '8pt', textTransform: 'uppercase', color: colors.peachDark, fontWeight: 800, letterSpacing: '0.75px' }}>Diagnosis</th>
                    <th style={{ textAlign: 'center', padding: '10px 14px', borderBottom: `2.5px solid ${colors.peachBorder}`, fontSize: '8pt', textTransform: 'uppercase', color: colors.peachDark, fontWeight: 800, letterSpacing: '0.75px', width: '120px' }}>ICD-10 Code</th>
                    <th style={{ textAlign: 'center', padding: '10px 14px', borderBottom: `2.5px solid ${colors.peachBorder}`, fontSize: '8pt', textTransform: 'uppercase', color: colors.peachDark, fontWeight: 800, letterSpacing: '0.75px', width: '120px' }}>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {notes.diagnoses.map((dx: any, i: number) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${colors.borderLight}`, backgroundColor: i % 2 === 0 ? colors.white : '#fbfbfb' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: colors.neutralDark }}>{dx.name}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {dx.icd_code ? (
                          <span style={{
                            backgroundColor: colors.peachLight,
                            color: colors.peachDark,
                            padding: '3px 9px',
                            borderRadius: '4px',
                            fontSize: '8.5pt',
                            fontWeight: 700,
                            border: `1.5px solid ${colors.peachBorder}`,
                          }}>{dx.icd_code}</span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {dx.severity ? (
                          <span style={{
                            color: dx.severity.toLowerCase() === 'severe' ? '#b91c1c' : dx.severity.toLowerCase() === 'moderate' ? '#b45309' : '#15803d',
                            backgroundColor: dx.severity.toLowerCase() === 'severe' ? '#fee2e2' : dx.severity.toLowerCase() === 'moderate' ? '#fef3c7' : '#dcfce7',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            fontSize: '8.5pt',
                            textTransform: 'uppercase',
                            letterSpacing: '0.25px',
                          }}>{dx.severity}</span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* Medications */}
          {notes.medications?.length > 0 && (
            <Section title="Prescribed Pharmacotherapy" color={colors.matcha}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt', marginTop: '6px', border: `1px solid ${colors.borderLight}` }}>
                <thead>
                  <tr style={{ backgroundColor: colors.matchaLight }}>
                    <th style={{ textAlign: 'left', padding: '10px 14px', borderBottom: `2.5px solid ${colors.matchaBorder}`, fontSize: '8pt', textTransform: 'uppercase', color: colors.matcha, fontWeight: 800, letterSpacing: '0.75px' }}>Medication Name</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', borderBottom: `2.5px solid ${colors.matchaBorder}`, fontSize: '8pt', textTransform: 'uppercase', color: colors.matcha, fontWeight: 800, letterSpacing: '0.75px', width: '100px' }}>Dosage</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', borderBottom: `2.5px solid ${colors.matchaBorder}`, fontSize: '8pt', textTransform: 'uppercase', color: colors.matcha, fontWeight: 800, letterSpacing: '0.75px' }}>Frequency</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', borderBottom: `2.5px solid ${colors.matchaBorder}`, fontSize: '8pt', textTransform: 'uppercase', color: colors.matcha, fontWeight: 800, letterSpacing: '0.75px', width: '100px' }}>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {notes.medications.map((m: any, i: number) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${colors.borderLight}`, backgroundColor: i % 2 === 0 ? colors.white : '#fbfbfb' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: colors.matcha }}>{m.name}</td>
                      <td style={{ padding: '10px 14px', color: colors.neutralDark, fontWeight: 500 }}>{m.dosage || '—'}</td>
                      <td style={{ padding: '10px 14px', color: colors.neutralDark }}>{m.frequency || '—'}</td>
                      <td style={{ padding: '10px 14px', color: colors.neutralDark, fontWeight: 500 }}>{m.duration || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* Follow-up */}
          {notes.follow_up && (
            <Section title="Follow-up Instructions" color={colors.peachDark}>
              <p style={{ margin: 0, fontWeight: 500, color: colors.charcoal }}>{notes.follow_up}</p>
            </Section>
          )}

          {/* Advice */}
          {notes.advice && (
            <Section title="Patient Advice & Counselling" color={colors.matcha}>
              <p style={{ margin: 0, color: colors.neutralDark }}>{notes.advice}</p>
            </Section>
          )}
        </>
      )}

      {/* Transcript */}
      {report.transcript && (
        <Section title="Clinical Consultation Transcript" color={colors.neutralLight}>
          <div style={{
            backgroundColor: '#fafafa',
            border: `1px solid ${colors.borderLight}`,
            borderRadius: '8px',
            padding: '14px 16px',
            fontSize: '9.5pt',
            color: colors.neutralLight,
            maxHeight: '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.5',
          }}>
            {report.transcript}
          </div>
        </Section>
      )}

      {/* Footer */}
      <div style={{
        marginTop: '34px',
        paddingTop: '16px',
        borderTop: `1px solid ${colors.borderLight}`,
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '8pt',
        fontWeight: 500,
        color: colors.neutralLight,
      }}>
        <span>FHIR Scribe Portal • Secure AI Clinical Summary</span>
        <span style={{ color: colors.peachDark, fontWeight: 700 }}>Confidential Medical Record</span>
      </div>
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '22px', pageBreakInside: 'avoid' }}>
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
          fontWeight: 800,
          color: '#1e293b',
          textTransform: 'uppercase',
          letterSpacing: '0.75px',
          margin: 0,
        }}>{title}</h2>
      </div>
      <div style={{ paddingLeft: '12px' }}>
        {children}
      </div>
    </div>
  );
}
