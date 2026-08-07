import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileText, Loader2, Upload, Store as StoreIcon, ChevronRight, ChevronDown,
  PackagePlus, CheckCircle2, AlertTriangle, X, FileCheck2
} from 'lucide-react';
import { toast } from 'sonner';
import { parseNFeXml, processImport } from '@/lib/nfe';
import { cn } from '@/lib/utils';

export default function ImportarNFe() {
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState('');
  const [markup, setMarkup] = useState(100);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [notas, setNotas] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.Store.list();
        setStores(list || []);
        if (list.length) setStoreId(list[0].id);
      } catch {
        toast.error('Erro ao carregar lojas');
      }
    })();
  }, []);

  const onFiles = async (selected) => {
    setUploading(true);
    const uploaded = [];
    for (const f of selected) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        uploaded.push({ name: f.name, url: file_url });
      } catch {
        toast.error(`Erro ao enviar ${f.name}`);
      }
    }
    setFiles(prev => [...prev, ...uploaded]);
    setUploading(false);
  };

  const analyze = async () => {
    if (!files.length) { toast.error('Envie ao menos um XML de nota fiscal'); return; }
    setParsing(true); setNotas([]); setResults(null);
    try {
      const all = [];
      for (const f of files) {
        const txt = await fetch(f.url).then(r => r.text());
        const parsed = parseNFeXml(txt);
        if (!parsed.length) toast.error(`${f.name}: nenhum item encontrado (verifique se é um XML de NFe)`);
        all.push(...parsed);
      }
      setNotas(all);
      if (all.length) toast.success(`${all.length} nota(s) · ${all.reduce((a, n) => a + n.items.length, 0)} itens`);
    } catch (e) {
      toast.error('Erro ao ler XML: ' + (e.message || ''));
    } finally {
      setParsing(false);
    }
  };

  const totalItems = notas.reduce((a, n) => a + n.items.length, 0);
  const totalValue = notas.reduce((a, n) => a + n.items.reduce((s, i) => s + i.vProd, 0), 0);
  const storeName = stores.find(s => s.id === storeId)?.name || '';

  const runImport = async () => {
    if (!storeId) { toast.error('Selecione a loja de destino'); return; }
    if (!notas.length) { toast.error('Nenhuma nota analisada'); return; }
    setImporting(true); setProgress({ done: 0, total: totalItems }); setResults(null);
    try {
      const res = await processImport(storeId, notas, markup, (done, total) => setProgress({ done, total }));
      setResults(res);
      toast.success(`${res.created} criados · ${res.updated} atualizados · ${res.movements} entradas${storeName ? ' em ' + storeName : ''}`);
      setNotas([]); setFiles([]);
    } catch (e) {
      toast.error('Erro na importação: ' + (e.message || ''));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl lg:text-4xl font-serif font-semibold text-foreground tracking-tight">Importar XML de Notas Fiscais</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Importe NF-e de fornecedor e preencha produtos + estoque automaticamente em uma das lojas.
        </p>
      </div>

      {/* Configuração */}
      <div className="bg-card border border-border rounded-2xl p-5 grid sm:grid-cols-2 gap-5">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
            <StoreIcon className="w-3.5 h-3.5" /> Loja de destino
          </Label>
          <Select value={storeId} onValueChange={setStoreId} disabled={!stores.length}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
            <SelectContent>
              {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{stores.length} loja(s) disponível(is)</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide">Markup sobre custo (%)</Label>
          <Input type="number" value={markup} onChange={e => setMarkup(e.target.value)} className="h-10 tabular-nums" />
          <p className="text-xs text-muted-foreground">Preço de venda = custo × (1 + markup). Aplicado só a produtos novos.</p>
        </div>
      </div>

      {/* Upload */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <label className="block cursor-pointer">
          <input type="file" accept=".xml,text/xml,application/xml" multiple className="hidden"
            onChange={e => onFiles(Array.from(e.target.files))} />
          <div className="border-2 border-dashed border-border rounded-xl py-8 px-6 text-center hover:border-primary/50 hover:bg-muted/40 transition-colors">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Enviar arquivos XML de NF-e</p>
            <p className="text-xs text-muted-foreground mt-1">Selecione um ou mais XML de nota fiscal eletrônica</p>
          </div>
        </label>

        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 bg-muted/40 rounded-lg border border-border">
                <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-sm text-foreground truncate flex-1">{f.name}</span>
                <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Button onClick={analyze} disabled={!files.length || parsing || uploading} className="w-full h-11">
          {parsing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
          {uploading ? 'Enviando...' : parsing ? 'Analisando XML...' : 'Analisar notas fiscais'}
        </Button>
      </div>

      {/* Notas analisadas */}
      {notas.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              {notas.length} nota(s) · {totalItems} itens · R$ {totalValue.toFixed(2).replace('.', ',')}
            </h2>
            <Button onClick={runImport} disabled={importing || !storeId} className="h-11">
              {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PackagePlus className="w-4 h-4 mr-2" />}
              Importar para {storeName}
            </Button>
          </div>

          {importing && (
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>Processando itens...</span>
                <span className="tabular-nums">{progress.done}/{progress.total}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {notas.map((nota, ni) => {
            const isOpen = expanded === ni;
            return (
              <div key={ni} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : ni)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40"
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <FileText className="w-4 h-4 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      NFe {nota.nNF || '—'} {nota.serie && <span className="text-muted-foreground font-normal">· série {nota.serie}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{nota.supplier || 'Fornecedor não identificado'}{nota.cnpj ? ` · CNPJ ${nota.cnpj}` : ''}</p>
                  </div>
                  <span className="text-xs font-semibold text-primary tabular-nums">{nota.items.length} itens</span>
                </button>
                {isOpen && (
                  <div className="border-t border-border">
                    <table className="w-full">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Produto</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground hidden sm:table-cell">Cor · Tam</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Custo un.</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Qtd</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nota.items.map((it, ii) => (
                          <tr key={ii} className="border-t border-border">
                            <td className="px-4 py-2.5">
                              <p className="text-sm font-medium text-foreground truncate max-w-[260px]">{it.name}</p>
                              <p className="text-xs text-muted-foreground">NCM {it.ncm || '—'}{it.sku ? ` · ${it.sku}` : ''}</p>
                            </td>
                            <td className="px-3 py-2.5 hidden sm:table-cell text-xs text-muted-foreground">{it.color} · {it.size}</td>
                            <td className="px-3 py-2.5 text-right text-sm tabular-nums text-muted-foreground">R$ {it.vUnCom.toFixed(2).replace('.', ',')}</td>
                            <td className="px-4 py-2.5 text-right text-sm tabular-nums text-foreground">{it.qCom}</td>
                            <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-foreground">R$ {it.vProd.toFixed(2).replace('.', ',')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Resultados */}
      {results && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-foreground">Importação concluída</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-2xl font-semibold text-foreground tabular-nums">{results.created}</p>
              <p className="text-xs text-muted-foreground">produtos criados</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-2xl font-semibold text-foreground tabular-nums">{results.updated}</p>
              <p className="text-xs text-muted-foreground">estoques atualizados</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-2xl font-semibold text-foreground tabular-nums">{results.movements}</p>
              <p className="text-xs text-muted-foreground">entradas registradas</p>
            </div>
          </div>
          {results.errors.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{results.errors.length} erro(s)</p>
                <ul className="text-xs mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                  {results.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}