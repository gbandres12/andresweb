import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, FileSpreadsheet, Code2, PackageCheck, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATS = ["Vestidos", "Blusas", "Calças", "Saias", "Shorts", "Casacos", "Acessórios", "Moda Praia", "Lingerie", "Outros"];
const TYPES = [
  { id: 'xml', label: 'XML', icon: Code2, hint: 'Nota fiscal / lista estruturada' },
  { id: 'pdf', label: 'PDF', icon: FileText, hint: 'Nota / tabela de fornecedor' },
  { id: 'csv', label: 'CSV / Excel', icon: FileSpreadsheet, hint: 'Planilha de produtos' },
];

function mapCategory(c) {
  if (!c) return 'Outros';
  const s = String(c).toLowerCase().trim();
  const found = CATS.find(cat => s.includes(cat.toLowerCase().slice(0, 4)));
  return found || 'Outros';
}

function parseXML(txt) {
  const doc = new DOMParser().parseFromString(txt, 'application/xml');
  if (doc.querySelector('parsererror')) return [];
  const nodes = doc.querySelectorAll('produto, item, product, row, det');
  const out = [];
  nodes.forEach(n => {
    const get = (...tags) => {
      for (const t of tags) {
        const el = n.querySelector(t);
        if (el && el.textContent.trim()) return el.textContent.trim();
      }
      return '';
    };
    const name = get('xProd, nome, name, descricao, description, produto, cProd');
    if (!name) return;
    out.push({
      name,
      category: get('categoria, category'),
      price: get('vUnCom, vProd, preco, preco_venda, price, valor'),
      cost_price: get('preco_custo, custo, cost'),
      quantity: get('qCom, qTrib, quantidade, qtd, estoque, quantity, qtde'),
      color: get('cor, color'),
      size: get('tamanho, size, tam'),
      description: get('descricao, description'),
      sku: get('sku, codigo, cProd, cod'),
    });
  });
  return out;
}

export default function FileImporter() {
  const [type, setType] = useState('xml');
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [working, setWorking] = useState(false);
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

  const extract = async () => {
    if (!fileUrl) { toast.error('Envie o arquivo primeiro'); return; }
    setWorking(true); setItems([]);
    try {
      let parsed = [];
      if (type === 'xml') {
        const txt = await fetch(fileUrl).then(r => r.text());
        parsed = parseXML(txt);
      } else {
        const res = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url: fileUrl,
          json_schema: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' }, category: { type: 'string' }, price: { type: 'number' },
                    cost_price: { type: 'number' }, quantity: { type: 'number' }, color: { type: 'string' },
                    size: { type: 'string' }, description: { type: 'string' }, sku: { type: 'string' },
                  },
                },
              },
            },
          },
        });
        if (res.status !== 'success') throw new Error(res.details || 'Falha na extração');
        const out = res.output;
        parsed = Array.isArray(out) ? out : (out?.items || []);
      }
      const norm = parsed.map(p => ({
        name: String(p.name || p.nome || 'Produto importado').trim(),
        category: mapCategory(p.category || p.categoria),
        price: Number(p.price || p.preco || p.preco_venda || 0),
        cost_price: Number(p.cost_price || p.preco_custo || 0),
        stock: Math.max(0, Math.round(Number(p.quantity || p.quantidade || p.estoque || 0))),
        color: p.color || p.cor || 'Único',
        size: p.size || p.tamanho || 'M',
        description: p.description || p.descricao || '',
        sku: p.sku || '',
      })).filter(p => p.name && p.name !== 'Produto importado' || p.price > 0);
      setItems(norm);
      if (!norm.length) toast.error('Nenhum produto encontrado no arquivo');
      else toast.success(`${norm.length} produtos identificados`);
    } catch (e) {
      toast.error('Erro: ' + (e.message || ''));
    } finally {
      setWorking(false);
    }
  };

  const importAll = async () => {
    if (!items.length) return;
    setWorking(true);
    try {
      const products = items.map(it => ({
        name: it.name, description: it.description, category: it.category, price: it.price,
        cost_price: it.cost_price, variants: [{ size: it.size, color: it.color, stock: it.stock, sku: it.sku }],
        is_active: true, tags: [],
      }));
      const created = await base44.entities.Product.bulkCreate(products);
      const movements = created
        .map((p, i) => items[i].stock > 0 ? {
          product_id: p.id, product_name: p.name, variant_size: items[i].size, variant_color: items[i].color,
          type: 'entrada', quantity: items[i].stock, reason: 'Importação de arquivo',
        } : null)
        .filter(Boolean);
      if (movements.length) await base44.entities.StockMovement.bulkCreate(movements);
      toast.success(`${created.length} produtos importados e dados entrada no estoque`);
      setItems([]); setFile(null); setFileUrl('');
    } catch (e) {
      toast.error('Erro ao importar: ' + (e.message || ''));
    } finally {
      setWorking(false);
    }
  };

  const reset = () => { setItems([]); setFile(null); setFileUrl(''); };

  return (
    <div className="space-y-5">
      {/* Tipo de arquivo */}
      <div className="grid grid-cols-3 gap-3">
        {TYPES.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => { setType(t.id); reset(); }}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors text-center",
                type === t.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
              )}
            >
              <Icon className={cn("w-6 h-6", type === t.id ? "text-primary" : "text-muted-foreground")} />
              <div>
                <p className="text-sm font-semibold text-foreground">{t.label}</p>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{t.hint}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Upload */}
      <label className="block cursor-pointer">
        <input
          type="file"
          accept={type === 'xml' ? '.xml,text/xml' : type === 'pdf' ? '.pdf,application/pdf' : '.csv,.xlsx,.xls,text/csv'}
          className="hidden"
          onChange={e => onFile(e.target.files?.[0])}
        />
        <div className="flex items-center gap-3 border-2 border-dashed border-border rounded-xl p-5 hover:border-primary/50 hover:bg-muted/40 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Upload className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{file ? file.name : 'Selecionar arquivo'}</p>
            <p className="text-xs text-muted-foreground">{file ? 'Enviado ✓' : `Formato ${type.toUpperCase()}`}</p>
          </div>
          <span className="text-sm text-primary font-medium">Escolher</span>
        </div>
      </label>

      <div className="flex gap-3">
        <Button onClick={extract} disabled={!fileUrl || working} className="flex-1 h-11">
          {working ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
          {working ? 'Extraindo...' : 'Extrair produtos'}
        </Button>
        {items.length > 0 && (
          <Button onClick={importAll} disabled={working} className="flex-1 h-11">
            {working ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PackageCheck className="w-4 h-4 mr-2" />}
            Importar {items.length}
          </Button>
        )}
      </div>

      {/* Preview list */}
      {items.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/40">
            <p className="text-sm font-semibold text-foreground">{items.length} produtos identificados</p>
            <button onClick={reset} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Limpar
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Produto</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground hidden sm:table-cell">Categoria</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Preço</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">Qtd</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="text-sm font-medium text-foreground truncate max-w-[200px]">{it.name}</p>
                      <p className="text-xs text-muted-foreground">{it.color} · {it.size}</p>
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">{it.category}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-semibold text-primary tabular-nums">
                      R$ {it.price.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm text-foreground tabular-nums">{it.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}