import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

const NATUREZAS = ['Varejo', 'Atacado', 'Varejo e Atacado', 'Prestação de Serviços'];
const TIPOS = ['Dinheiro', 'PIX', 'Cartão Crédito', 'Cartão Débito', 'Crediário', 'Vale', 'Outro'];

export default function OperacoesTab({ value, onChange }) {
  const set = (k, v) => onChange({ [k]: v });
  const fp = value.formas_pagamento || [];
  const setFp = (i, patch) => onChange({ formas_pagamento: fp.map((x, idx) => idx === i ? { ...x, ...patch } : x) });
  const addFp = () => onChange({ formas_pagamento: [...fp, { tipo: 'Outro', descricao: '', aceita: true }] });
  const delFp = (i) => onChange({ formas_pagamento: fp.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-6">
      <div className="max-w-sm">
        <Label className="mb-1.5 block">Natureza de venda</Label>
        <Select value={value.natureza_venda || 'Varejo'} onValueChange={v => set('natureza_venda', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {NATUREZAS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Formas de pagamento integradas</Label>
          <Button variant="outline" size="sm" onClick={addFp}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
          </Button>
        </div>
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden bg-card">
          <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 bg-muted/40 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <div className="col-span-4">Tipo</div>
            <div className="col-span-6">Descrição no cupom</div>
            <div className="col-span-1 text-center">Ativa</div>
            <div className="col-span-1"></div>
          </div>
          {fp.map((f, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2 px-3 py-2.5">
              <div className="col-span-12 sm:col-span-4">
                <Select value={f.tipo} onValueChange={v => setFp(i, { tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-9 sm:col-span-6">
                <Input value={f.descricao || ''} onChange={e => setFp(i, { descricao: e.target.value })} placeholder="Descrição exibida no cupom" />
              </div>
              <div className="col-span-2 sm:col-span-1 flex justify-center">
                <Switch checked={!!f.aceita} onCheckedChange={v => setFp(i, { aceita: v })} />
              </div>
              <div className="col-span-1 flex justify-end">
                <button onClick={() => delFp(i)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {fp.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhuma forma de pagamento configurada.</div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">Estas formas aparecerão no PDV e serão enviadas no cupom fiscal quando a emissão estiver ativa.</p>
      </div>
    </div>
  );
}