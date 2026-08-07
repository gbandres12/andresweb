import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Edit2, Trash2, Trophy, ShoppingBag, TrendingUp, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function Clientes() {
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('lista'); // 'lista' | 'ranking'
  const [promoOnly, setPromoOnly] = useState(false);

  const load = () => Promise.all([
    base44.entities.Customer.list('-created_date'),
    base44.entities.Sale.filter({ status: 'concluida' }, '-created_date', 500),
  ]).then(([c, s]) => { setCustomers(c); setSales(s); setLoading(false); });

  useEffect(() => { load(); }, []);

  // Build ranking from real sales data
  const ranking = (() => {
    const map = {};
    sales.forEach(sale => {
      const key = (sale.customer_name || '').trim().toLowerCase();
      if (!key) return;
      if (!map[key]) map[key] = { name: sale.customer_name, phone: sale.customer_phone, totalSpent: 0, totalOrders: 0 };
      map[key].totalSpent += sale.total || 0;
      map[key].totalOrders += 1;
    });
    return Object.values(map).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 20);
  })();

  const promoCount = customers.filter(c => c.marketing_opt_in).length;
  const filtered = customers.filter(c =>
    (c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.whatsapp?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())) &&
    (!promoOnly || c.marketing_opt_in)
  );

  const openEdit = (c) => { setEditing(c); setShowForm(true); };
  const openNew = () => { setEditing(null); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); load(); };

  const deleteCustomer = async (id) => {
    await base44.entities.Customer.delete(id);
    toast.success('Cliente excluído');
    load();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-serif font-semibold">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{customers.length} clientes cadastrados</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Novo Cliente</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {[
          { key: 'lista', label: 'Lista de Clientes', icon: Search },
          { key: 'ranking', label: 'Melhores Clientes', icon: Trophy },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Ranking Tab */}
      {tab === 'ranking' && (
        <div className="space-y-4">
          {ranking.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">Nenhuma venda com cliente identificado ainda.</div>
          ) : (
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide w-10">#</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Pedidos</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Gasto</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Ticket Médio</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((c, i) => (
                    <tr key={c.name} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          i === 0 ? 'bg-amber-100 text-amber-600' :
                          i === 1 ? 'bg-slate-100 text-slate-500' :
                          i === 2 ? 'bg-orange-50 text-orange-500' :
                          'text-muted-foreground'
                        }`}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-sm font-medium text-primary shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{c.name}</p>
                            {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <ShoppingBag className="w-3.5 h-3.5" /> {c.totalOrders}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-serif font-semibold text-primary text-sm">
                          R$ {c.totalSpent.toFixed(2).replace('.', ',')}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">
                          R$ {(c.totalSpent / c.totalOrders).toFixed(2).replace('.', ',')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Lista Tab */}
      {tab === 'lista' && <>
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, telefone, WhatsApp ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 max-w-md" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => setPromoOnly(p => !p)} className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors", promoOnly ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-border text-muted-foreground hover:text-foreground")}>
          <MessageCircle className="w-3.5 h-3.5" /> {promoCount} cliente(s) aceitam promoções
          {promoOnly && <span className="text-emerald-700">· filtrando</span>}
        </button>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-5 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">Nome</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Telefone</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">E-mail</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Promoções</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Compras</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-sm font-medium text-primary">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-sm">{c.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{c.phone || '—'}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">{c.email || '—'}</td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {c.marketing_opt_in
                    ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><MessageCircle className="w-3 h-3" /> {c.marketing_channel || 'whatsapp'}</span>
                    : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="text-sm font-medium text-primary">R$ {(c.total_spent || 0).toFixed(2)}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 justify-end">
                    {c.whatsapp && (
                      <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600" title="Abrir WhatsApp">
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteCustomer(c.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center text-muted-foreground py-12">Nenhum cliente encontrado</div>}
      </div>
      </>}

      <Dialog open={showForm} onOpenChange={v => { if (!v) closeForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{editing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
          </DialogHeader>
          <CustomerForm customer={editing} onClose={closeForm} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerForm({ customer, onClose }) {
  const [form, setForm] = useState({
    name: customer?.name || '',
    phone: customer?.phone || '',
    whatsapp: customer?.whatsapp || '',
    email: customer?.email || '',
    cpf: customer?.cpf || '',
    birthdate: customer?.birthdate || '',
    address: customer?.address || '',
    notes: customer?.notes || '',
    marketing_opt_in: customer?.marketing_opt_in ?? false,
    marketing_channel: customer?.marketing_channel || 'whatsapp',
  });
  const [saving, setSaving] = useState(false);
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const save = async () => {
    if (!form.name) { toast.error('Nome obrigatório'); return; }
    setSaving(true);
    if (customer) {
      await base44.entities.Customer.update(customer.id, form);
      toast.success('Cliente atualizado');
    } else {
      await base44.entities.Customer.create(form);
      toast.success('Cliente cadastrado');
    }
    setSaving(false);
    onClose();
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Nome *</label>
        <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nome completo" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Telefone</label>
          <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(00) 00000-0000" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">CPF</label>
          <Input value={form.cpf} onChange={e => set('cpf', e.target.value)} placeholder="000.000.000-00" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">WhatsApp para promoções / disparos</label>
        <Input value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="(00) 00000-0000" />
      </div>
      <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/30">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Aceita receber promoções e disparos</p>
            <p className="text-xs text-muted-foreground">O vendedor confirma o consentimento do cliente (LGPD).</p>
          </div>
          <Switch checked={!!form.marketing_opt_in} onCheckedChange={v => set('marketing_opt_in', v)} />
        </div>
        {form.marketing_opt_in && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Canal preferido:</span>
            <Select value={form.marketing_channel} onValueChange={v => set('marketing_channel', v)}>
              <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="ambos">WhatsApp e SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">E-mail</label>
        <Input value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Data de Nascimento</label>
        <Input type="date" value={form.birthdate} onChange={e => set('birthdate', e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Endereço</label>
        <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Rua, número, bairro..." />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Observações</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background resize-none h-16" placeholder="Tamanhos preferidos, preferências..." />
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button onClick={save} disabled={saving} className="flex-1">{saving ? 'Salvando...' : 'Salvar'}</Button>
      </div>
    </div>
  );
}