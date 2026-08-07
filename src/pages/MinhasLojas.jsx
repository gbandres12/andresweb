import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Building2, Plus, Pencil, Check, Star, Loader2, Store as StoreIcon } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import StoreForm from '@/components/StoreForm';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PLAN_LABEL = { free: 'Free', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' };

export default function MinhasLojas() {
  const navigate = useNavigate();
  const { store, stores, loading, switchStore, reload } = useStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [switching, setSwitching] = useState(null);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (s) => { setEditing(s); setFormOpen(true); };

  const activate = async (s) => {
    setSwitching(s.id);
    try {
      await switchStore(s.id);
      toast.success(`Loja ativa: ${s.name}`);
      navigate('/');
    } catch {
      toast.error('Erro ao trocar de loja');
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl lg:text-4xl font-serif font-semibold text-foreground tracking-tight">Minhas Lojas</h1>
          <p className="text-muted-foreground text-sm mt-1">Crie novas lojas e alterne entre elas a qualquer momento.</p>
        </div>
        <Button onClick={openNew} className="h-11">
          <Plus className="w-4 h-4 mr-2" /> Nova Loja
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : stores.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center">
          <StoreIcon className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Você ainda não possui lojas.</p>
          <Button onClick={openNew} className="mt-4">
            <Plus className="w-4 h-4 mr-2" /> Criar primeira loja
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map(s => {
            const active = store?.id === s.id;
            return (
              <div
                key={s.id}
                className={cn(
                  "bg-card border rounded-2xl p-5 flex flex-col",
                  active ? "border-primary shadow-sm" : "border-border"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  {active && (
                    <span className="text-[10px] uppercase tracking-wider font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      Ativa
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-foreground mt-3 truncate">{s.name}</h3>
                <p className="text-xs text-muted-foreground truncate">{s.cnpj || 'Sem CNPJ'}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{s.address || 'Sem endereço'}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] uppercase tracking-wider bg-accent text-accent-foreground px-2 py-0.5 rounded-full font-semibold">
                    {PLAN_LABEL[s.plan] || s.plan}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.status}</span>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  {active ? (
                    <Button disabled variant="secondary" className="flex-1">
                      <Check className="w-4 h-4 mr-2" /> Em uso
                    </Button>
                  ) : (
                    <Button onClick={() => activate(s)} disabled={switching === s.id} className="flex-1">
                      {switching === s.id ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Star className="w-4 h-4 mr-2" />
                      )}
                      Ativar
                    </Button>
                  )}
                  <Button variant="outline" size="icon" onClick={() => openEdit(s)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <StoreForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editing}
        onSaved={() => reload()}
      />
    </div>
  );
}