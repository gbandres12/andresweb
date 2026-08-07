import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Save, Loader2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import DadosGeraisTab from '@/components/loja/DadosGeraisTab';
import EnderecoTab from '@/components/loja/EnderecoTab';
import FiscalTab from '@/components/loja/FiscalTab';
import OperacoesTab from '@/components/loja/OperacoesTab';

const DEFAULT_SETTINGS = {
  endereco: { logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', cep: '' },
  fiscal: { inscricao_estadual: '', inscricao_municipal: '', regime_tributario: 'Simples Nacional', ambiente: 'homologacao', serie: '1', numero_inicial: '', csc: '', csc_id: '', natureza_operacao: 'Venda de mercadoria', optante_simples: true },
  operacoes: {
    natureza_venda: 'Varejo',
    formas_pagamento: [
      { tipo: 'Dinheiro', descricao: 'Dinheiro', aceita: true },
      { tipo: 'PIX', descricao: 'PIX', aceita: true },
      { tipo: 'Cartão Crédito', descricao: 'Cartão de Crédito', aceita: true },
      { tipo: 'Cartão Débito', descricao: 'Cartão de Débito', aceita: true },
    ],
  },
};

export default function ConfiguracaoLoja() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('geral');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await base44.entities.Store.get(id);
      const st = s.settings || {};
      const settings = {
        endereco: { ...DEFAULT_SETTINGS.endereco, ...(st.endereco || {}) },
        fiscal: { ...DEFAULT_SETTINGS.fiscal, ...(st.fiscal || {}) },
        operacoes: {
          ...DEFAULT_SETTINGS.operacoes,
          ...(st.operacoes || {}),
          formas_pagamento: st.operacoes?.formas_pagamento || DEFAULT_SETTINGS.operacoes.formas_pagamento,
        },
      };
      setData({ ...s, settings });
    } catch {
      toast({ title: 'Loja não encontrada', variant: 'destructive' });
      navigate('/lojas');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) {
    return <div className="flex items-center justify-center h-full py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const mergeGeral = (p) => setData(d => ({ ...d, ...p }));
  const mergeEnd = (p) => setData(d => ({ ...d, settings: { ...d.settings, endereco: { ...d.settings.endereco, ...p } } }));
  const mergeFisc = (p) => setData(d => ({ ...d, settings: { ...d.settings, fiscal: { ...d.settings.fiscal, ...p } } }));
  const mergeOp = (p) => setData(d => ({ ...d, settings: { ...d.settings, operacoes: { ...d.settings.operacoes, ...p } } }));

  const save = async () => {
    setSaving(true);
    try {
      const e = data.settings.endereco;
      const parts = [];
      if (e.logradouro) parts.push(`${e.logradouro}${e.numero ? ', ' + e.numero : ''}${e.complemento ? ' ' + e.complemento : ''}`);
      if (e.bairro) parts.push(e.bairro);
      if (e.cidade || e.uf) parts.push([e.cidade, e.uf].filter(Boolean).join('/'));
      const addrStr = parts.join(' — ');
      const payload = {
        name: data.name, slug: data.slug, cnpj: data.cnpj, phone: data.phone, email: data.email,
        logo_url: data.logo_url, primary_color: data.primary_color,
        address: addrStr, settings: data.settings,
      };
      await base44.entities.Store.update(id, payload);
      toast({ title: 'Configurações da loja salvas' });
    } catch {
      toast({ title: 'Erro ao salvar configurações', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1000px] mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/lojas')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-serif font-semibold text-foreground flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" /> {data.name}
            </h1>
            <p className="text-sm text-muted-foreground">Configurações fiscais e operacionais da loja</p>
          </div>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="geral">Dados gerais</TabsTrigger>
          <TabsTrigger value="endereco">Endereço</TabsTrigger>
          <TabsTrigger value="fiscal">Fiscal & Cupons</TabsTrigger>
          <TabsTrigger value="operacoes">Operações</TabsTrigger>
        </TabsList>
        <TabsContent value="geral" className="mt-5"><DadosGeraisTab value={data} onChange={mergeGeral} /></TabsContent>
        <TabsContent value="endereco" className="mt-5"><EnderecoTab value={data.settings.endereco} onChange={mergeEnd} /></TabsContent>
        <TabsContent value="fiscal" className="mt-5"><FiscalTab value={data.settings.fiscal} onChange={mergeFisc} /></TabsContent>
        <TabsContent value="operacoes" className="mt-5"><OperacoesTab value={data.settings.operacoes} onChange={mergeOp} /></TabsContent>
      </Tabs>
    </div>
  );
}