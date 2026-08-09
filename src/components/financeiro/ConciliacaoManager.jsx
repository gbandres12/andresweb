import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { FileUp, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { parseOfx } from '@/lib/ofx';
import { cn } from '@/lib/utils';

const fmt = v => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;

export default function ConciliacaoManager({ transactions, onRefresh }) {
  const [entries, setEntries] = useState(null);
  const [source, setSource] = useState('banco');
  const [fileName, setFileName] = useState('');
  const [processing, setProcessing] = useState(false);

  const pendingReceitas = useMemo(
    () => transactions.filter(t => t.type === 'receita' && t.status === 'pendente'),
    [transactions]
  );

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseOfx(text);
      setSource(parsed.source);
      const used = new Set();
      const preview = parsed.transactions.map(tx => {
        const match = pendingReceitas.find(t =>
          !used.has(t.id) && tx.amount > 0 && Math.abs((t.amount || 0) - tx.amount) < 0.5
        );
        if (match) used.add(match.id);
        return { ...tx, type: tx.amount >= 0 ? 'receita' : 'despesa', matched: match || null };
      });
      setEntries({ source: parsed.source, transactions: preview });
      toast.success(`${preview.length} lançamento(s) lido(s) do arquivo`);
    } catch {
      toast.error('Não foi possível ler o arquivo OFX/EDI');
    }
    e.target.value = '';
  };

  const confirmBaixa = async () => {
    if (!entries) return;
    setProcessing(true);
    try {
      const rows = [];
      let conciliated = 0;
      for (const tx of entries.transactions) {
        let status = 'pendente';
        let matchedId = null;
        if (tx.matched) {
          await base44.entities.Transaction.update(tx.matched.id, {
            status: 'pago',
            paid_date: tx.date || format(new Date(), 'yyyy-MM-dd'),
          });
          status = 'conciliado';
          matchedId = tx.matched.id;
          conciliated++;
        }
        rows.push({
          source: entries.source,
          file_name: fileName,
          date: tx.date,
          amount: tx.amount,
          description: tx.description,
          fitid: tx.fitid,
          type: tx.type,
          status,
          matched_transaction_id: matchedId,
        });
      }
      if (rows.length) await base44.entities.ConciliationEntry.bulkCreate(rows);
      toast.success(`${conciliated} recebível(is) baixado(s) automaticamente`);
      setEntries(null);
      setFileName('');
      onRefresh();
    } catch {
      toast.error('Erro ao processar conciliação');
    } finally {
      setProcessing(false);
    }
  };

  const conciliados = entries?.transactions.filter(t => t.matched).length || 0;
  const semMatch = entries?.transactions.filter(t => !t.matched).length || 0;

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-card shadow-sm rounded-2xl border border-slate-200 dark:border-border p-5">
        <h3 className="font-serif text-lg font-semibold mb-1 text-slate-900 dark:text-slate-100">Conciliação Bancária e de Cartões</h3>
        <p className="text-sm text-slate-500 dark:text-muted-foreground mb-4">
          Importe um arquivo OFX/EDI de extrato bancário ou de adquirente de cartão. Recebíveis em aberto
          com valor correspondente são baixados automaticamente.
        </p>
        <label className="flex items-center gap-3 cursor-pointer border-2 border-dashed border-border rounded-xl p-4 hover:border-primary transition-colors">
          <FileUp className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium">{fileName || 'Selecionar arquivo OFX/EDI...'}</span>
          <input type="file" accept=".ofx,.edi,.qfx,.txt" className="hidden" onChange={handleFile} />
        </label>
        {entries && (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <span className="text-xs px-2.5 py-1 rounded-full bg-muted font-medium">
              {source === 'cartao' ? 'Cartão' : 'Banco'}
            </span>
            <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">{conciliados} conciliado(s)</span>
            <span className="text-sm text-amber-700 font-medium">{semMatch} sem match</span>
            <Button onClick={confirmBaixa} disabled={processing} className="ml-auto">
              {processing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
              Confirmar Baixa
            </Button>
          </div>
        )}
      </div>

      {entries && (
        <div className="bg-white dark:bg-card shadow-sm rounded-2xl border border-slate-200 dark:border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-muted/40 border-b border-slate-200 dark:border-border">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 dark:text-muted-foreground uppercase">Data</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-muted-foreground uppercase">Descrição</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-muted-foreground uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 dark:text-muted-foreground uppercase">Valor</th>
              </tr>
            </thead>
            <tbody>
              {entries.transactions.map((tx, i) => (
                <tr key={i} className="border-b border-slate-200 dark:border-border last:border-0 hover:bg-slate-50 dark:hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3 text-sm">
                    {tx.date ? format(new Date(tx.date + 'T00:00:00'), 'dd/MM/yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">{tx.description || '—'}</td>
                  <td className="px-4 py-3">
                    {tx.matched ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 font-medium flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3 h-3" /> Conciliado · {tx.matched.description}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-medium flex items-center gap-1 w-fit">
                        <AlertCircle className="w-3 h-3" /> Sem match
                      </span>
                    )}
                  </td>
                  <td className={cn('px-4 py-3 text-right text-sm font-semibold tabular-nums', tx.amount >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-destructive')}>
                    {tx.amount >= 0 ? '+' : '-'} {fmt(Math.abs(tx.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}