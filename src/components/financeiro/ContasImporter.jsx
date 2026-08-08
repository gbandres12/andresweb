import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, FileText, FileSpreadsheet, Sparkles, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

const PAYMENT_METHODS = ['Dinheiro', 'PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Transferência', 'Outros'];
const DESPESA_CATS = ['Aluguel', 'Energia', 'Internet', 'Salários', 'Fornecedores', 'Marketing', 'Embalagens', 'Frete', 'Impostos', 'Outros'];
const RECEITA_CATS = ['Vendas', 'Serviços', 'Estorno', 'Outros'];

const TYPES = [
  { id: 'pdf', label: 'PDF', icon: FileText, hint: 'Boleto, nota, extrato' },
  { id: 'csv', label: 'CSV', icon: FileSpreadsheet, hint: 'Planilha de contas' },
  { id: 'xlsx', label: 'Excel', icon: FileSpreadsheet, hint: 'Planilha .xlsx/.xls' },
];

const ACCEPT = { pdf: '.pdf,application/pdf', csv: '.csv,text/csv', xlsx: '.xlsx,.xls' };

function fmtMoney(v) {
  const n = Number(v || 0);
  return (n < 0 ? '-' : '') + 'R$ ' + Math.abs(n).toFixed(2).replace('.', ',');
}

function guessMonth(dateStr) {
  if (!dateStr) return format(new Date(), 'yyyy-MM');
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr.length <= 10 ? dateStr + 'T00:00:00' : dateStr) : new Date(dateStr);
    if (isNaN(d)) return format(new Date(), 'yyyy-MM');
    return format(d, 'yyyy-MM');
  } catch { return format(new Date(), 'yyyy-MM'); }
}

