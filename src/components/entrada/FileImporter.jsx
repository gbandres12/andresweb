import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, FileSpreadsheet, Code2, PackageCheck, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/StoreContext';

const CATS = ["Vestidos", "Blusas", "Calças", "Saias", "Shorts", "Casacos", "Acessórios", "Moda Praia", "Lingerie", "Outros"];
const TYPES = [
  { id: 'xml', label: 'XML', icon: Code2, hint: 'Nota fiscal / lista estruturada' },
  { id: 'pdf', label: 'PDF', icon: FileText, hint: 'Nota / tabela de fornecedor' },
  { id: 'csv', label: 'CSV / Excel', icon: FileSpreadsheet, hint: 'Planilha de produtos' },
];

function normHeader(h) {
  return h.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function mapCategory(c) {
  if (!c) return 'Outros';
  const s = String(c).toLowerCase().trim();
  const found = CATS.find(cat => s.includes(cat.toLowerCase().slice(0, 4)));
  return found || 'Outros';
}
// Resolve a categoria do CSV para o nome real cadastrado no BD (preserva o código)
function resolveCategory(rawCat, categories) {
  if (!rawCat) return 'Outros';
  const n = normHeader(rawCat);
  const match = (categories || []).find(c => normHeader(c.name) === n);
  return match ? match.name : mapCategory(rawCat);
}

function parseNumPT(s) {
  if (s == null) return 0;
  let v = String(s).replace(/[^\d.,-]/g, '').trim();
  if (!v) return 0;
  if (v.includes(',') && v.includes('.')) {
    v = v.replace(/\./g, '').replace(',', '.');
  } else if (v.includes(',')) {
    v = v.replace(',', '.');
  }
  return Number(v) || 0;
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
      name, category: get('categoria, category'),
      price: get('vUnCom, vProd, preco, preco_venda, price, valor'),
      cost_price: get('preco_custo, custo, cost'),
      quantity: get('qCom, qTrib, quantidade, qtd, estoque, quantity, qtde'),
      color: get('cor, color'), size: get('tamanho, size, tam'),
      description: get('descricao, description'), sku: get('sku, codigo, cProd, cod'),
      reference: get('referencia, ref, referencia_loja'),
    });
  });
  return out;
}

// Parser CSV local robusto — suporta vírgula ou ponto-e-vírgula, aspas, acentos e BOM
function parseCSV(text) {
  text = (text || '').replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/)[0] || '';
  const delim = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
  const rows = [];
  let cur = '', row = [], inQ = false;
  const pushRow = () => {
    if (row.some(c => String(c).trim() !== '')) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      row.push(cur); cur = ''; pushRow();
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); pushRow(); }
  if (rows.length < 2) return [];

  const aliases = {
    name: ['nome', 'produto', 'name', 'descricao', 'description', 'item'],
    category: ['categoria', 'category', 'cat', 'grupo', 'tipo'],
    price: ['preco_venda', 'preco', 'valor_venda', 'valor', 'price', 'venda'],
    cost_price: ['preco_custo', 'custo', 'cost'],
    quantity: ['quantidade', 'qtd_estoque', 'qtd_est', 'estoque', 'quantity', 'qtde', 'stock', 'saldo', 'qtd'],
    color: ['cor', 'color'],
    size: ['tamanho', 'size', 'tam', 'vol'],
    description: ['descricao', 'description', 'observacao', 'obs'],
    sku: ['sku', 'codigo_interno', 'codigo', 'cprod', 'cod'],
    reference: ['referencia_loja', 'referencia_da_loja', 'codigo_loja', 'ref_loja', 'referencia', 'ref'],
  };
  const headers = rows[0].map(normHeader);
  const map = {};
  headers.forEach((h, idx) => {
    let best = null, bestLen = 0;
    for (const k of Object.keys(aliases)) {
      for (const a of aliases[k]) {
        if (h === a || h.includes(a)) { if (a.length > bestLen) { best = k; bestLen = a.length; } }
      }
    }
    if (best && map[best] === undefined) map[best] = idx;
  });
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every(c => String(c).trim() === '')) continue;
    const obj = {};
    Object.keys(map).forEach(k => { obj[k] = (r[map[k]] || '').trim(); });
    out.push(obj);
  }
  return out;
}

