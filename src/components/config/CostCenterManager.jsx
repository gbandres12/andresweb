import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Plus, Trash2, Pencil, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useStore } from '@/lib/StoreContext';
import { cn } from '@/lib/utils';

export default function CostCenterManager() {
  const { store } = useStore();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', description: '', responsible_name: '', is_active: true });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.CostCenter.list('-is_active', 200);
      setItems(list || []);
    } catch {
      toast({ title: 'Erro ao carregar centros de custo', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', code: '', description: '', responsible_name: '', is_active: true });
    setOpen(true);
  };

  const openEdit = (it) => {
    setEditing(it);
    setForm({ name: it.name || '', code: it.code || '', description: it.description || '', responsible_name: it.responsible_name || '', is_active: it.is_active !== false });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast({ title: 'Informe o nome do centro de custo', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload = { ...form, store_id: store?.id };
      if (editing) await base44.entities.CostCenter.update(editing.id, payload);
      else await base44.entities.CostCenter.create(payload);
      toast({ title: editing ? 'Centro de custo atualizado' : 'Centro de custo criado' });
      setOpen(false);
      await load();
    } catch {
      toast({ title: 'Erro ao salvar centro de custo', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Excluir este centro de custo? Despesas já registradas continuarão com o nome salvo.')) return;
    try {
      await base44.entities.CostCenter.delete(id);
      toast({ title: 'Centro de custo excluído' });
      await load();
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-2xl p-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> Centros de Custo
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Organize despesas por áreas (loja, e-commerce, administrativo...) para acompanhar o custo de cada setor da empresa.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4" /> Novo centro de custo
        </Button>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-muted-foreground">
                <th className="py-3 px-5 font-medium">Centro de custo</th>
                <th className="py-3 px-4 font-medium hidden sm:table-cell">Código</th>
                <th className="py-3 px-4 font-medium hidden md:table-cell">Responsável</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-5">
                    <p className="font-medium text-foreground">{it.name}</p>
                    {it.description && <p className="text-xs text-muted-foreground truncate max-w-xs">{it.description}</p>}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground font-mono text-xs hidden sm:table-cell">{it.code || '—'}</td>
                  <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{it.responsible_name || '—'}</td>
                  <td className="py-3 px-4">
                    <span className={cn(
                      'inline-flex text-[11px] font-medium rounded-full px-2 py-0.5 border',
                      it.is_active !== false ? 'bg-green-50 text-green-700 border-green-200' : 'bg-muted text-muted-foreground border-border'
                    )}>
                      {it.is_active !== false ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(it)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => remove(it.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Excluir">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">Nenhum centro de custo cadastrado ainda.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar centro de custo' : 'Novo centro de custo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5">Nome *</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Loja física" />
              </div>
              <div>
                <Label className="mb-1.5">Código</Label>
                <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="Ex: CC-01" />
              </div>
            </div>
            <div>
              <Label className="mb-1.5">Responsável</Label>
              <Input value={form.responsible_name} onChange={e => setForm(p => ({ ...p, responsible_name: e.target.value }))} placeholder="Ex: Ana Silva" />
            </div>
            <div>
              <Label className="mb-1.5">Descrição</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Opcional" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <Label htmlFor="cc-active" className="text-sm font-normal cursor-pointer">Centro ativo</Label>
              <Switch id="cc-active" checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editing ? 'Salvar alterações' : 'Criar centro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}