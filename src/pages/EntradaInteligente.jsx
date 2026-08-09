import { useState } from 'react';
import { ScanLine, Camera, Sparkles, FileSpreadsheet } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PhotoClassifier from '@/components/entrada/PhotoClassifier';
import ImportadorInteligenteIA from '@/components/entrada/ImportadorInteligenteIA';

export default function EntradaInteligente() {
  const [tab, setTab] = useState('importar');

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl lg:text-4xl font-serif font-semibold text-foreground tracking-tight flex items-center gap-3">
          Entrada Inteligente por IA <Sparkles className="w-6 h-6 text-emerald-600 animate-pulse" />
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Importação automática de Produtos & Extrato de Caixa via leitura de planilhas CSV, XLSX, PDF e visão por IA.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-md mb-6">
          <TabsTrigger value="importar" className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Importar Planilha / PDF
          </TabsTrigger>
          <TabsTrigger value="foto" className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-emerald-600" /> Foto do Fardo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="importar">
          <div className="bg-card border border-border rounded-2xl p-6 lg:p-8">
            <ImportadorInteligenteIA />
          </div>
        </TabsContent>

        <TabsContent value="foto">
          <div className="bg-card border border-border rounded-2xl p-6 lg:p-8">
            <div className="flex items-center gap-2 mb-5">
              <ScanLine className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-foreground">Reconhecimento de Fardos por IA</h2>
            </div>
            <PhotoClassifier />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}