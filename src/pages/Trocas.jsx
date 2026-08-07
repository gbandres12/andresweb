import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { RefreshCw, Plus, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ExchangeForm from '@/components/exchange/ExchangeForm';

const BRL = v => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const REASON_LABEL = { defeito: 'Defeito', tamanho: 'Tamanho', cor: 'Cor', modelo: 'Modelo', arrependimento: 'Arrependimento', outros: 'Outros' };

export default function Trocas() {
  const [tab, setTab] = useState('historico');
  const [exchanges, setExchanges] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => base44.entities.Exchange.list('-created_date', 200).then(e => { setExchanges(e); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  if (tab === 'nova') {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <Button variant="ghost" size="icon" onClick={() => setTab('historico')}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-3xl font-serif font-semibold flex items-center gap-2"><RefreshCw className="w-7 h-7 text-primary" /> Nova troca</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Devolva peças da venda original e entregue novas peças — diferença calculada automaticamente</p>
          </div>
        </div>
        <ExchangeForm onDone={() => { setTab('historico'); load(); }} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-serif font-semibold flex items-center gap-2"><RefreshCw className="w-7 h-7 text-primary" /> Trocas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Histórico de trocas e devoluções de peças</p>
        </div>
        <Button onClick={() => setTab('nova')}><Plus className="w-4 h-4 mr-2" /> Nova troca</Button>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-5 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">Troca</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">Venda original</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Cliente</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Motivo</th>
              <th className="text-right px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">Diferença</th>
              <th className="text-left px-4 py-3 text-xs font-sans font-medium text-muted-foreground uppercase tracking-wide">Data</th>
            </tr>
          </thead>
          <tbody>
            {exchanges.map(e => (
              <tr key={e.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-5 py-3 font-mono text-sm font-medium">{e.exchange_number}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{e.original_sale_number || '—'}</td>
                <td className="px-4 py-3 text-sm hidden sm:table-cell">{e.customer_name || 'Consumidor'}</td>
                <td className="px-4 py-3 hidden md:table-cell"><span className="text-xs bg-muted px-2 py-0.5 rounded-full">{REASON_LABEL[e.reason] || e.reason}</span></td>
                <td className={cn("px-4 py-3 text-sm text-right font-semibold", e.difference > 0 ? "text-amber-600" : e.difference < 0 ? "text-emerald-600" : "text-muted-foreground")}>
                  {e.difference > 0 ? `+${BRL(e.difference)}` : e.difference < 0 ? `-${BRL(Math.abs(e.difference))}` : BRL(0)}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(e.created_date).toLocaleDateString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="text-center text-muted-foreground py-12">Carregando...</div>}
        {!loading && exchanges.length === 0 && <div className="text-center text-muted-foreground py-12">Nenhuma troca registrada</div>}
      </div>
    </div>
  );
}