import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, FileText, Upload, Download, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { exportToExcel, exportToPDF, downloadTemplate, parseExcelFile } from '@/lib/exportUtils';
import { toast } from 'sonner';

export interface ColumnMapping {
  /** Excel column header name (Turkish) */
  excelHeader: string;
  /** DB field key */
  dbKey: string;
  /** Is required? */
  required?: boolean;
}

interface DataExportImportProps {
  /** Title for PDF export */
  title: string;
  /** File name prefix */
  filePrefix: string;
  /** Column mappings for import/export */
  columns: ColumnMapping[];
  /** Current data rows for export */
  data: Record<string, any>[];
  /** Transform DB row to export-friendly row */
  toExportRow: (row: any) => Record<string, string | number>;
  /** Transform imported row to DB-ready object. Return null to skip. */
  fromImportRow: (row: Record<string, string>) => Record<string, any> | null;
  /** Called with array of parsed+validated rows to actually insert */
  onImport: (rows: Record<string, any>[]) => Promise<{ success: number; errors: number }>;
  /** Optional PDF summary lines */
  summaryLines?: string[];
}

export default function DataExportImport({
  title, filePrefix, columns, data, toExportRow, fromImportRow, onImport, summaryLines,
}: DataExportImportProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<Record<string, any>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const headers = columns.map(c => c.excelHeader);

  const handleExcel = () => {
    const rows = data.map(toExportRow);
    exportToExcel(rows, headers, filePrefix);
    toast.success('Excel dosyası indirildi');
  };

  const handlePDF = () => {
    const rows = data.map(row => {
      const exportRow = toExportRow(row);
      return headers.map(h => String(exportRow[h] ?? ''));
    });
    exportToPDF(rows, headers, title, filePrefix, summaryLines);
    toast.success('PDF dosyası indirildi');
  };

  const handleTemplate = () => {
    downloadTemplate(headers, filePrefix);
    toast.success('Şablon dosyası indirildi');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawRows = await parseExcelFile(file);
      const parsedRows: Record<string, any>[] = [];
      const rowErrors: string[] = [];

      rawRows.forEach((raw, idx) => {
        // Try to find matching columns
        const mapped: Record<string, string> = {};
        columns.forEach(col => {
          // Try exact match, then case-insensitive
          const val = raw[col.excelHeader] ?? raw[col.excelHeader.toLowerCase()] ?? raw[col.dbKey] ?? '';
          mapped[col.excelHeader] = String(val).trim();
        });

        // Check required fields
        const missing = columns.filter(c => c.required && !mapped[c.excelHeader]);
        if (missing.length > 0) {
          rowErrors.push(`Satır ${idx + 2}: ${missing.map(m => m.excelHeader).join(', ')} eksik`);
          return;
        }

        const dbRow = fromImportRow(mapped);
        if (dbRow) parsedRows.push(dbRow);
      });

      setPreview(parsedRows);
      setErrors(rowErrors);
      setImportOpen(true);
    } catch {
      toast.error('Dosya okunamadı. Lütfen geçerli bir Excel dosyası seçin.');
    }

    // Reset input
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleConfirmImport = async () => {
    if (preview.length === 0) return;
    setImporting(true);
    try {
      const result = await onImport(preview);
      toast.success(`${result.success} kayıt başarıyla eklendi${result.errors > 0 ? `, ${result.errors} hata` : ''}`);
      setImportOpen(false);
      setPreview([]);
      setErrors([]);
    } catch (err: any) {
      toast.error(err.message || 'İçe aktarma hatası');
    }
    setImporting(false);
  };

  return (
    <>
      <div className="flex gap-1.5 flex-wrap">
        <Button variant="outline" size="sm" onClick={handleExcel} className="gap-1.5 text-xs">
          <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
        </Button>
        <Button variant="outline" size="sm" onClick={handlePDF} className="gap-1.5 text-xs">
          <FileText className="h-3.5 w-3.5" /> PDF
        </Button>
        <Button variant="outline" size="sm" onClick={handleTemplate} className="gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" /> Şablon
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs relative" onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> İçe Aktar
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
      </div>

      {/* Import Preview Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> İçe Aktarma Önizleme</DialogTitle>
            <DialogDescription>
              {preview.length} kayıt bulundu. Lütfen kontrol edip onaylayın.
            </DialogDescription>
          </DialogHeader>

          {errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> {errors.length} satırda hata
              </p>
              <div className="text-xs text-destructive/80 max-h-24 overflow-y-auto space-y-0.5">
                {errors.slice(0, 10).map((e, i) => <p key={i}>{e}</p>)}
                {errors.length > 10 && <p>...ve {errors.length - 10} hata daha</p>}
              </div>
            </div>
          )}

          {preview.length > 0 && (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">#</TableHead>
                    {columns.slice(0, 5).map(c => (
                      <TableHead key={c.dbKey} className="text-xs">{c.excelHeader}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.slice(0, 10).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      {columns.slice(0, 5).map(c => (
                        <TableCell key={c.dbKey} className="text-xs">{String(row[c.dbKey] ?? '-')}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.length > 10 && (
                <p className="text-xs text-muted-foreground p-2 text-center">...ve {preview.length - 10} kayıt daha</p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Badge variant="secondary" className="mr-auto">
              <CheckCircle2 className="h-3 w-3 mr-1" /> {preview.length} geçerli kayıt
            </Badge>
            <Button variant="outline" onClick={() => setImportOpen(false)}>İptal</Button>
            <Button onClick={handleConfirmImport} disabled={importing || preview.length === 0} className="gap-1.5">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? 'Aktarılıyor...' : `${preview.length} Kayıt Aktar`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
