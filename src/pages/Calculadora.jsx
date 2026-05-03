import { useState, useMemo } from 'react';
import { Calculator, TrendingUp, DollarSign, ShoppingBag, Percent, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

const PAYMENT_FEES = {
  'PIX': 0,
  'Dinheiro': 0,
  'Débito': 1.5,
  'Crédito 1x': 2.5,
  'Crédito 2-6x': 3.5,
  'Crédito 7-12x': 4.5,
};

export default function Calculadora() {
  // Custos do produto
  const [costPrice, setCostPrice] = useState('');
  const [shippingCost, setShippingCost] = useState('');

  // Custos fixos mensais rateados por peça
  const [monthlyFixed, setMonthlyFixed] = useState('');
  const [unitsSoldMonth, setUnitsSoldMonth] = useState('');

  // Tráfego / Marketing
  const [monthlyTraffic, setMonthlyTraffic] = useState('');
  const [trafficConversions, setTrafficConversions] = useState('');

  // Taxas e impostos
  const [taxRate, setTaxRate] = useState(6);
  const [paymentFee, setPaymentFee] = useState('PIX');

  // Margem desejada
  const [desiredMargin, setDesiredMargin] = useState(50);

  const calc = useMemo(() => {
    const cost = parseFloat(costPrice) || 0;
    const shipping = parseFloat(shippingCost) || 0;
    const fixed = parseFloat(monthlyFixed) || 0;
    const units = parseFloat(unitsSoldMonth) || 1;
    const traffic = parseFloat(monthlyTraffic) || 0;
    const conversions = parseFloat(trafficConversions) || 1;
    const fee = PAYMENT_FEES[paymentFee] / 100;
    const tax = taxRate / 100;
    const margin = desiredMargin / 100;

    // Custo por unidade de tráfego
    const trafficCostPerUnit = conversions > 0 ? traffic / conversions : 0;

    // Custo fixo por unidade
    const fixedCostPerUnit = units > 0 ? fixed / units : 0;

    // Custo total direto por peça
    const totalDirectCost = cost + shipping + trafficCostPerUnit + fixedCostPerUnit;

    // Preço mínimo: cobre todos os custos + taxas (sem lucro)
    // preco_min * (1 - fee - tax) = totalDirectCost
    const priceMin = totalDirectCost > 0 ? totalDirectCost / (1 - fee - tax) : 0;

    // Preço sugerido: com margem desejada
    // preco_sug * (1 - fee - tax - margin) = totalDirectCost
    const denom = 1 - fee - tax - margin;
    const priceSuggested = denom > 0 && totalDirectCost > 0 ? totalDirectCost / denom : 0;

    // Preço máximo: dobro do mínimo como referência (markup premium)
    const priceMax = priceMin * 2.2;

    // Lucro por unidade no preço sugerido
    const profitPerUnit = priceSuggested - totalDirectCost - (priceSuggested * (fee + tax));

    // ROI do tráfego
    const roiTraffic = trafficCostPerUnit > 0 ? ((profitPerUnit - trafficCostPerUnit) / trafficCostPerUnit) * 100 : null;

    // Ponto de equilíbrio mensal
    const breakEvenUnits = fixedCostPerUnit > 0 ? Math.ceil(fixed / (priceSuggested - cost - shipping - (priceSuggested * (fee + tax)) - trafficCostPerUnit)) : 0;

    return {
      totalDirectCost,
      priceMin,
      priceSuggested,
      priceMax,
      profitPerUnit,
      trafficCostPerUnit,
      fixedCostPerUnit,
      roiTraffic,
      breakEvenUnits,
      feeCost: priceSuggested * fee,
      taxCost: priceSuggested * tax,
      marginPct: priceSuggested > 0 ? (profitPerUnit / priceSuggested) * 100 : 0,
    };
  }, [costPrice, shippingCost, monthlyFixed, unitsSoldMonth, monthlyTraffic, trafficConversions, taxRate, paymentFee, desiredMargin]);

  const hasData = parseFloat(costPrice) > 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-semibold flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-primary" />
          </div>
          Calculadora de Preço de Venda
        </h1>
        <p className="text-muted-foreground text-sm mt-1.5">Simule custos, tráfego e descubra o preço ideal para maximizar seu lucro.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* LEFT — Inputs */}
        <div className="space-y-5">

          {/* Produto */}
          <Section title="Produto" icon={ShoppingBag}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Custo de compra (R$)" hint="Valor que você paga ao fornecedor">
                <MoneyInput value={costPrice} onChange={setCostPrice} placeholder="0,00" />
              </Field>
              <Field label="Frete / Embalagem (R$)" hint="Custo de envio ou embalagem por peça">
                <MoneyInput value={shippingCost} onChange={setShippingCost} placeholder="0,00" />
              </Field>
            </div>
          </Section>

          {/* Custos Fixos */}
          <Section title="Custos Fixos Mensais" icon={DollarSign}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Total fixos/mês (R$)" hint="Aluguel, energia, plataformas...">
                <MoneyInput value={monthlyFixed} onChange={setMonthlyFixed} placeholder="0,00" />
              </Field>
              <Field label="Peças vendidas/mês" hint="Estimativa para ratear os fixos">
                <MoneyInput value={unitsSoldMonth} onChange={setUnitsSoldMonth} placeholder="0" />
              </Field>
            </div>
            {parseFloat(monthlyFixed) > 0 && parseFloat(unitsSoldMonth) > 0 && (
              <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                Custo fixo por peça: <strong className="text-foreground">R$ {calc.fixedCostPerUnit.toFixed(2).replace('.', ',')}</strong>
              </div>
            )}
          </Section>

          {/* Tráfego */}
          <Section title="Investimento em Tráfego" icon={TrendingUp}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Investimento/mês (R$)" hint="Meta Ads, Google Ads, etc.">
                <MoneyInput value={monthlyTraffic} onChange={setMonthlyTraffic} placeholder="0,00" />
              </Field>
              <Field label="Vendas geradas/mês" hint="Quantas vendas o tráfego gera">
                <MoneyInput value={trafficConversions} onChange={setTrafficConversions} placeholder="0" />
              </Field>
            </div>
            {parseFloat(monthlyTraffic) > 0 && parseFloat(trafficConversions) > 0 && (
              <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                Custo de aquisição por venda: <strong className="text-foreground">R$ {calc.trafficCostPerUnit.toFixed(2).replace('.', ',')}</strong>
              </div>
            )}
          </Section>

          {/* Taxas */}
          <Section title="Taxas & Impostos" icon={Percent}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Field label="Imposto (%)" hint="Simples Nacional, MEI, etc.">
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min="0" max="30" step="0.1"
                    value={taxRate}
                    onChange={e => setTaxRate(Number(e.target.value))}
                    className="w-full"
                  />
                  <span className="text-sm text-muted-foreground shrink-0">%</span>
                </div>
              </Field>
              <Field label="Forma de pagamento" hint="Taxa cobrada pela operadora">
                <select
                  value={paymentFee}
                  onChange={e => setPaymentFee(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {Object.entries(PAYMENT_FEES).map(([k, v]) => (
                    <option key={k} value={k}>{k} ({v}%)</option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          {/* Margem */}
          <Section title="Margem de Lucro Desejada" icon={TrendingUp}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Margem sobre o preço de venda</span>
                <span className="text-2xl font-serif font-semibold text-primary">{desiredMargin}%</span>
              </div>
              <Slider
                value={[desiredMargin]}
                onValueChange={([v]) => setDesiredMargin(v)}
                min={5} max={80} step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5% (mínimo)</span>
                <span className="text-amber-500">≥30% recomendado</span>
                <span>80%</span>
              </div>
            </div>
          </Section>
        </div>

        {/* RIGHT — Resultados */}
        <div className="space-y-5">
          {!hasData ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center text-muted-foreground space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <Calculator className="w-8 h-8 opacity-30" />
              </div>
              <p className="text-sm">Preencha o custo de compra para ver a simulação</p>
            </div>
          ) : (
            <>
              {/* Preços */}
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="px-5 py-4 border-b border-border bg-muted/30">
                  <h3 className="font-serif text-base font-semibold">Faixa de Preço de Venda</h3>
                </div>
                <div className="grid grid-cols-3 divide-x divide-border">
                  <PriceCard
                    label="Preço Mínimo"
                    value={calc.priceMin}
                    desc="Cobre todos os custos"
                    color="orange"
                    icon={AlertTriangle}
                  />
                  <PriceCard
                    label="Preço Ideal"
                    value={calc.priceSuggested}
                    desc={`Margem de ${desiredMargin}%`}
                    color="primary"
                    icon={CheckCircle}
                    highlight
                  />
                  <PriceCard
                    label="Preço Premium"
                    value={calc.priceMax}
                    desc="Posicionamento alto"
                    color="purple"
                    icon={TrendingUp}
                  />
                </div>
              </div>

              {/* Breakdown do preço ideal */}
              {calc.priceSuggested > 0 && (
                <div className="bg-card rounded-2xl border border-border p-5">
                  <h3 className="font-serif text-base font-semibold mb-4">Composição do Preço Ideal</h3>
                  <div className="space-y-2.5">
                    <BreakdownRow label="Custo do produto" value={parseFloat(costPrice) || 0} total={calc.priceSuggested} color="bg-slate-400" />
                    {parseFloat(shippingCost) > 0 && <BreakdownRow label="Frete / Embalagem" value={parseFloat(shippingCost) || 0} total={calc.priceSuggested} color="bg-blue-400" />}
                    {calc.fixedCostPerUnit > 0 && <BreakdownRow label="Custos fixos (rateio)" value={calc.fixedCostPerUnit} total={calc.priceSuggested} color="bg-indigo-400" />}
                    {calc.trafficCostPerUnit > 0 && <BreakdownRow label="Tráfego (CAC)" value={calc.trafficCostPerUnit} total={calc.priceSuggested} color="bg-violet-400" />}
                    {calc.taxCost > 0 && <BreakdownRow label={`Impostos (${taxRate}%)`} value={calc.taxCost} total={calc.priceSuggested} color="bg-amber-400" />}
                    {calc.feeCost > 0 && <BreakdownRow label={`Taxa ${paymentFee}`} value={calc.feeCost} total={calc.priceSuggested} color="bg-orange-400" />}
                    <BreakdownRow label={`Lucro (${desiredMargin}%)`} value={calc.profitPerUnit} total={calc.priceSuggested} color="bg-green-500" bold />
                  </div>
                </div>
              )}

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-4">
                <KpiBox
                  label="Lucro por Unidade"
                  value={`R$ ${calc.profitPerUnit > 0 ? calc.profitPerUnit.toFixed(2).replace('.', ',') : '0,00'}`}
                  sub="no preço ideal"
                  good={calc.profitPerUnit > 0}
                />
                <KpiBox
                  label="Margem Real"
                  value={`${calc.marginPct.toFixed(1)}%`}
                  sub="sobre o preço de venda"
                  good={calc.marginPct >= 30}
                />
                {calc.roiTraffic !== null && (
                  <KpiBox
                    label="ROI do Tráfego"
                    value={`${calc.roiTraffic > 0 ? '+' : ''}${calc.roiTraffic.toFixed(0)}%`}
                    sub="retorno sobre tráfego pago"
                    good={calc.roiTraffic > 0}
                  />
                )}
                {calc.breakEvenUnits > 0 && (
                  <KpiBox
                    label="Ponto de Equilíbrio"
                    value={`${calc.breakEvenUnits} peças/mês`}
                    sub="para cobrir todos os custos"
                    good={parseFloat(unitsSoldMonth) >= calc.breakEvenUnits}
                  />
                )}
              </div>

              {/* Dica de posicionamento */}
              <div className="bg-accent/40 border border-accent rounded-2xl p-4 text-sm text-accent-foreground space-y-1.5">
                <p className="font-medium flex items-center gap-2"><Info className="w-4 h-4" /> Dica de Precificação</p>
                {calc.marginPct < 20 && <p>⚠ Margem abaixo de 20% — risco alto. Revise seus custos ou aumente o preço.</p>}
                {calc.marginPct >= 20 && calc.marginPct < 40 && <p>✓ Margem razoável. Considere estratégias de volume para compensar.</p>}
                {calc.marginPct >= 40 && <p>✓ Excelente margem! Você tem espaço para promoções e ainda manter lucro.</p>}
                {calc.roiTraffic !== null && calc.roiTraffic < 100 && <p>📢 ROI de tráfego baixo — avalie reduzir o investimento ou melhorar a conversão.</p>}
                {calc.roiTraffic !== null && calc.roiTraffic >= 200 && <p>🚀 ROI de tráfego excelente! Vale escalar o investimento.</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="font-sans font-semibold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function MoneyInput({ value, onChange, placeholder }) {
  return (
    <Input
      type="number"
      min="0"
      step="0.01"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function PriceCard({ label, value, desc, color, icon: Icon, highlight }) {
  return (
    <div className={cn("p-4 text-center", highlight && "bg-primary/5")}>
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <p className={cn(
        "font-serif font-semibold text-xl leading-tight",
        highlight ? "text-primary" : color === 'orange' ? "text-amber-600" : "text-foreground"
      )}>
        R$ {value > 0 ? value.toFixed(2).replace('.', ',') : '—'}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
      {highlight && <div className="mt-2 text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5 inline-block">Recomendado</div>}
    </div>
  );
}

function BreakdownRow({ label, value, total, color, bold }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className={cn("text-muted-foreground", bold && "font-semibold text-foreground")}>{label}</span>
        <span className={cn("font-medium", bold && "text-green-600")}>
          R$ {value.toFixed(2).replace('.', ',')} <span className="text-muted-foreground/60">({pct.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

function KpiBox({ label, value, sub, good }) {
  return (
    <div className={cn(
      "rounded-2xl border p-4",
      good ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
    )}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-xl font-serif font-semibold", good ? "text-green-700" : "text-amber-600")}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}