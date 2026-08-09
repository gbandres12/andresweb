import { useState, useEffect } from 'react';
import { Sparkles, Key, Cpu, CheckCircle2, Save, RefreshCw, Bot, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function AIConfigManager() {
  const [provider, setProvider] = useState('openrouter'); // 'openrouter' | 'gemini' | 'openai' | 'fallback'
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('google/gemini-2.5-flash');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const savedProvider = localStorage.getItem('andresweb_ai_provider') || 'openrouter';
    const savedKey = localStorage.getItem('andresweb_ai_key') || '';
    const savedModel = localStorage.getItem('andresweb_ai_model') || 'google/gemini-2.5-flash';
    setProvider(savedProvider);
    setApiKey(savedKey);
    setModel(savedModel);
  }, []);

  const handleSave = () => {
    localStorage.setItem('andresweb_ai_provider', provider);
    localStorage.setItem('andresweb_ai_key', apiKey);
    localStorage.setItem('andresweb_ai_model', model);
    toast.success('Configurações de IA salvas com sucesso!');
  };

  const testConnection = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const res = await fetch('/api/import-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'products',
          api_key: apiKey,
          provider: provider,
          model: model
        })
      }).then(r => r.json());

      if (res.status === 'success') {
        setStatus({ ok: true, provider: res.provider || provider });
        toast.success('Motor de IA respondendo com sucesso! ✨');
      } else {
        throw new Error(res.error || 'Erro na comunicação');
      }
    } catch (err) {
      setStatus({ ok: false, error: err.message });
      toast.error('Erro ao testar API de IA: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm max-w-3xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-800">API de IA Geral & Classificação</h3>
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 flex items-center gap-1 font-medium text-xs">
              <Sparkles className="w-3 h-3 text-emerald-600" /> Ativo
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure sua chave de API (OpenRouter, Gemini ou OpenAI) para auto-classificação de produtos e extrato de caixa.
          </p>
        </div>
        <Bot className="w-8 h-8 text-emerald-600" />
      </div>

      <div className="space-y-4">
        {/* Provedor */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-emerald-600" /> Provedor de IA Principal
          </Label>
          <Select value={provider} onValueChange={(val) => {
            setProvider(val);
            if (val === 'gemini') setModel('gemini-2.5-flash');
            if (val === 'openrouter') setModel('google/gemini-2.5-flash');
            if (val === 'openai') setModel('gpt-4o-mini');
          }}>
            <SelectTrigger className="h-10 border-slate-200"><SelectValue placeholder="Selecione o provedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="openrouter">OpenRouter AI (Recomendado - Multimodelo)</SelectItem>
              <SelectItem value="gemini">Google Gemini API Direct</SelectItem>
              <SelectItem value="openai">OpenAI API (GPT-4o / GPT-4o-mini)</SelectItem>
              <SelectItem value="fallback">Simulado / Heurística Interna (Sem API Key)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Modelo */}
        {provider !== 'fallback' && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Modelo Selecionado</Label>
            <Input 
              value={model} 
              onChange={(e) => setModel(e.target.value)} 
              placeholder="Ex: google/gemini-2.5-flash ou gpt-4o-mini"
              className="h-10 border-slate-200"
            />
            <p className="text-xs text-slate-500">Exemplos: <code>google/gemini-2.5-flash</code>, <code>anthropic/claude-3.5-sonnet</code>, <code>gpt-4o-mini</code>.</p>
          </div>
        )}

        {/* Chave de API */}
        {provider !== 'fallback' && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Key className="w-4 h-4 text-emerald-600" /> Chave de API ({provider.toUpperCase()})
            </Label>
            <Input 
              type="password"
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)} 
              placeholder="sk-or-v1-sua-chave-api-aqui..."
              className="h-10 border-slate-200 font-mono text-xs"
            />
            <p className="text-xs text-slate-500">Sua chave é mantida em ambiente seguro no servidor Vercel e localStorage do navegador.</p>
          </div>
        )}

        {/* Status da Conexão */}
        {status && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 ${status.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {status.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
            <div className="text-xs">
              <p className="font-semibold">{status.ok ? 'Conexão Estabelecida com Sucesso!' : 'Falha na Conexão'}</p>
              <p className="mt-0.5">{status.ok ? `Motor de IA respondendo via ${status.provider}` : status.error}</p>
            </div>
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
          <Button type="button" onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-5">
            <Save className="w-4 h-4 mr-2" /> Salvar Configurações
          </Button>

          <Button type="button" variant="outline" onClick={testConnection} disabled={testing} className="border-slate-300 text-slate-700 hover:bg-slate-50">
            {testing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
            {testing ? 'Testando...' : 'Testar Conexão com a IA'}
          </Button>
        </div>
      </div>
    </div>
  );
}
