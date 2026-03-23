import { useState, useEffect, useCallback } from 'react';
import { useFormGuard } from '@/hooks/useFormGuard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSalonData, DbService } from '@/hooks/useSalonData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Scissors, Loader2, ChevronDown, ChevronRight, FolderPlus, Download, ListPlus } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';
import { NoPermission } from '@/components/permissions/NoPermission';
import { StaffPageGuard } from '@/components/permissions/StaffPageGuard';

type ServiceCategory = {
  id: string; salon_id: string; name: string; sort_order: number; created_at: string;
};

interface StandardService {
  id: string;
  category_name: string;
  name: string;
  duration: number;
  price: number;
}

const DEFAULT_CATEGORIES = [
  { name: 'LAZER EPİLASYON', services: ['BEL','ENSE','ALIN','SIRT','POPO ÜSTÜ','ÜST BACAK','TÜM KOL','YARIM KOL','TÜM BACAK','YARIM BACAK','KOLTUK ALTI','GENİTAL','TÜM YÜZ','FAUL','BIYIK','ÇENE','BOYUN','GÖĞÜS ARASI','GÖĞÜS UCU','GÖBEK','GÖBEK ÇİZGİSİ','POPO ARASI','GÖĞÜS'] },
  { name: 'CİLT BAKIMI', services: ['CİLT BAKIMI','PRENSES BAKIM','GENÇLİK VİTAMİN','MİCROBLADİNG','COLLEGAN İP','YOSUN PEELİNG','MASAJ','PUMPKİN BAKIM'] },
  { name: 'BÖLGESEL ZAYIFLAMA', services: ['G5 - BACAK','G5 - BASEN','G5 - GÖBEK','PASİF JİMNASTİK - GÖBEK','PASİF JİMNASTİK - BASEN','PASİF JİMNASTİK - BACAK'] },
  { name: 'KİRPİK LİFTİNG', services: ['KİRPİK LİFTİNG'] },
  { name: 'ÇATLAK BAKIMI', services: ['GÖBEK'] },
];

