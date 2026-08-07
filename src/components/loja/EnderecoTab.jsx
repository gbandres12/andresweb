import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export default function EnderecoTab({ value, onChange }) {
  const set = (k, v) => onChange({ [k]: v });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
      <div className="sm:col-span-4">
        <Label className="mb-1.5 block">Logradouro</Label>
        <Input value={value.logradouro || ''} onChange={e => set('logradouro', e.target.value)} placeholder="Rua, Avenida..." />
      </div>
      <div className="sm:col-span-2">
        <Label className="mb-1.5 block">Número</Label>
        <Input value={value.numero || ''} onChange={e => set('numero', e.target.value)} placeholder="S/N" />
      </div>
      <div className="sm:col-span-2">
        <Label className="mb-1.5 block">Complemento</Label>
        <Input value={value.complemento || ''} onChange={e => set('complemento', e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <Label className="mb-1.5 block">Bairro</Label>
        <Input value={value.bairro || ''} onChange={e => set('bairro', e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <Label className="mb-1.5 block">CEP</Label>
        <Input value={value.cep || ''} onChange={e => set('cep', e.target.value)} placeholder="00000-000" />
      </div>
      <div className="sm:col-span-4">
        <Label className="mb-1.5 block">Cidade</Label>
        <Input value={value.cidade || ''} onChange={e => set('cidade', e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <Label className="mb-1.5 block">UF</Label>
        <Select value={value.uf || ''} onValueChange={v => set('uf', v)}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            {UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}