export default function FileImporter() {
  const { store } = useStore();
  const [type, setType] = useState('csv');
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [working, setWorking] = useState(false);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    base44.entities.Category.list('order').then(setCategories).catch(() => {});
  }, []);

  const onFile = async (f) => {
    if (!f) return;
    if (/\.xls$/i.test(f.name) && !/\.xlsx$/i.test(f.name)) {
      toast.error('Formato .xls não é suportado. Salve como .xlsx ou .csv no Excel e tente novamente.');
      return;
    }
    setFile(f); setFileUrl(''); setItems([]);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
      setFileUrl(file_url);
    } catch {
      toast.error('Erro ao enviar arquivo');
    }
  };

  // Gera referência da loja = código da categoria + preço em centavos (ex.: 0490)
  // Códigos iniciados em zero (ex.: calcinha = "0") são preservados como string.
  const buildReference = (category, price) => {
    const ncat = normHeader(category || '');
    let cat = (categories || []).find(c => normHeader(c.name) === ncat);
    if (!cat) {
      // correspondência parcial: "Calcinha" (CSV) ↔ "Calcinhas" (cadastro)
      cat = (categories || []).find(c => {
        const cn = normHeader(c.name);
        return cn && ncat && (ncat.includes(cn) || cn.includes(ncat));
      });
    }
    const rawCode = cat?.code;
    if (rawCode == null || rawCode === '') return '';
    const code = String(rawCode); // preserva zeros à esquerda ("0", "04", "0490")
    const cents = Math.max(0, Math.round((Number(price) || 0) * 100));
    return `${code}${cents.toString().padStart(3, '0')}`;
  };

  const extract = async () => {
    if (!fileUrl && !file) { toast.error('Envie o arquivo primeiro'); return; }
    setWorking(true); setItems([]);
    try {
      let parsed = [];
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (ext === 'xml') {
        const txt = await fetch(fileUrl).then(r => r.text());
        parsed = parseXML(txt);
      } else if (ext === 'csv') {
        // Parser local — robusto para cabeçalhos PT-BR e separador por ;
        const txt = await file.text();
        parsed = parseCSV(txt);
      } else {
        // xlsx / pdf — extração via IA com schema plano (uma linha)
        const res = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url: fileUrl,
          json_schema: {
            type: 'object',
            properties: {
              name: { type: 'string' }, category: { type: 'string' }, price: { type: 'number' },
              cost_price: { type: 'number' }, quantity: { type: 'number' }, color: { type: 'string' },
              size: { type: 'string' }, description: { type: 'string' }, sku: { type: 'string' },
              reference: { type: 'string' },
            },
          },
        });
        if (res.status !== 'success') throw new Error(res.details || 'Falha na extração');
        const out = res.output;
        parsed = Array.isArray(out) ? out : (out ? [out] : []);
      }

      const norm = parsed.map(p => {
        const name = String(p.name || p.nome || '').trim() || 'Produto importado';
        const category = resolveCategory(p.category || p.categoria, categories);
        const price = parseNumPT(p.price ?? p.preco ?? p.preco_venda ?? p.valor);
        const reference = (p.reference || p.referencia || '').toString().trim() || buildReference(category, price);
        return {
          name,
          category,
          price,
          cost_price: parseNumPT(p.cost_price ?? p.custo ?? p.preco_custo),
          stock: Math.max(0, Math.round(parseNumPT(p.quantity ?? p.quantidade ?? p.estoque))),
          color: (p.color || p.cor || 'Único').trim(),
          size: (p.size || p.tamanho || 'M').trim() || 'M',
          description: (p.description || p.descricao || '').trim(),
          sku: (p.sku || '').toString().trim(),
          reference,
        };
      }).filter(p => p.name !== 'Produto importado' || p.price > 0);

      setItems(norm);
      if (!norm.length) toast.error('Nenhum produto encontrado. Verifique se o arquivo tem colunas: nome, preço, categoria.');
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
        cost_price: it.cost_price, reference: it.reference, store_id: store?.id,
        variants: [{ size: it.size, color: it.color, stock: it.stock, sku: it.sku }],
        is_active: true, tags: [],
      }));
      const created = await base44.entities.Product.bulkCreate(products);
      const movements = created
        .map((p, i) => items[i].stock > 0 ? {
          product_id: p.id, product_name: p.name, variant_size: items[i].size, variant_color: items[i].color,
          store_id: store?.id, type: 'entrada', quantity: items[i].stock, reason: 'Importação de arquivo',
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
          accept={type === 'xml' ? '.xml,text/xml' : type === 'pdf' ? '.pdf,application/pdf' : '.csv,.xlsx,text/csv'}
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
        <Button onClick={extract} disabled={(!fileUrl && !file) || working} className="flex-1 h-11">
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
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground hidden sm:table-cell">Ref.</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase text-muted-foreground hidden md:table-cell">Categoria</th>
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
                      <span className="text-xs font-mono font-semibold text-primary tabular-nums">{it.reference || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
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