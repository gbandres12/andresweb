import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TabelaPrecoManager from '@/components/config/TabelaPrecoManager';
import CostCenterManager from '@/components/config/CostCenterManager';
import PaymentMethodsManager from '@/components/config/PaymentMethodsManager';
import CupomConfig from '@/components/config/CupomConfig';
import AIConfigManager from '@/components/config/AIConfigManager';
import { Sparkles } from 'lucide-react';

export default function Configuracoes() {
  const [tab, setTab] = useState('ia');
  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">Configurações do Sistema</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Tabelas de preço, formas de pagamento, inteligência artificial e preferências da loja.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="ia" className="flex items-center gap-1.5 font-medium data-[state=active]:bg-white data-[state=active]:text-emerald-700">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> IA & Classificação
          </TabsTrigger>
          <TabsTrigger value="tabelas">Tabelas de Preço</TabsTrigger>
          <TabsTrigger value="pagamentos">Formas de Pagamento</TabsTrigger>
          <TabsTrigger value="centros">Centros de Custo</TabsTrigger>
          <TabsTrigger value="cupom">Cupom de Controle</TabsTrigger>
        </TabsList>
        <TabsContent value="ia" className="mt-5"><AIConfigManager /></TabsContent>
        <TabsContent value="tabelas" className="mt-5"><TabelaPrecoManager /></TabsContent>
        <TabsContent value="pagamentos" className="mt-5"><PaymentMethodsManager /></TabsContent>
        <TabsContent value="centros" className="mt-5"><CostCenterManager /></TabsContent>
        <TabsContent value="cupom" className="mt-5"><CupomConfig /></TabsContent>
      </Tabs>
    </div>
  );
}