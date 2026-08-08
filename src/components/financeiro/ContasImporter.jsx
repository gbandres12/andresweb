import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/StoreContext';
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

// Extrai o número da venda do prefixo numérico da descrição (ex.: "56 Pagamento de Cliente em dinheiro" -> 56)
function extractSaleNumber(desc) {
  const m = String(desc || '').trim().match(/^(\d{1,5})\s+(.*)$/);
  if (m) return { saleNumber: m[1], cleanDesc: m[2].trim() };
  return { saleNumber: '', cleanDesc: String(desc || '').trim() };
}

// Limpa o terceiro: "DIVERSOS (DIARIA DO PUXADOR ALE..." -> "DIARIA DO PUXADOR ALE"
function cleanCounterparty(cp) {
  let s = String(cp || '').trim();
  const m = s.match(/\(([^)]*)/);
  if (m) s = m[1].trim();
  return s.replace(/\.{2,}/g, '').replace(/\)+$/g, '').trim();
}

function guessPaymentMethod(desc) {
  const s = String(desc || '').toLowerCase();
  if (/pix/.test(s)) return 'PIX';
  if (/cart[aã]o\s+d[eé]b/.test(s)) return 'Cartão de Débito';
  if (/cart[aã]o\s+cr/.test(s) || /cart[aã]o/.test(s)) return 'Cartão de Crédito';
  if (/transfer/.test(s)) return 'Transferência';
  if (/dinheiro/.test(s)) return 'Dinheiro';
  return 'Outros';
}

function guessDespesaCategory(desc) {
  const s = String(desc || '').toLowerCase();
  if (/sal[aá]r|pagamento dany|funcion/.test(s)) return 'Salários';
  if (/fornecedor/.test(s)) return 'Fornecedores';
  if (/aluguel/.test(s)) return 'Aluguel';
  if (/energia|luz/.test(s)) return 'Energia';
  if (/internet/.test(s)) return 'Internet';
  if (/marketing|faceb|insta|an[uú]ncio/.test(s)) return 'Marketing';
  if (/frete/.test(s)) return 'Frete';
  if (/imposto/.test(s)) return 'Impostos';
  if (/embalagem|sacola/.test(s)) return 'Embalagens';
  return 'Outros';
}

