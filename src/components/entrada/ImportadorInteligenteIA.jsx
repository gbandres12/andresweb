import { useState, useEffect } from 'react';
import { 
  Sparkles, Upload, FileSpreadsheet, FileText, CheckCircle2, 
  Loader2, Trash2, ArrowRight, PackagePlus, DollarSign, 
  Check, RefreshCw, AlertCircle, FileCode, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/StoreContext';
import * as XLSX from 'xlsx';

export default function ImportadorInteligenteIA() {
  const { store } = useStore();
  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'cash'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState(null);
  const [parsedItems, setParsedItems] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    base44.entities.Category.list().then(setCategories).catch(() => {});
  }, []);

  // Leitura do arquivo local via FileReader + SheetJS
  const processFile = async (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setLoading(true);
    setParsedItems([]);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          // Envia para o motor de classificacao IA da API
          const res = await fetch('/api/integrations/import-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: activeTab,
              raw_text: JSON.stringify(jsonRows)
            })
          }).then(r => r.json());

          if (res.items && res.items.length > 0) {
            setParsedItems(res.items);
            toast.success(`${res.items.length} registros extraídos e classificados pela IA com sucesso! ✨`);
          } else {
            toast.error('Nenhum dado válido identificado no arquivo.');
          }
        } catch (err) {
          toast.error('Erro ao processar estrutura do arquivo: ' + err.message);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    } catch (err) {
      toast.error('Falha na leitura do arquivo');
      setLoading(false);
    }
  };

  // Carga de teste instantânea com 1-clique
  const loadTestData = async () => {
    setLoading(true);
    setParsedItems([]);
    try {
      const res = await fetch('/api/integrations/import-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: activeTab })
      }).then(r => r.json());

      if (res.items) {
        setParsedItems(res.items);
        toast.success(`Massa de teste com 5 itens de ${activeTab === 'products' ? 'Produtos' : 'Caixa'} carregada por IA! ✨`);
      }
    } catch (e) {
      toast.error('Erro ao carregar massa de teste');
    } finally {
      setLoading(false);
    }
  };

  // Gravação final no Supabase / Backend
  const handleFinalImport = async () => {
    if (!parsedItems.length) return;
    setSaving(true);

    try {
      if (activeTab === 'products') {
        // Formata os produtos para o padrão do BD
        const productsToSave = parsedItems.map(item => ({
          name: item.name,
          category: item.category || 'Outros',
          price: Number(item.price) || 0,
          cost_price: Number(item.cost_price) || 0,
          reference: item.reference || `REF-${Math.floor(Math.random() * 9000 + 1000)}`,
          store_id: store?.id,
          variants: [{ size: item.size || 'M', color: item.color || 'Único', stock: Number(item.stock) || 0, sku: item.sku }],
          is_active: true
        }));

        const created = await base44.entities.Product.bulkCreate(productsToSave);

        // Registra os movimentos de entrada no estoque
        const movements = created.map((p, idx) => ({
          product_id: p.id,
          product_name: p.name,
          variant_size: parsedItems[idx]?.size || 'M',
          variant_color: parsedItems[idx]?.color || 'Único',
          store_id: store?.id,
          type: 'entrada',
          quantity: Number(parsedItems[idx]?.stock) || 0,
          reason: 'Importação por IA / Planilha'
        })).filter(m => m.quantity > 0);

        if (movements.length > 0) {
          await base44.entities.StockMovement.bulkCreate(movements);
        }

        toast.success(`🎉 ${created.length} produtos importados e inseridos no estoque do Supabase!`);
      } else {
        // Grava as movimentações de Caixa / Financeiro
        const cashToSave = parsedItems.map(item => ({
          store_id: store?.id,
          date: item.date || new Date().toISOString().split('T')[0],
          description: item.description,
          type: item.type,
          amount: Number(item.amount) || 0,
          payment_method: item.payment_method,
          category: item.category || 'Outros',
          status: item.status || 'pago'
        }));

        await base44.entities.CashMovement.bulkCreate(cashToSave);
        toast.success(`🎉 ${cashToSave.length} lançamentos de Caixa salvos no Supabase com sucesso!`);
      }

      setParsedItems([]);
      setFile(null);
    } catch (err) {
      toast.error('Erro na gravação final: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const updateParsedItem = (index, field, value) => {
    setParsedItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeItem = (index) => {
    setParsedItems(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Abas Principais */}
      <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setParsedItems([]); setFile(null); }} className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-lg mx-auto bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <TabsTrigger value="products" className="flex items-center justify-center gap-2 py-2.5 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm font-medium">
            <PackagePlus className="w-4 h-4 text-emerald-600" />
            Produtos & Estoque
          </TabsTrigger>
          <TabsTrigger value="cash" className="flex items-center justify-center gap-2 py-2.5 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm font-medium">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            Caixa & Financeiro
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          {/* Caixa de Upload Drag & Drop */}
          <div className="bg-white border-2 border-dashed border-emerald-200 hover:border-emerald-500 rounded-2xl p-8 text-center transition-all bg-gradient-to-b from-emerald-50/30 to-white shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center mx-auto mb-4 border border-emerald-200 shadow-inner">
              <Upload className="w-7 h-7 text-emerald-600" />
            </div>

            <h3 className="text-lg font-semibold text-slate-800">
              {activeTab === 'products' ? 'Importar Planilha de Produtos (CSV, XLSX, PDF)' : 'Importar Extrato do Caixa (CSV, XLSX, PDF)'}
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              Arraste seu arquivo ou clique abaixo para ler o arquivo e classificar via IA.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              <label className="cursor-pointer">
                <input 
                  type="file" 
                  accept=".csv,.xlsx,.xls,.pdf" 
                  className="hidden" 
                  onChange={(e) => processFile(e.target.files?.[0])}
                />
                <Button type="button" variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md font-medium px-6 py-2.5 rounded-xl flex items-center gap-2 pointer-events-none">
                  <FileSpreadsheet className="w-4 h-4" /> Selecionar Arquivo
                </Button>
              </label>

              <Button 
                type="button" 
                variant="outline" 
                onClick={loadTestData} 
                disabled={loading}
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-medium px-5 py-2.5 rounded-xl flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-emerald-600" /> 
                {loading ? 'Processando IA...' : 'Carregar Dados de Teste (IA)'}
              </Button>
            </div>

            {file && (
              <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3.5 py-1.5 rounded-full mt-4 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {file.name}
              </div>
            )}
          </div>
        </div>
      </Tabs>

      {/* Indicador de Carregamento */}
      {loading && (
        <div className="bg-white border border-emerald-100 rounded-2xl p-8 text-center space-y-3 shadow-sm">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-700">Extraindo colunas e executando classificação por Inteligência Artificial...</p>
        </div>
      )}

      {/* Tabela de Pré-Visualização Interativa */}
      {parsedItems.length > 0 && !loading && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-slate-800 text-base">
                  {parsedItems.length} {activeTab === 'products' ? 'produtos' : 'lançamentos'} prontos para importação
                </h4>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 flex items-center gap-1 font-medium text-xs">
                  <Sparkles className="w-3 h-3 text-emerald-600" /> Classificado por IA ✨
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Revise ou edite os valores diretamente na tabela antes de salvar no Supabase.</p>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setParsedItems([])} className="text-slate-500 hover:text-red-600 text-xs">
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Limpar tudo
              </Button>

              <Button 
                onClick={handleFinalImport} 
                disabled={saving} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md font-medium px-5"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Salvando...</>
                ) : (
                  <><Check className="w-4 h-4 mr-2" /> Confirmar e Gravar no Supabase ({parsedItems.length})</>
                )}
              </Button>
            </div>
          </div>

          {/* Tabela de Produtos */}
          {activeTab === 'products' ? (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-3 py-3">Categoria</th>
                    <th className="px-3 py-3 text-right">Preço Venda</th>
                    <th className="px-3 py-3 text-right">Preço Custo</th>
                    <th className="px-3 py-3 text-center">Qtd Estoque</th>
                    <th className="px-3 py-3">Cor / Tam</th>
                    <th className="px-3 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedItems.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <Input 
                          value={item.name} 
                          onChange={(e) => updateParsedItem(idx, 'name', e.target.value)}
                          className="h-8 text-xs bg-transparent border-slate-200 font-medium text-slate-800"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Input 
                          value={item.category} 
                          onChange={(e) => updateParsedItem(idx, 'category', e.target.value)}
                          className="h-8 text-xs bg-transparent border-slate-200"
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Input 
                          type="number"
                          step="0.01"
                          value={item.price} 
                          onChange={(e) => updateParsedItem(idx, 'price', e.target.value)}
                          className="h-8 text-xs bg-transparent border-slate-200 text-right font-medium text-emerald-700"
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Input 
                          type="number"
                          step="0.01"
                          value={item.cost_price} 
                          onChange={(e) => updateParsedItem(idx, 'cost_price', e.target.value)}
                          className="h-8 text-xs bg-transparent border-slate-200 text-right text-slate-600"
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Input 
                          type="number"
                          value={item.stock} 
                          onChange={(e) => updateParsedItem(idx, 'stock', e.target.value)}
                          className="h-8 text-xs bg-transparent border-slate-200 text-center font-bold"
                        />
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {item.color} · {item.size}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-7 w-7 text-slate-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Tabela de Lançamentos de Caixa */
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Descrição</th>
                    <th className="px-3 py-3">Tipo</th>
                    <th className="px-3 py-3 text-right">Valor (R$)</th>
                    <th className="px-3 py-3">Método</th>
                    <th className="px-3 py-3">Categoria</th>
                    <th className="px-3 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedItems.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3">
                        <Input 
                          type="date"
                          value={item.date} 
                          onChange={(e) => updateParsedItem(idx, 'date', e.target.value)}
                          className="h-8 text-xs bg-transparent border-slate-200"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input 
                          value={item.description} 
                          onChange={(e) => updateParsedItem(idx, 'description', e.target.value)}
                          className="h-8 text-xs bg-transparent border-slate-200 font-medium text-slate-800"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Badge className={item.type === 'receita' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-800 border-red-200'}>
                          {item.type === 'receita' ? 'Receita' : 'Despesa'}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Input 
                          type="number"
                          step="0.01"
                          value={item.amount} 
                          onChange={(e) => updateParsedItem(idx, 'amount', e.target.value)}
                          className={`h-8 text-xs bg-transparent border-slate-200 text-right font-semibold ${item.type === 'receita' ? 'text-emerald-700' : 'text-red-600'}`}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Input 
                          value={item.payment_method} 
                          onChange={(e) => updateParsedItem(idx, 'payment_method', e.target.value)}
                          className="h-8 text-xs bg-transparent border-slate-200"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Input 
                          value={item.category} 
                          onChange={(e) => updateParsedItem(idx, 'category', e.target.value)}
                          className="h-8 text-xs bg-transparent border-slate-200 text-xs"
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="h-7 w-7 text-slate-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
