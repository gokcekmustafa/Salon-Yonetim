import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

type ExportRow = Record<string, string | number>;

export function exportToExcel(rows: ExportRow[], headers: string[], fileName: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  headers.forEach((h, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i });
    if (ws[cell]) ws[cell].v = h;
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Veri');
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export function exportToPDF(
  rows: (string | number)[][],
  headers: string[],
  title: string,
  fileName: string,
  summaryLines?: string[],
) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFontSize(9);
  doc.text(`Oluşturulma: ${format(new Date(), 'd MMMM yyyy HH:mm', { locale: tr })}`, 14, 26);

  let startY = 32;
  if (summaryLines && summaryLines.length > 0) {
    doc.setFontSize(10);
    summaryLines.forEach((line, i) => {
      doc.text(line, 14, startY + i * 6);
    });
    startY += summaryLines.length * 6 + 4;
  }

  (doc as any).autoTable({
    head: [headers],
    body: rows,
    startY,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  doc.save(`${fileName}.pdf`);
}

/** Generate a blank Excel template with the given headers */
export function downloadTemplate(headers: string[], fileName: string) {
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  // Set column widths
  ws['!cols'] = headers.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Şablon');
  XLSX.writeFile(wb, `${fileName}-sablon.xlsx`);
}

/** Parse an uploaded Excel file and return rows as objects keyed by header */
export function parseExcelFile(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
        resolve(jsonData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsArrayBuffer(file);
  });
}
