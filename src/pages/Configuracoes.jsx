import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TabelaPrecoManager from '@/components/config/TabelaPrecoManager';
import CostCenterManager from '@/components/config/CostCenterManager';
import PaymentMethodsManager from '@/components/config/PaymentMethodsManager';
import CupomConfig from '@/components/config/CupomConfig';

export default function Configuracoes() {
  const [tab, setTab] = useState('tabelas');
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Tabelas de preço, formas de pagamento e centros de custo da loja.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="tabelas">Tabelas de Preço</TabsTrigger>
          <TabsTrigger value="pagamentos">Formas de Pagamento</TabsTrigger>
          <TabsTrigger value="centros">Centros de Custo</TabsTrigger>
          <TabsTrigger value="cupom">Cupom de Controle</TabsTrigger>
        </TabsList>
        <TabsContent value="tabelas" className="mt-5"><TabelaPrecoManager /></TabsContent>
        <TabsContent value="pagamentos" className="mt-5"><PaymentMethodsManager /></TabsContent>
        <TabsContent value="centros" className="mt-5"><CostCenterManager /></TabsContent>
        <TabsContent value="cupom" className="mt-5"><CupomConfig /></TabsContent>
      </Tabs>
    </div>
  );
}