export default function ContasImporter({ onClose, onImported }) {
  const [type, setType] = useState('pdf');
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [working, setWorking] = useState(false);
  const [stage, setStage] = useState(''); // 'extraindo' | 'classificando' | ''
  const [items, setItems] = useState([]);

  const onFile = async (f) => {
    if (!f) return;
    setFile(f); setFileUrl(''); setItems([]);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
      setFileUrl(file_url);
    } catch {
      toast.error('Erro ao enviar arquivo');
    }
  };

  const extractAndClassify = async () => {
    if (!fileUrl) { toast.error('Envie o arquivo primeiro'); return; }
    setWorking(true); setStage('extraindo'); setItems([]);
    try {
      // 1) Extrai linhas brutas do arquivo (PDF/CSV/XLSX)
      const raw = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: fileUrl,
        json_schema: {
          type: 'object',
          properties: {
            entries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  description: { type: 'string' },
                  amount: { type: 'number' },
                  date: { type: 'string' },
                  document_type: { type: 'string' },
                  counterparty: { type: 'string' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
      });
      if (raw.status !== 'success') throw new Error(raw.details || 'Falha na extração');
      const rows = Array.isArray(raw.output) ? raw.output : (raw.output?.entries || []);
      if (!rows.length) { toast.error('Nenhum lançamento encontrado no arquivo'); setWorking(false); setStage(''); return; }

      // 2) Classifica com IA: tipo, categoria, pagamento, status, vencimento, mês
      setStage('classificando');
      const llm = await base44.integrations.Core.InvokeLLM({
        prompt:
          'Você é um classificador financeiro de uma loja de roupas. Para cada lançamento, defina:\n' +
          '- type: "receita" (entrada/dinheiro recebido/venda) ou "despesa" (saída/custo/boleto/fornecedor)\n' +
          '- category: para despesa use um de ' + JSON.stringify(DESPESA_CATS) + '; para receita use um de ' + JSON.stringify(RECEITA_CATS) + '\n' +
          '- payment_method: um de ' + JSON.stringify(PAYMENT_METHODS) + '\n' +
          '- status: "pago" se já foi quitado/realizado, "pendente" se a pagar/a receber\n' +
          '- due_date: data de vencimento em ISO yyyy-mm-dd (se houver), senão vazio\n' +
          '- month: yyyy-mm de referência (do date/due_date), senão mês atual\n' +
          'Mantenha a descrição original (corrija só erros óbvios). amount sempre positivo.\n' +
          'Lançamentos:\n' + JSON.stringify(rows),
        response_json_schema: {
          type: 'object',
          properties: {
            entries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  description: { type: 'string' },
                  amount: { type: 'number' },
                  type: { type: 'string', enum: ['receita', 'despesa'] },
                  category: { type: 'string' },
                  payment_method: { type: 'string' },
                  status: { type: 'string', enum: ['pago', 'pendente', 'cancelado'] },
                  due_date: { type: 'string' },
                  month: { type: 'string' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
      });
      const classified = llm.entries || llm;

      // 3) Mescla: prioriza valores classificados, preserva contraparte em notes se faltante
      const merged = rows.map((r, i) => {
        const c = classified[i] || {};
        return {
          description: String(c.description || r.description || r.counterparty || 'Lançamento importado').trim(),
          amount: Math.abs(Number(c.amount ?? r.amount ?? 0)) || 0,
          type: c.type === 'receita' ? 'receita' : 'despesa',
          category: c.category || (c.type === 'receita' ? 'Outros' : 'Outros'),
          payment_method: PAYMENT_METHODS.includes(c.payment_method) ? c.payment_method : 'Outros',
          status: ['pago', 'pendente', 'cancelado'].includes(c.status) ? c.status : 'pendente',
          due_date: c.due_date || '',
          month: c.month || guessMonth(c.due_date || r.date),
          notes: c.notes || r.document_type || '',
        };
      }).filter(it => it.description && it.description !== 'Lançamento importado' || it.amount > 0);

      setItems(merged);
      setStage('');
      if (!merged.length) toast.error('Não foi possível identificar lançamentos');
      else toast.success(`${merged.length} lançamentos classificados pela IA`);
    } catch (e) {
      toast.error('Erro: ' + (e.message || ''));
    } finally {
      setWorking(false); setStage('');
    }
  };

  const update = (i, patch) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const remove = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const reset = () => { setItems([]); setFile(null); setFileUrl(''); };

  const totalReceita = items.filter(i => i.type === 'receita').reduce((s, i) => s + i.amount, 0);
  const totalDespesa = items.filter(i => i.type === 'despesa').reduce((s, i) => s + i.amount, 0);

  const importAll = async () => {
    if (!items.length) return;
    setWorking(true);
    try {
      await base44.entities.Transaction.bulkCreate(items.map(it => ({
        description: it.description, amount: it.amount, type: it.type, category: it.category,
        payment_method: it.payment_method, status: it.status, due_date: it.due_date || undefined,
        month: it.month, notes: it.notes,
      })));
      toast.success(`${items.length} lançamentos importados`);
      reset();
      onImported?.();
      onClose?.();
    } catch (e) {
      toast.error('Erro ao importar: ' + (e.message || ''));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Tipos de arquivo */}
      <div className="grid grid-cols-3 gap-3">
        {TYPES.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => { setType(t.id); reset(); }}
              className={cn("flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors text-center",
                type === t.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40")}>
              <Icon className={cn("w-5 h-5", type === t.id ? "text-primary" : "text-muted-foreground")} />
              <p className="text-sm font-semibold text-foreground">{t.label}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{t.hint}</p>
            </button>
          );
        })}
      </div>

      {/* Upload */}
      <label className="block cursor-pointer">
        <input type="file" accept={ACCEPT[type]} className="hidden" onChange={e => onFile(e.target.files?.[0])} />
        <div className="flex items-center gap-3 border-2 border-dashed border-border rounded-xl p-4 hover:border-primary/50 hover:bg-muted/40 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Upload className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{file ? file.name : 'Selecionar arquivo'}</p>
            <p className="text-xs text-muted-foreground">{file ? 'Enviado ✓' : `Formato ${type.toUpperCase()}`}</p>
          </div>
          <span className="text-sm text-primary font-medium">Escolher</span>
        </div>
      </label>

      <Button onClick={extractAndClassify} disabled={!fileUrl || working} className="w-full h-11">
        {working ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
        {working ? (stage === 'extraindo' ? 'Extraindo...' : 'Classificando com IA...') : 'Extrair e classificar com IA'}
      </Button>

      {/* Resumo */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <p className="text-[11px] text-muted-foreground uppercase">Receitas</p>
            <p className="text-sm font-serif font-semibold text-green-700 tabular-nums">{fmtMoney(totalReceita)}</p>
          </div>
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-center">
            <p className="text-[11px] text-muted-foreground uppercase">Despesas</p>
            <p className="text-sm font-serif font-semibold text-destructive tabular-nums">{fmtMoney(totalDespesa)}</p>
          </div>
          <div className="bg-muted border border-border rounded-xl p-3 text-center">
            <p className="text-[11px] text-muted-foreground uppercase">Saldo</p>
            <p className={cn("text-sm font-serif font-semibold tabular-nums", totalReceita - totalDespesa >= 0 ? "text-green-700" : "text-destructive")}>
              {fmtMoney(totalReceita - totalDespesa)}
            </p>
          </div>
        </div>
      )}

      {/* Preview editável */}
      {items.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/40">
            <p className="text-sm font-semibold text-foreground">{items.length} lançamentos classificados</p>
            <button onClick={reset} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Limpar
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Descrição</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase text-muted-foreground">Tipo</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase text-muted-foreground hidden md:table-cell">Categoria</th>
                  <th className="text-right px-2 py-2 text-xs font-semibold uppercase text-muted-foreground">Valor</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-1.5">
                      <Input value={it.description} onChange={e => update(i, { description: e.target.value })}
                        className="h-8 text-xs px-2 border-0 bg-transparent focus:bg-background" />
                      <p className="text-[11px] text-muted-foreground px-2">{it.month}{it.due_date ? ` · venc ${format(parseISO(it.due_date + 'T00:00:00'), 'dd/MM')}` : ''}</p>
                    </td>
                    <td className="px-2 py-1.5">
                      <Select value={it.type} onValueChange={v => update(i, { type: v })}>
                        <SelectTrigger className="h-8 w-[88px] text-xs px-2"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="receita">Receita</SelectItem>
                          <SelectItem value="despesa">Despesa</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1.5 hidden md:table-cell">
                      <Select value={it.category}
                        onValueChange={v => update(i, { category: v })}>
                        <SelectTrigger className="h-8 w-[120px] text-xs px-2"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(it.type === 'receita' ? RECEITA_CATS : DESPESA_CATS).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Input type="number" min="0" step="0.01" value={it.amount}
                        onChange={e => update(i, { amount: Number(e.target.value) || 0 })}
                        className={cn("h-8 w-24 text-xs text-right tabular-nums px-2 border-0 bg-transparent focus:bg-background",
                          it.type === 'receita' ? "text-green-600" : "text-destructive")} />
                    </td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => remove(i)} className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex gap-3">
          <Button variant="outline" onClick={reset} className="flex-1">Cancelar</Button>
          <Button onClick={importAll} disabled={working} className="flex-1">
            {working ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
            Importar {items.length} lançamentos
          </Button>
        </div>
      )}
    </div>
  );
}