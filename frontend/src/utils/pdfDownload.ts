/**
 * Cross-platform PDF download utility.
 * On native mobile (Capacitor), generates the PDF as base64,
 * saves it to the device cache, and opens the native share sheet.
 * On web browsers, uses the standard html2pdf browser download.
 */
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export async function downloadPdf(elementId: string, filename: string) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const pdfOptions = {
    margin: 0,
    filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
  };

  if (Capacitor.isNativePlatform()) {
    try {
      // On native mobile: generate PDF as base64, save to filesystem, then share
      const pdfBlob: Blob = await html2pdf().set(pdfOptions).from(el).outputPdf('blob');
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // strip data:... prefix
        };
        reader.readAsDataURL(pdfBlob);
      });

      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title: 'Clinical Report',
        text: 'AI Ambient Scribe - Clinical Report',
        url: savedFile.uri,
        dialogTitle: 'Save or Share Report',
      });
    } catch (err) {
      console.error('Mobile PDF error:', err);
      // Fallback to browser download
      html2pdf().set(pdfOptions).from(el).save();
    }
  } else {
    // On web: use standard browser download
    html2pdf().set(pdfOptions).from(el).save();
  }
}
