import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Search, RefreshCw, Filter, Download } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface AuditLog {
  id: string;
  user_name: string;
  user_role: string;
  salon_name: string | null;
  action: string;
  target_type: string;
  target_label: string | null;
  details: any;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create: { label: 'Oluşturma', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  update: { label: 'Güncelleme', color: 'bg-info/10 text-info border-info/20' },
  delete: { label: 'Silme', color: 'bg-destructive/10 text-destructive border-destructive/20' },
  login: { label: 'Giriş', color: 'bg-primary/10 text-primary border-primary/20' },
  logout: { label: 'Çıkış', color: 'bg-muted text-muted-foreground border-border' },
  status_change: { label: 'Durum Değişikliği', color: 'bg-accent/10 text-accent-foreground border-accent/20' },
};

const TARGET_LABELS: Record<string, string> = {
  appointment: 'Randevu',
  customer: 'Müşteri',
  service: 'Hizmet',
  staff: 'Personel',
  branch: 'Şube',
  payment: 'Ödeme',
  lead: 'Aday Müşteri',
  announcement: 'Duyuru',
  popup: 'Popup',
  salon: 'Salon',
  settings: 'Ayarlar',
  branding: 'Marka',
  permission: 'İzin',
  password: 'Şifre',
};

interface AuditLogViewerProps {
  salonId?: string | null;
  mode?: 'super_admin' | 'salon_admin';
}

export function AuditLogViewer({ salonId, mode = 'super_admin' }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [targetFilter, setTargetFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('audit_logs' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (mode === 'salon_admin' && salonId) {
      query = query.eq('salon_id', salonId);
    }

    if (actionFilter !== 'all') {
      query = query.eq('action', actionFilter);
    }

    if (targetFilter !== 'all') {
      query = query.eq('target_type', targetFilter);
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      let since: Date;
      switch (dateFilter) {
        case '1h': since = new Date(now.getTime() - 3600_000); break;
        case '24h': since = new Date(now.getTime() - 86400_000); break;
        case '7d': since = new Date(now.getTime() - 7 * 86400_000); break;
        case '30d': since = new Date(now.getTime() - 30 * 86400_000); break;
        default: since = new Date(0);
      }
      query = query.gte('created_at', since.toISOString());
    }

    const { data } = await query;
    setLogs((data as any[]) || []);
    setLoading(false);
  }, [salonId, mode, actionFilter, targetFilter, dateFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (log.user_name || '').toLowerCase().includes(term) ||
      (log.target_label || '').toLowerCase().includes(term) ||
      (log.salon_name || '').toLowerCase().includes(term)
    );
  });

  const exportCSV = () => {
    const headers = ['Tarih', 'Kullanıcı', 'Rol', 'Salon', 'İşlem', 'Hedef', 'Açıklama'];
    const rows = filtered.map(l => [
      format(new Date(l.created_at), 'dd.MM.yyyy HH:mm'),
      l.user_name,
      l.user_role,
      l.salon_name || '-',
      ACTION_LABELS[l.action]?.label || l.action,
      TARGET_LABELS[l.target_type] || l.target_type,
      l.target_label || '-',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">İşlem Günlüğü</CardTitle>
              <CardDescription>{filtered.length} kayıt</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="ghost" size="icon" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Kullanıcı, hedef veya salon ara..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue placeholder="İşlem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm İşlemler</SelectItem>
              <SelectItem value="create">Oluşturma</SelectItem>
              <SelectItem value="update">Güncelleme</SelectItem>
              <SelectItem value="delete">Silme</SelectItem>
              <SelectItem value="login">Giriş</SelectItem>
              <SelectItem value="status_change">Durum Değişikliği</SelectItem>
            </SelectContent>
          </Select>
          <Select value={targetFilter} onValueChange={setTargetFilter}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Hedef" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Hedefler</SelectItem>
              {Object.entries(TARGET_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Tarih" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Zamanlar</SelectItem>
              <SelectItem value="1h">Son 1 Saat</SelectItem>
              <SelectItem value="24h">Son 24 Saat</SelectItem>
              <SelectItem value="7d">Son 7 Gün</SelectItem>
              <SelectItem value="30d">Son 30 Gün</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Kullanıcı</TableHead>
                <TableHead>Rol</TableHead>
                {mode === 'super_admin' && <TableHead>Salon</TableHead>}
                <TableHead>İşlem</TableHead>
                <TableHead>Hedef</TableHead>
                <TableHead>Açıklama</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={mode === 'super_admin' ? 7 : 6} className="text-center text-muted-foreground py-8">
                    {loading ? 'Yükleniyor...' : 'Kayıt bulunamadı'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((log) => {
                  const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-muted text-muted-foreground border-border' };
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: tr })}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{log.user_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{log.user_role}</Badge>
                      </TableCell>
                      {mode === 'super_admin' && (
                        <TableCell className="text-xs text-muted-foreground">{log.salon_name || '-'}</TableCell>
                      )}
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${actionInfo.color}`}>
                          {actionInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {TARGET_LABELS[log.target_type] || log.target_type}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {log.target_label || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