export default function ServicesPage() {
  const { hasPermission } = usePermissions();
  const { currentSalonId } = useAuth();
  const { services, addService, updateService, deleteService, loading, refetch } = useSalonData();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ServiceCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [svcDialogOpen, setSvcDialogOpen] = useState(false);
  const [editingSvc, setEditingSvc] = useState<DbService | null>(null);
  const [svcCatId, setSvcCatId] = useState<string | null>(null);
  const [svcForm, setSvcForm] = useState({ name: '', duration: '60', price: '0' });
  useFormGuard(catDialogOpen || svcDialogOpen);
  const [saving, setSaving] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  // Standard services import state
  const [stdDialogOpen, setStdDialogOpen] = useState(false);
  const [stdServices, setStdServices] = useState<StandardService[]>([]);
  const [stdLoading, setStdLoading] = useState(false);
  const [stdSelected, setStdSelected] = useState<Set<string>>(new Set());
  const [stdExpandedCats, setStdExpandedCats] = useState<Set<string>>(new Set());
  const [stdImporting, setStdImporting] = useState(false);

  const fetchCategories = useCallback(async () => {
    if (!currentSalonId) return;
    const { data } = await supabase.from('service_categories').select('*').eq('salon_id', currentSalonId).order('sort_order');
    setCategories((data as ServiceCategory[]) || []);
  }, [currentSalonId]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  if (!hasPermission('can_manage_services')) return <NoPermission feature="Hizmet Yönetimi" />;
  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const toggleCat = (id: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleService = (id: string) => {
    setSelectedServices(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCategory = (catId: string) => {
    const catServices = services.filter(s => (s as any).category_id === catId);
    const allSelected = catServices.every(s => selectedServices.has(s.id));
    setSelectedServices(prev => {
      const next = new Set(prev);
      catServices.forEach(s => allSelected ? next.delete(s.id) : next.add(s.id));
      return next;
    });
  };

  const getServicesByCategory = (catId: string) => services.filter(s => (s as any).category_id === catId);
  const uncategorizedServices = services.filter(s => !(s as any).category_id);

  // Category CRUD
  const handleSaveCat = async () => {
    if (!catName.trim() || !currentSalonId) return;
    setSaving(true);
    if (editingCat) {
      await supabase.from('service_categories').update({ name: catName.trim() }).eq('id', editingCat.id);
      toast.success('Kategori güncellendi');
    } else {
      await supabase.from('service_categories').insert({ name: catName.trim(), salon_id: currentSalonId, sort_order: categories.length });
      toast.success('Kategori eklendi');
    }
    setSaving(false);
    setCatDialogOpen(false);
    setCatName('');
    setEditingCat(null);
    fetchCategories();
  };

  const deleteCat = async (id: string) => {
    await supabase.from('service_categories').delete().eq('id', id);
    toast.success('Kategori silindi');
    fetchCategories();
  };

  // Service CRUD
  const openAddService = (catId: string) => {
    setSvcCatId(catId);
    setEditingSvc(null);
    setSvcForm({ name: '', duration: '60', price: '0' });
    setSvcDialogOpen(true);
  };

  const openEditService = (svc: DbService) => {
    setEditingSvc(svc);
    setSvcCatId((svc as any).category_id || null);
    setSvcForm({ name: svc.name, duration: String(svc.duration), price: String(svc.price) });
    setSvcDialogOpen(true);
  };

  const handleSaveService = async () => {
    if (!svcForm.name.trim()) { toast.error('Hizmet adı zorunludur.'); return; }
    setSaving(true);
    const data = { name: svcForm.name, duration: Number(svcForm.duration) || 60, price: Number(svcForm.price) || 0 };
    if (editingSvc) {
      await updateService(editingSvc.id, { ...data, category_id: svcCatId } as any);
      toast.success('Hizmet güncellendi.');
    } else {
      if (!currentSalonId) return;
      await supabase.from('services').insert({ ...data, salon_id: currentSalonId, category_id: svcCatId });
      toast.success('Hizmet eklendi.');
      refetch();
    }
    setSaving(false);
    setSvcDialogOpen(false);
  };

  const handleDeleteService = async (id: string) => {
    await deleteService(id);
    toast.success('Hizmet silindi.');
  };

  // Load default categories and services
  const loadDefaults = async () => {
    if (!currentSalonId) return;
    setLoadingDefaults(true);
    try {
      for (const cat of DEFAULT_CATEGORIES) {
        const { data: catData } = await supabase.from('service_categories')
          .insert({ name: cat.name, salon_id: currentSalonId, sort_order: DEFAULT_CATEGORIES.indexOf(cat) })
          .select('id').single();
        if (catData) {
          const serviceRows = cat.services.map(name => ({
            name, salon_id: currentSalonId, category_id: catData.id, duration: 60, price: 0,
          }));
          await supabase.from('services').insert(serviceRows);
        }
      }
      toast.success('Varsayılan hizmetler yüklendi.');
      fetchCategories();
      refetch();
    } catch (e) {
      toast.error('Hata oluştu.');
    }
    setLoadingDefaults(false);
  };

  // Standard services import
  const openStdImport = async () => {
    setStdDialogOpen(true);
    setStdLoading(true);
    setStdSelected(new Set());
    setStdExpandedCats(new Set());
    const { data } = await supabase.from('standard_services').select('*').order('category_name').order('sort_order');
    setStdServices((data as StandardService[]) || []);
    setStdLoading(false);
  };

  const stdCategories = [...new Set(stdServices.map(s => s.category_name))];

  const toggleStdCat = (cat: string) => {
    setStdExpandedCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const toggleStdService = (id: string) => {
    setStdSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleStdCategory = (cat: string) => {
    const catSvcs = stdServices.filter(s => s.category_name === cat);
    const allSelected = catSvcs.every(s => stdSelected.has(s.id));
    setStdSelected(prev => {
      const next = new Set(prev);
      catSvcs.forEach(s => allSelected ? next.delete(s.id) : next.add(s.id));
      return next;
    });
  };

  const handleStdImport = async () => {
    if (!currentSalonId || stdSelected.size === 0) return;
    setStdImporting(true);

    const selected = stdServices.filter(s => stdSelected.has(s.id));
    const catNames = [...new Set(selected.map(s => s.category_name))];

    // Create or find categories
    const catMap: Record<string, string> = {};
    for (const catName of catNames) {
      const existing = categories.find(c => c.name.toUpperCase() === catName.toUpperCase());
      if (existing) {
        catMap[catName] = existing.id;
      } else {
        const { data } = await supabase.from('service_categories')
          .insert({ name: catName, salon_id: currentSalonId, sort_order: categories.length + catNames.indexOf(catName) })
          .select('id').single();
        if (data) catMap[catName] = data.id;
      }
    }

    // Insert services
    const rows = selected
      .filter(s => catMap[s.category_name])
      .map(s => ({
        name: s.name,
        salon_id: currentSalonId,
        category_id: catMap[s.category_name],
        duration: s.duration,
        price: s.price,
      }));

    if (rows.length > 0) {
      const { error } = await supabase.from('services').insert(rows);
      if (error) toast.error('Hata: ' + error.message);
      else toast.success(`${rows.length} hizmet başarıyla eklendi`);
    }

    setStdImporting(false);
    setStdDialogOpen(false);
    fetchCategories();
    refetch();
  };

  return (
    <div className="page-container animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hizmetler</h1>
          <p className="page-subtitle">{categories.length} kategori, {services.length} hizmet</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.length === 0 && (
            <Button variant="outline" size="sm" onClick={loadDefaults} disabled={loadingDefaults} className="gap-1.5">
              {loadingDefaults ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Varsayılan Hizmetleri Yükle
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={openStdImport} className="gap-1.5">
            <ListPlus className="h-4 w-4" /> Standart Listeden Ekle
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setEditingCat(null); setCatName(''); setCatDialogOpen(true); }} className="gap-1.5">
            <FolderPlus className="h-4 w-4" /> Kategori Ekle
          </Button>
        </div>
      </div>

      {/* Categories with services */}
      <div className="space-y-3">
        {categories.map(cat => {
          const catServices = getServicesByCategory(cat.id);
          const isExpanded = expandedCats.has(cat.id);
          const allSelected = catServices.length > 0 && catServices.every(s => selectedServices.has(s.id));
          const someSelected = catServices.some(s => selectedServices.has(s.id));

          return (
            <Card key={cat.id} className="shadow-soft border-border/60 overflow-hidden">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allSelected}
                    // @ts-ignore
                    indeterminate={someSelected && !allSelected}
                    onCheckedChange={() => toggleCategory(cat.id)}
                  />
                  <button onClick={() => toggleCat(cat.id)} className="flex items-center gap-2 flex-1 text-left">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <CardTitle className="text-sm font-bold">{cat.name}</CardTitle>
                    <span className="text-xs text-muted-foreground">({catServices.length})</span>
                  </button>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAddService(cat.id)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingCat(cat); setCatName(cat.name); setCatDialogOpen(true); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCat(cat.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="px-4 pb-3 pt-0">
                  {catServices.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 pl-8">Henüz alt hizmet eklenmemiş</p>
                  ) : (
                    <div className="space-y-1">
                      {catServices.map(svc => (
                        <div key={svc.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-muted/50 group">
                          <Checkbox
                            checked={selectedServices.has(svc.id)}
                            onCheckedChange={() => toggleService(svc.id)}
                          />
                          <Scissors className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                          <span className="text-sm font-medium flex-1">{svc.name}</span>
                          <span className="text-xs text-muted-foreground">{svc.duration} dk</span>
                          <span className="text-xs font-bold tabular-nums">₺{Number(svc.price).toLocaleString('tr-TR')}</span>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditService(svc)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteService(svc.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}

        {/* Uncategorized services */}
        {uncategorizedServices.length > 0 && (
          <Card className="shadow-soft border-border/60">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-bold text-muted-foreground">Kategorisiz Hizmetler</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="space-y-1">
                {uncategorizedServices.map(svc => (
                  <div key={svc.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-muted/50 group">
                    <Checkbox checked={selectedServices.has(svc.id)} onCheckedChange={() => toggleService(svc.id)} />
                    <Scissors className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                    <span className="text-sm font-medium flex-1">{svc.name}</span>
                    <span className="text-xs text-muted-foreground">{svc.duration} dk</span>
                    <span className="text-xs font-bold tabular-nums">₺{Number(svc.price).toLocaleString('tr-TR')}</span>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditService(svc)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteService(svc.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {categories.length === 0 && uncategorizedServices.length === 0 && (
          <Card className="shadow-soft border-border/60">
            <CardContent className="empty-state">
              <Scissors className="empty-state-icon" />
              <p className="empty-state-title">Hizmet bulunamadı</p>
              <p className="empty-state-description">Varsayılan hizmetleri yükleyerek veya yeni kategori ekleyerek başlayın.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingCat ? 'Kategori Düzenle' : 'Yeni Kategori'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs font-semibold">Kategori Adı</Label>
            <Input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Örn: Lazer Epilasyon" className="h-10" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSaveCat} disabled={saving} className="btn-gradient">Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Dialog */}
      <Dialog open={svcDialogOpen} onOpenChange={setSvcDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSvc ? 'Hizmet Düzenle' : 'Yeni Alt Hizmet'}</DialogTitle>
            <DialogDescription>{editingSvc ? 'Hizmet bilgilerini güncelleyin' : 'Yeni alt hizmet ekleyin'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label className="text-xs font-semibold">Hizmet Adı</Label><Input value={svcForm.name} onChange={e => setSvcForm(f => ({ ...f, name: e.target.value }))} placeholder="Alt hizmet adı" className="h-10" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold">Süre (dakika)</Label><Input type="number" value={svcForm.duration} onChange={e => setSvcForm(f => ({ ...f, duration: e.target.value }))} className="h-10" /></div>
            <div className="space-y-2"><Label className="text-xs font-semibold">Fiyat (₺)</Label><Input type="number" value={svcForm.price} onChange={e => setSvcForm(f => ({ ...f, price: e.target.value }))} className="h-10" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSvcDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSaveService} disabled={saving} className="btn-gradient">{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Standard Services Import Dialog */}
      <Dialog open={stdDialogOpen} onOpenChange={setStdDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListPlus className="h-5 w-5 text-primary" />
              Standart Hizmetlerden Ekle
            </DialogTitle>
            <DialogDescription>Eklemek istediğiniz hizmetleri seçin. Mevcut kategoriler eşleştirilir, yoksa yeni oluşturulur.</DialogDescription>
          </DialogHeader>
          {stdLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : stdServices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Scissors className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Henüz standart hizmet tanımlanmamış</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stdCategories.map(cat => {
                const catSvcs = stdServices.filter(s => s.category_name === cat);
                const isExpanded = stdExpandedCats.has(cat);
                const allSelected = catSvcs.every(s => stdSelected.has(s.id));
                const someSelected = catSvcs.some(s => stdSelected.has(s.id));
                return (
    <StaffPageGuard permissionKey="page_services" featureLabel="Hizmetler">
                  <div key={cat} className="rounded-xl border border-border/60 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
                      <Checkbox
                        checked={allSelected}
                        // @ts-ignore
                        indeterminate={someSelected && !allSelected}
                        onCheckedChange={() => toggleStdCategory(cat)}
                      />
                      <button onClick={() => toggleStdCat(cat)} className="flex items-center gap-2 flex-1 text-left">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <span className="text-sm font-bold">{cat}</span>
                        <Badge variant="secondary" className="text-[10px]">{catSvcs.length}</Badge>
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="px-3 pb-2 pt-1 space-y-1">
                        {catSvcs.map(svc => (
                          <div key={svc.id} className="flex items-center gap-3 py-1 px-2 rounded-lg hover:bg-muted/50">
                            <Checkbox
                              checked={stdSelected.has(svc.id)}
                              onCheckedChange={() => toggleStdService(svc.id)}
                            />
                            <Scissors className="h-3 w-3 text-primary/60 shrink-0" />
                            <span className="text-sm flex-1">{svc.name}</span>
                            <span className="text-xs text-muted-foreground">{svc.duration} dk</span>
                            <span className="text-xs font-bold tabular-nums">₺{Number(svc.price).toLocaleString('tr-TR')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStdDialogOpen(false)}>İptal</Button>
            <Button
              onClick={handleStdImport}
              disabled={stdImporting || stdSelected.size === 0}
              className="btn-gradient gap-1.5"
            >
              {stdImporting && <Loader2 className="h-4 w-4 animate-spin" />}
              {stdSelected.size > 0 ? `${stdSelected.size} Hizmet Ekle` : 'Seçim Yapın'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
    </StaffPageGuard>
}
