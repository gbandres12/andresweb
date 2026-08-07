import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/StoreContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, UserPlus, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ROLES = [
  { key: 'vendedor', label: 'Vendedor' },
  { key: 'gerente', label: 'Gerente' },
  { key: 'caixa', label: 'Caixa' },
];

export default function SellersManager() {
  const { store, stores } = useStore();
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', role: 'vendedor', phone: '' });
  const [extraStores, setExtraStores] = useState([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Employee.list('-created_date', 200);
      setSellers(list || []);
    } catch {
      toast.error('Erro ao carregar vendedores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const otherStores = (stores || []).filter(s => s.id !== store?.id);

  const add = async () => {
    if (!form.name.trim()) { toast.error('Informe o nome do vendedor'); return; }
    setSaving(true);
    try {
      await base44.entities.Employee.create({
        name: form.name.trim(),
        role: form.role,
        phone: form.phone.trim(),
        store_id: store?.id,
        store_ids: extraStores,
        active: true,
      });
      toast.success('Vendedor adicionado');
      setForm({ name: '', role: 'vendedor', phone: '' });
      setExtraStores([]);
      setAdding(false);
      load();
    } catch {
      toast.error('Erro ao adicionar vendedor');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await base44.entities.Employee.delete(id);
      toast.success('Vendedor removido');
      load();
    } catch {
      toast.error('Erro ao remover');
    }
  };

  const toggleActive = async (s) => {
    try {
      await base44.entities.Employee.update(s.id, { active: !s.active });
      load();
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const toggleStore = (id) => {
    setExtraStores(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="text-lg font-serif font-semibold text-foreground">Vendedores / Equipe de vendas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Vendedores que aparecem no PDV. Podem atuar em várias lojas.</p>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <UserPlus className="w-4 h-4 mr-1" /> Adicionar vendedor
          </Button>
        )}
      </div>

      {adding && (
        <div className="px-5 py-4 bg-muted/40 border-b border-border space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <Input placeholder="Nome do vendedor *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
            <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Telefone (opcional)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          {otherStores.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Atua também em outras lojas:</p>
              <div className="flex flex-wrap gap-2">
                {otherStores.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleStore(s.id)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full border transition-colors",
                      extraStores.includes(s.id)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    {extraStores.includes(s.id) && <Check className="w-3 h-3 inline mr-1" />}
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={add} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />} Salvar vendedor
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setAdding(false); setForm({ name: '', role: 'vendedor', phone: '' }); setExtraStores([]); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : sellers.length === 0 ? (
        <div className="text-center text-muted-foreground py-10 text-sm">
          Nenhum vendedor cadastrado. Adicione vendedores para usar no PDV.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-muted-foreground">
                <th className="py-3 px-5 font-medium">Vendedor</th>
                <th className="py-3 px-4 font-medium">Função</th>
                <th className="py-3 px-4 font-medium">Lojas</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map(s => {
                const storeNames = [store?.name, ...(s.store_ids || []).map(id => stores?.find(x => x.id === id)?.name).filter(Boolean)].filter(Boolean);
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                          {s.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{s.name}</p>
                          {s.phone && <p className="text-xs text-muted-foreground">{s.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground capitalize">{s.role}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{storeNames.join(', ') || '—'}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleActive(s)}
                        className={cn(
                          "text-xs font-medium rounded-full px-2.5 py-1 border",
                          s.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border"
                        )}
                      >
                        {s.active ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remove(s.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}