export default function ContasImporter({ onClose, onImported }) {
  const { store } = useStore();
  const [type, setType] = useState('pdf');
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [working, setWorking] = useState(false);
  const [stage, setStage] = useState('');
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
      // 1) Extrai linhas com colunas separadas de débito/crédito + terceiro + data + saldo
      const raw = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: fileUrl,
        json_schema: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'Texto da coluna Descrição' },
            counterparty: { type: 'string', description: 'Texto da coluna Terceiro (quem pagou/recebeu, ex.: BALCAO NINA STAR, nome do cliente)' },
            debito: { type: 'number', description: 'Valor da coluna Débito (saída). 0 se vazio' },
            credito: { type: 'number', description: 'Valor da coluna Crédito (entrada). 0 se vazio' },
            date: { type: 'string', description: 'Data do lançamento em ISO yyyy-mm-dd, se houver' },
            saldo: { type: 'number', description: 'Saldo acumulado da linha, se houver' },
          },
        },
      });
      if (raw.status !== 'success') throw new Error(raw.details || 'Falha na extração');
      const rows = Array.isArray(raw.output) ? raw.output : (raw.output ? [raw.output] : []);
      if (!rows.length) { toast.error('Nenhum lançamento encontrado no arquivo'); setWorking(false); setStage(''); return; }

      // 2) Pré-processa: tipo e valor são determinísticos a partir de débito/crédito
      const pre = rows.map(r => {
        const debit = Number(r.debito || 0);
        const credit = Number(r.credito || 0);
        const type = credit > 0 ? 'receita' : (debit > 0 ? 'despesa' : 'despesa');
        const amount = Math.abs(credit || debit || 0);
        const { saleNumber } = extractSaleNumber(r.description);
        return {
          description: String(r.description || r.counterparty || 'Lançamento').trim(),
          counterparty: cleanCounterparty(r.counterparty),
          saleNumber,
          date: r.date || '',
          saldo: Number(r.saldo || 0),
          debit, credit, amount, type,
        };
      }).filter(r => r.amount > 0 || (r.description && r.description !== 'Lançamento'));

      // 3) IA apenas para categoria e forma de pagamento (tipo já está definido)
      setStage('classificando');
      let classified = [];
      try {
        const llm = await base44.integrations.Core.InvokeLLM({
          prompt:
            'Você é um classificador financeiro de uma loja de roupas. Para cada lançamento (com tipo já definido), defina apenas:\n' +
            '- category: para despesa use um de ' + JSON.stringify(DESPESA_CATS) + '; para receita use um de ' + JSON.stringify(RECEITA_CATS) + '\n' +
            '- payment_method: um de ' + JSON.stringify(PAYMENT_METHODS) + '\n' +
            'Use a descrição e o terceiro para decidir. Mantenha EXATAMENTE a ordem e a quantidade dos lançamentos.\n' +
            'Lançamentos:\n' + JSON.stringify(pre.map(p => ({ description: p.description, counterparty: p.counterparty, type: p.type, amount: p.amount }))),
          response_json_schema: {
            type: 'object',
            properties: {
              entries: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    category: { type: 'string' },
                    payment_method: { type: 'string' },
                  },
                },
              },
            },
          },
        });
        classified = llm.entries || [];
      } catch { classified = []; }

      // 4) Mescla: deterministic type + sale number + counterparty + date; IA só enriquece categoria/pagamento
      const merged = pre.map((r, i) => {
        const c = classified[i] || {};
        const category = (r.type === 'receita' ? RECEITA_CATS : DESPESA_CATS).includes(c.category)
          ? c.category
          : (r.type === 'receita' ? 'Vendas' : guessDespesaCategory(r.description));
        const payment_method = PAYMENT_METHODS.includes(c.payment_method)
          ? c.payment_method
          : guessPaymentMethod(r.description);
        return {
          description: r.description,
          counterparty: r.counterparty,
          sale_number: r.saleNumber,
          date: r.date,
          saldo: r.saldo,
          amount: r.amount,
          type: r.type,
          category,
          payment_method,
          status: 'pago',
          due_date: r.date || '',
          paid_date: r.date || '',
          month: guessMonth(r.date),
          notes: r.saleNumber ? `Venda nº ${r.saleNumber}` : '',
        };
      });

      setItems(merged);
      setStage('');
      if (!merged.length) toast.error('Não foi possível identificar lançamentos');
      else toast.success(`${merged.length} lançamentos identificados`);
    } catch (e) {
      toast.error('Erro: ' + (e.message || ''));
    } finally {
      setWorking(false);
      setStage('');
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
        store_id: store?.id,
        description: it.description,
        amount: it.amount,
        type: it.type,
        category: it.category,
        payment_method: it.payment_method,
        customer_name: it.counterparty || '',
        status: it.status,
        due_date: it.due_date || undefined,
        paid_date: it.paid_date || undefined,
        month: it.month,
        notes: it.notes,
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
            <p className="text-[11px] text-muted-foreground uppercase">Receitas (crédito)</p>
            <p className="text-sm font-serif font-semibold text-green-700 tabular-nums">{fmtMoney(totalReceita)}</p>
          </div>
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-center">
            <p className="text-[11px] text-muted-foreground uppercase">Despesas (débito)</p>
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
            <p className="text-sm font-semibold text-foreground">{items.length} lançamentos identificados</p>
            <button onClick={reset} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Limpar
            </button>
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Descrição</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase text-muted-foreground hidden md:table-cell">Terceiro</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase text-muted-foreground">Nº</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase text-muted-foreground hidden lg:table-cell">Data</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase text-muted-foreground">Tipo</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase text-muted-foreground hidden md:table-cell">Categoria</th>
                  <th className="text-right px-2 py-2 text-xs font-semibold uppercase text-muted-foreground">Valor</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-1.5 align-top">
                      <Input value={it.description} onChange={e => update(i, { description: e.target.value })}
                        className="h-8 text-xs px-2 border-0 bg-transparent focus:bg-background" />
                      <p className="text-[11px] text-muted-foreground px-2">
                        {it.month}
                        {it.saldo ? ` · saldo ${fmtMoney(it.saldo)}` : ''}
                      </p>
                    </td>
                    <td className="px-2 py-1.5 align-top hidden md:table-cell">
                      <Input value={it.counterparty} onChange={e => update(i, { counterparty: e.target.value })}
                        className="h-8 text-xs px-2 border-0 bg-transparent focus:bg-background" />
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <Input value={it.sale_number} onChange={e => update(i, { sale_number: e.target.value })}
                        className="h-8 w-12 text-xs px-2 tabular-nums border-0 bg-transparent focus:bg-background" />
                    </td>
                    <td className="px-2 py-1.5 align-top hidden lg:table-cell">
                      <Input value={it.date} onChange={e => update(i, { date: e.target.value, due_date: e.target.value, paid_date: e.target.value, month: guessMonth(e.target.value) })}
                        className="h-8 text-xs px-2 border-0 bg-transparent focus:bg-background" placeholder="aaaa-mm-dd" />
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <Select value={it.type} onValueChange={v => update(i, { type: v })}>
                        <SelectTrigger className="h-8 w-[88px] text-xs px-2"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="receita">Receita</SelectItem>
                          <SelectItem value="despesa">Despesa</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1.5 align-top hidden md:table-cell">
                      <Select value={it.category} onValueChange={v => update(i, { category: v })}>
                        <SelectTrigger className="h-8 w-[120px] text-xs px-2"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(it.type === 'receita' ? RECEITA_CATS : DESPESA_CATS).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1.5 align-top text-right">
                      <Input type="number" min="0" step="0.01" value={it.amount}
                        onChange={e => update(i, { amount: Number(e.target.value) || 0 })}
                        className={cn("h-8 w-24 text-xs text-right tabular-nums px-2 border-0 bg-transparent focus:bg-background",
                          it.type === 'receita' ? "text-green-600" : "text-destructive")} />
                    </td>
                    <td className="px-2 py-1.5 align-top">
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