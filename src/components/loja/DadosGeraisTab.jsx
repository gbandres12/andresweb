import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function DadosGeraisTab({ value, onChange }) {
  const set = (k, v) => onChange({ [k]: v });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Nome da loja *">
        <Input value={value.name || ''} onChange={e => set('name', e.target.value)} />
      </Field>
      <Field label="Slug / Identificador">
        <Input value={value.slug || ''} onChange={e => set('slug', e.target.value)} placeholder="minha-loja" />
      </Field>
      <Field label="CNPJ">
        <Input value={value.cnpj || ''} onChange={e => set('cnpj', e.target.value)} placeholder="00.000.000/0001-00" />
      </Field>
      <Field label="Telefone">
        <Input value={value.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="(00) 0000-0000" />
      </Field>
      <Field label="E-mail">
        <Input type="email" value={value.email || ''} onChange={e => set('email', e.target.value)} placeholder="contato@loja.com" />
      </Field>
      <Field label="Logo (URL)">
        <Input value={value.logo_url || ''} onChange={e => set('logo_url', e.target.value)} placeholder="https://..." />
      </Field>
      <Field label="Cor principal da marca">
        <div className="flex items-center gap-2">
          <input
            type="color" value={value.primary_color || '#1b202d'}
            onChange={e => set('primary_color', e.target.value)}
            className="w-10 h-9 rounded-md border border-input cursor-pointer bg-transparent p-0.5"
          />
          <Input value={value.primary_color || ''} onChange={e => set('primary_color', e.target.value)} placeholder="#1b202d" className="flex-1" />
        </div>
      </Field>
    </div>
  );
}

function Field({ label, children }) {
  return <div><Label className="mb-1.5 block">{label}</Label>{children}</div>;
}