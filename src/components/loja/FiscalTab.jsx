import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const REGIMES = ['Simples Nacional', 'MEI', 'Lucro Presumido', 'Lucro Real'];

export default function FiscalTab({ value, onChange }) {
  const set = (k, v) => onChange({ [k]: v });
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Dados fiscais</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Inscrição Estadual">
            <Input value={value.inscricao_estadual || ''} onChange={e => set('inscricao_estadual', e.target.value)} placeholder="Isento se ME" />
          </Field>
          <Field label="Inscrição Municipal">
            <Input value={value.inscricao_municipal || ''} onChange={e => set('inscricao_municipal', e.target.value)} />
          </Field>
          <Field label="Regime tributário">
            <Select value={value.regime_tributario || 'Simples Nacional'} onValueChange={v => set('regime_tributario', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REGIMES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Ambiente de emissão">
            <Select value={value.ambiente || 'homologacao'} onValueChange={v => set('ambiente', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="homologacao">Homologação (testes)</SelectItem>
                <SelectItem value="producao">Produção</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      <div>
        <SectionTitle>Cupons (NFC-e)</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Field label="Série">
            <Input value={value.serie || ''} onChange={e => set('serie', e.target.value)} placeholder="1" />
          </Field>
          <Field label="Nº inicial (último emitido)">
            <Input value={value.numero_inicial || ''} onChange={e => set('numero_inicial', e.target.value)} placeholder="0" />
          </Field>
          <Field label="ID do CSC">
            <Input value={value.csc_id || ''} onChange={e => set('csc_id', e.target.value)} placeholder="000001" />
          </Field>
          <Field label="CSC (token)">
            <Input value={value.csc || ''} onChange={e => set('csc', e.target.value)} placeholder="token..." />
          </Field>
        </div>
        <Field label="Natureza da operação (padrão do cupom)">
          <Input value={value.natureza_operacao || ''} onChange={e => set('natureza_operacao', e.target.value)} placeholder="Venda de mercadoria" />
        </Field>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <Label htmlFor="simples" className="cursor-pointer text-sm">Optante do Simples Nacional</Label>
          <Switch id="simples" checked={!!value.optante_simples} onCheckedChange={v => set('optante_simples', v)} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div><Label className="mb-1.5 block">{label}</Label>{children}</div>;
}
function SectionTitle({ children }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-3">{children}</p>;
}