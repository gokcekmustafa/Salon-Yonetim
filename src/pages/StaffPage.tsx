import { useState } from 'react';
import { useFormGuard } from '@/hooks/useFormGuard';
import { DbStaff } from '@/hooks/useSalonData';
import { useBranchFilteredData } from '@/hooks/useBranchFilteredData';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, User, UserCheck, Loader2 } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { NoPermission } from '@/components/permissions/NoPermission';
import DataExportImport, { ColumnMapping } from '@/components/DataExportImport';
import StaffDetailCard from '@/components/staff/StaffDetailCard';
import StaffAddForm from '@/components/staff/StaffAddForm';

const STAFF_COLUMNS: ColumnMapping[] = [
  { excelHeader: 'Ad Soyad', dbKey: 'name', required: true },
  { excelHeader: 'Telefon', dbKey: 'phone' },
  { excelHeader: 'Aktif', dbKey: 'is_active' },
];

export default function StaffPage() {
  const { hasPermission } = usePermissions();
  const { staff, addStaff, branches, loading, appointments, services, customers, payments, refetch } = useBranchFilteredData();
  const [addOpen, setAddOpen] = useState(false);
  const [detailStaff, setDetailStaff] = useState<DbStaff | null>(null);
  useFormGuard(addOpen || !!detailStaff);

  if (!hasPermission('can_manage_staff')) return <NoPermission feature="Personel Yönetimi" />;

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Yükleniyor...</p></div>
    </div>
  );

  const activeBranches = branches.filter(b => b.is_active);
  const getBranchName = (id: string | null) => branches.find(b => b.id === id)?.name ?? '-';

  return (
    <div className="page-container animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Personel Yönetimi</h1>
          <p className="page-subtitle">{staff.filter(s => s.is_active).length} aktif personel</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <DataExportImport
            title="Personel Listesi"
            filePrefix="personel"
            columns={STAFF_COLUMNS}
            data={staff}
            toExportRow={(s) => ({ 'Ad Soyad': s.name, 'Telefon': s.phone || '', 'Aktif': s.is_active ? 'Evet' : 'Hayır' })}
            fromImportRow={(row) => ({ name: row['Ad Soyad'], phone: row['Telefon'] || '', is_active: (row['Aktif'] || 'Evet').toLowerCase() !== 'hayır', branch_id: activeBranches[0]?.id || '' })}
            onImport={async (rows) => {
              let success = 0, errors = 0;
              for (const row of rows) { const err = await addStaff(row as any); if (err) errors++; else success++; }
              return { success, errors };
            }}
            summaryLines={[`Toplam: ${staff.length} personel`]}
          />
          <Button onClick={() => setAddOpen(true)} size="sm" className="h-10 btn-gradient gap-1.5 rounded-xl px-4"><Plus className="h-4 w-4" /> Ekle</Button>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="block md:hidden space-y-3">
        {staff.length === 0 ? (
          <Card className="shadow-soft border-border/60"><CardContent className="empty-state"><UserCheck className="empty-state-icon" /><p className="empty-state-title">Personel bulunamadı</p></CardContent></Card>
        ) : staff.map(s => (
          <div key={s.id} className={`card-interactive p-4 cursor-pointer ${!s.is_active ? 'opacity-50' : ''}`} onClick={() => setDetailStaff(s)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${s.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                  <User className={`h-4.5 w-4.5 ${s.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="font-semibold text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.phone}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{getBranchName(s.branch_id)}</span>
                    <Badge variant={s.is_active ? 'default' : 'secondary'} className="text-[10px] px-1.5">{s.is_active ? 'Aktif' : 'Pasif'}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table */}
      <Card className="hidden md:block shadow-soft border-border/60 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="font-semibold">Ad Soyad</TableHead><TableHead className="font-semibold">Telefon</TableHead><TableHead className="font-semibold">Şube</TableHead><TableHead className="font-semibold">Durum</TableHead></TableRow></TableHeader>
            <TableBody>
              {staff.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground text-sm">Personel bulunamadı.</TableCell></TableRow>
              ) : staff.map(s => (
                <TableRow key={s.id} className={`group cursor-pointer hover:bg-muted/50 ${!s.is_active ? 'opacity-50' : ''}`} onClick={() => setDetailStaff(s)}>
                  <TableCell><div className="flex items-center gap-3"><div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center"><User className="h-4 w-4 text-primary" /></div><span className="font-medium">{s.name}</span></div></TableCell>
                  <TableCell className="text-muted-foreground">{s.phone}</TableCell>
                  <TableCell className="text-muted-foreground">{getBranchName(s.branch_id)}</TableCell>
                  <TableCell><Badge variant={s.is_active ? 'default' : 'secondary'} className="text-[10px] font-semibold">{s.is_active ? 'Aktif' : 'Pasif'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Form */}
      <StaffAddForm open={addOpen} onOpenChange={setAddOpen} branches={branches} onSuccess={refetch} />

      {/* Detail Card */}
      {detailStaff && (
        <StaffDetailCard
          staff={detailStaff}
          open={!!detailStaff}
          onOpenChange={v => !v && setDetailStaff(null)}
          onUpdated={refetch}
          branches={branches}
          appointments={appointments}
          services={services}
          customers={customers}
          payments={payments}
        />
      )}
    </div>
  );
}
