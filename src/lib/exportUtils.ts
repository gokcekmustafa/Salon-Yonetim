import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

type ExportRow = Record<string, string | number>;

export function exportToExcel(rows: ExportRow[], headers: string[], fileName: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  // Set header names
  headers.forEach((h, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i });
    if (ws[cell]) ws[cell].v = h;
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rapor');
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
