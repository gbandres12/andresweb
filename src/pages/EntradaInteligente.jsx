import { useState } from 'react';
import { ScanLine, Camera, FileStack } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PhotoClassifier from '@/components/entrada/PhotoClassifier';
import FileImporter from '@/components/entrada/FileImporter';

export default function EntradaInteligente() {
  const [tab, setTab] = useState('foto');

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl lg:text-4xl font-serif font-semibold text-foreground tracking-tight">Entrada Inteligente</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cadastro de estoque por reconhecimento de fardos via foto (IA) ou importação de arquivos.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-md mb-6">
          <TabsTrigger value="foto" className="flex items-center gap-2">
            <Camera className="w-4 h-4" /> Foto do Fardo
          </TabsTrigger>
          <TabsTrigger value="importar" className="flex items-center gap-2">
            <FileStack className="w-4 h-4" /> Importar Arquivo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="foto">
          <div className="bg-card border border-border rounded-2xl p-6 lg:p-8">
            <div className="flex items-center gap-2 mb-5">
              <ScanLine className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Reconhecimento de Fardos por IA</h2>
            </div>
            <PhotoClassifier />
          </div>
        </TabsContent>

        <TabsContent value="importar">
          <div className="bg-card border border-border rounded-2xl p-6 lg:p-8">
            <div className="flex items-center gap-2 mb-5">
              <FileStack className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Importar Relação de Roupas</h2>
            </div>
            <FileImporter />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}