import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Scissors, Pencil, Trash2, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface StandardService {
  id: string;
  category_name: string;
  name: string;
  duration: number;
  price: number;
  sort_order: number;
}

export function StandardServiceManager() {
  const [services, setServices] = useState<StandardService[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StandardService | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StandardService | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const [categoryName, setCategoryName] = useState('');
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('60');
  const [price, setPrice] = useState('0');

  const fetchServices = async () => {
    const { data } = await supabase
      .from('standard_services')
      .select('*')
      .order('category_name')
      .order('sort_order');
    setServices((data as StandardService[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchServices(); }, []);

  const categories = [...new Set(services.map(s => s.category_name))];

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const openAdd = (cat?: string) => {
    setEditing(null);
    setCategoryName(cat || '');
    setName(''); setDuration('60'); setPrice('0');
    setDialogOpen(true);
  };

  const openEdit = (svc: StandardService) => {
    setEditing(svc);
    setCategoryName(svc.category_name);
    setName(svc.name);
    setDuration(String(svc.duration));
    setPrice(String(svc.price));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !categoryName.trim()) { toast.error('Kategori ve hizmet adı zorunludur'); return; }
    setSaving(true);

    const payload = {
      category_name: categoryName.trim(),
      name: name.trim(),
      duration: parseInt(duration) || 60,
      price: parseFloat(price) || 0,
      sort_order: editing?.sort_order ?? services.filter(s => s.category_name === categoryName.trim()).length,
    };

    if (editing) {
      const { error } = await supabase.from('standard_services').update(payload as any).eq('id', editing.id);
      if (error) toast.error('Hata: ' + error.message);
      else toast.success('Standart hizmet güncellendi');
    } else {
      const { error } = await supabase.from('standard_services').insert(payload as any);
      if (error) toast.error('Hata: ' + error.message);
      else toast.success('Standart hizmet eklendi');
    }

    setSaving(false);
    setDialogOpen(false);
    fetchServices();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('standard_services').delete().eq('id', deleteTarget.id);
    if (error) toast.error('Hata: ' + error.message);
    else toast.success('Standart hizmet silindi');
    setDeleteTarget(null);
    fetchServices();
  };

  const deleteCategory = async (cat: string) => {
    if (!confirm(`"${cat}" kategorisindeki tüm standart hizmetler silinecek. Emin misiniz?`)) return;
    const ids = services.filter(s => s.category_name === cat).map(s => s.id);
    if (ids.length > 0) {
      const { error } = await supabase.from('standard_services').delete().in('id', ids);
      if (error) toast.error('Hata: ' + error.message);
      else toast.success('Kategori ve hizmetleri silindi');
    }
    fetchServices();
  };

  return (
    <Card className="shadow-soft border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Scissors className="h-3.5 w-3.5 text-primary" />
            </div>
            Standart Hizmetler
          </CardTitle>
          <Button onClick={() => openAdd()} size="sm" className="gap-1.5 h-8 rounded-full">
            <Plus className="h-3.5 w-3.5" /> Hizmet Ekle
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Salonlar bu listeden hizmet seçerek kendi listelerine ekleyebilir.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Scissors className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Henüz standart hizmet tanımlanmamış</p>
            <Button variant="outline" size="sm" onClick={() => openAdd()} className="gap-1.5 mt-1">
              <Plus className="h-3.5 w-3.5" /> İlk Hizmeti Ekle
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map(cat => {
              const catServices = services.filter(s => s.category_name === cat);
              const isExpanded = expandedCats.has(cat);
              return (
                <div key={cat} className="rounded-xl border border-border/60 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30">
                    <button onClick={() => toggleCat(cat)} className="flex items-center gap-2 flex-1 text-left">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm font-bold">{cat}</span>
                      <Badge variant="secondary" className="text-[10px]">{catServices.length}</Badge>
                    </button>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAdd(cat)}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCategory(cat)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-2 pt-1 space-y-1">
                      {catServices.map(svc => (
                        <div key={svc.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-muted/50 group">
                          <Scissors className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                          <span className="text-sm font-medium flex-1">{svc.name}</span>
                          <span className="text-xs text-muted-foreground">{svc.duration} dk</span>
                          <span className="text-xs font-bold tabular-nums">₺{Number(svc.price).toLocaleString('tr-TR')}</span>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(svc)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteTarget(svc)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Standart Hizmet Düzenle' : 'Yeni Standart Hizmet'}</DialogTitle>
            <DialogDescription>Salonların seçebileceği standart hizmet listesine ekleyin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Kategori Adı *</Label>
              <Input value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="Ör: Lazer Epilasyon" list="std-cats" />
              <datalist id="std-cats">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Hizmet Adı *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ör: BEL" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Süre (dk)</Label>
                <Input type="number" min="1" value={duration} onChange={e => setDuration(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Fiyat (₺)</Label>
                <Input type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim() || !categoryName.trim()} className="rounded-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Standart Hizmeti Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> standart hizmetini silmek istediğinize emin misiniz? Mevcut salonlardaki hizmetler etkilenmez.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Evet, Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
