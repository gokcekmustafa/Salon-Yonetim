import { useState, useMemo } from 'react';
import { useFormGuard } from '@/hooks/useFormGuard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Package, Plus, Search, Pencil, Trash2, Loader2, AlertTriangle, ArrowDownToLine, History,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { StaffPageGuard } from '@/components/permissions/StaffPageGuard';

type Product = {
  id: string; salon_id: string; category_id: string | null; name: string;
  barcode: string | null; purchase_price: number; sale_price: number;
  current_stock: number; min_stock_alert: number; description: string | null;
  is_active: boolean; created_at: string; updated_at: string;
};
type ProductCategory = { id: string; salon_id: string; name: string; created_at: string };
type StockMovement = {
  id: string; product_id: string; salon_id: string; quantity: number;
  type: string; description: string | null; created_by: string; created_at: string;
};

export default function ProductsPage() {
  const { user, currentSalonId } = useAuth();
  const qc = useQueryClient();
  const salonId = currentSalonId;

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showStockForm, setShowStockForm] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [activeTab, setActiveTab] = useState('products');

  // Form state
  const [formName, setFormName] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formPurchasePrice, setFormPurchasePrice] = useState('');
  const [formSalePrice, setFormSalePrice] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formMinStock, setFormMinStock] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [stockDesc, setStockDesc] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');

  useFormGuard(showForm || showStockForm || showCategoryForm);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('products').select('*').eq('salon_id', salonId).order('name');
      return (data || []) as Product[];
    },
    enabled: !!salonId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['product_categories', salonId],
    queryFn: async () => {
      if (!salonId) return [];
      const { data } = await supabase.from('product_categories').select('*').eq('salon_id', salonId).order('name');
      return (data || []) as ProductCategory[];
    },
    enabled: !!salonId,
  });

  const { data: stockMovements = [] } = useQuery({
    queryKey: ['stock_movements', salonId, historyProductId],
    queryFn: async () => {
      if (!salonId || !historyProductId) return [];
      const { data } = await supabase.from('stock_movements').select('*')
        .eq('salon_id', salonId).eq('product_id', historyProductId)
        .order('created_at', { ascending: false });
      return (data || []) as StockMovement[];
    },
    enabled: !!salonId && !!historyProductId,
  });

  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);

  const filtered = useMemo(() => {
    if (!search) return products;
    const s = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(s) ||
      (p.barcode && p.barcode.toLowerCase().includes(s)) ||
      (p.category_id && categoryMap.get(p.category_id)?.toLowerCase().includes(s))
    );
  }, [products, search, categoryMap]);

  const resetForm = () => {
    setFormName(''); setFormCategoryId(''); setFormBarcode('');
    setFormPurchasePrice(''); setFormSalePrice(''); setFormStock('');
    setFormMinStock(''); setFormDescription('');
  };

  const openAdd = () => { resetForm(); setEditProduct(null); setShowForm(true); };
  const openEdit = (p: Product) => {
    setEditProduct(p);
    setFormName(p.name);
    setFormCategoryId(p.category_id || '');
    setFormBarcode(p.barcode || '');
    setFormPurchasePrice(String(p.purchase_price));
    setFormSalePrice(String(p.sale_price));
    setFormStock(String(p.current_stock));
    setFormMinStock(String(p.min_stock_alert));
    setFormDescription(p.description || '');
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!salonId || !formName.trim()) throw new Error('Ürün adı gerekli');
      const payload = {
        salon_id: salonId,
        name: formName.trim(),
        category_id: formCategoryId || null,
        barcode: formBarcode.trim() || null,
        purchase_price: Number(formPurchasePrice) || 0,
        sale_price: Number(formSalePrice) || 0,
        current_stock: Number(formStock) || 0,
        min_stock_alert: Number(formMinStock) || 0,
        description: formDescription.trim() || null,
      };
      if (editProduct) {
        const { error } = await supabase.from('products').update(payload).eq('id', editProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products', salonId] });
      setShowForm(false);
      toast.success(editProduct ? 'Ürün güncellendi' : 'Ürün eklendi');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products', salonId] });
      toast.success('Ürün silindi');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addStockMutation = useMutation({
    mutationFn: async () => {
      if (!stockProduct || !salonId || !user) throw new Error('Eksik veri');
      const qty = Number(stockQty);
      if (!qty || qty <= 0) throw new Error('Geçerli miktar girin');
      const { error: moveErr } = await supabase.from('stock_movements').insert({
        product_id: stockProduct.id, salon_id: salonId,
        quantity: qty, type: 'in', description: stockDesc.trim() || null,
        created_by: user.id,
      });
      if (moveErr) throw moveErr;
      const { error: upErr } = await supabase.from('products')
        .update({ current_stock: stockProduct.current_stock + qty })
        .eq('id', stockProduct.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products', salonId] });
      setShowStockForm(false);
      setStockQty(''); setStockDesc('');
      toast.success('Stok eklendi');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addCategoryMutation = useMutation({
    mutationFn: async () => {
      if (!salonId || !newCategoryName.trim()) throw new Error('Kategori adı gerekli');
      const { error } = await supabase.from('product_categories').insert({
        salon_id: salonId, name: newCategoryName.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product_categories', salonId] });
      setShowCategoryForm(false);
      setNewCategoryName('');
      toast.success('Kategori eklendi');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const lowStockCount = products.filter(p => p.current_stock <= p.min_stock_alert && p.is_active).length;

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  return (
    <StaffPageGuard permissionKey="page_products" featureLabel="Ürünler">
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Package className="h-5 w-5" /> Ürün Yönetimi
            </h1>
            {lowStockCount > 0 && (
              <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3.5 w-3.5" /> {lowStockCount} üründe düşük stok uyarısı
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowCategoryForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Kategori
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" /> Ürün Ekle
            </Button>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Ürün ara..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ürün Adı</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Alış ₺</TableHead>
                  <TableHead className="text-right">Satış ₺</TableHead>
                  <TableHead className="text-center">Stok</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Henüz ürün eklenmedi</TableCell></TableRow>
                ) : filtered.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.name}
                      {p.barcode && <span className="block text-xs text-muted-foreground">{p.barcode}</span>}
                    </TableCell>
                    <TableCell>{p.category_id ? categoryMap.get(p.category_id) || '-' : '-'}</TableCell>
                    <TableCell className="text-right">{p.purchase_price.toLocaleString('tr-TR')}</TableCell>
                    <TableCell className="text-right">{p.sale_price.toLocaleString('tr-TR')}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {p.current_stock <= p.min_stock_alert && p.is_active && (
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                        )}
                        <Badge variant={p.current_stock <= p.min_stock_alert ? 'destructive' : 'secondary'}>
                          {p.current_stock}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setStockProduct(p); setShowStockForm(true); }} title="Stok Ekle">
                          <ArrowDownToLine className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { setHistoryProductId(p.id); setShowHistory(true); }} title="Stok Geçmişi">
                          <History className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => {
                          if (confirm('Bu ürünü silmek istediğinize emin misiniz?')) deleteMutation.mutate(p.id);
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Add/Edit Product Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editProduct ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}</DialogTitle>
              <DialogDescription>Ürün bilgilerini girin</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Ürün Adı *</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} />
              </div>
              <div>
                <Label>Kategori</Label>
                <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Kategori seçin" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Barkod</Label>
                <Input value={formBarcode} onChange={e => setFormBarcode(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Alış Fiyatı (₺)</Label>
                  <Input type="number" value={formPurchasePrice} onChange={e => setFormPurchasePrice(e.target.value)} />
                </div>
                <div>
                  <Label>Satış Fiyatı (₺)</Label>
                  <Input type="number" value={formSalePrice} onChange={e => setFormSalePrice(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Mevcut Stok</Label>
                  <Input type="number" value={formStock} onChange={e => setFormStock(e.target.value)} />
                </div>
                <div>
                  <Label>Min. Stok Uyarısı</Label>
                  <Input type="number" value={formMinStock} onChange={e => setFormMinStock(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Açıklama</Label>
                <Textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowForm(false)}>İptal</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {editProduct ? 'Güncelle' : 'Ekle'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stock Add Dialog */}
        <Dialog open={showStockForm} onOpenChange={setShowStockForm}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Stok Ekle - {stockProduct?.name}</DialogTitle>
              <DialogDescription>Mevcut stok: {stockProduct?.current_stock}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Eklenecek Miktar *</Label>
                <Input type="number" value={stockQty} onChange={e => setStockQty(e.target.value)} />
              </div>
              <div>
                <Label>Açıklama</Label>
                <Input value={stockDesc} onChange={e => setStockDesc(e.target.value)} placeholder="Opsiyonel" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowStockForm(false)}>İptal</Button>
              <Button onClick={() => addStockMutation.mutate()} disabled={addStockMutation.isPending}>
                {addStockMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Stok Ekle
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stock History Dialog */}
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Stok Geçmişi</DialogTitle>
              <DialogDescription>Son hareketler</DialogDescription>
            </DialogHeader>
            <div className="max-h-64 overflow-y-auto">
              {stockMovements.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Hareket bulunamadı</p>
              ) : stockMovements.map(m => (
                <div key={m.id} className="flex items-center justify-between border-b py-2 last:border-0">
                  <div>
                    <Badge variant={m.type === 'in' ? 'default' : 'destructive'}>
                      {m.type === 'in' ? `+${m.quantity}` : `-${m.quantity}`}
                    </Badge>
                    {m.description && <span className="text-xs text-muted-foreground ml-2">{m.description}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">{format(new Date(m.created_at), 'dd MMM HH:mm', { locale: tr })}</span>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Category Add Dialog */}
        <Dialog open={showCategoryForm} onOpenChange={setShowCategoryForm}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Yeni Kategori</DialogTitle>
              <DialogDescription>Ürün kategorisi ekleyin</DialogDescription>
            </DialogHeader>
            <div>
              <Label>Kategori Adı *</Label>
              <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
            </div>
            {categories.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Mevcut: {categories.map(c => c.name).join(', ')}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCategoryForm(false)}>İptal</Button>
              <Button onClick={() => addCategoryMutation.mutate()} disabled={addCategoryMutation.isPending}>
                Ekle
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </StaffPageGuard>
  );
}
