-- ========================================================
-- ANDRESWEB — ESQUEMA COMPLETO MULTI-TENANT E SEGURANÇA (SUPABASE)
-- Banco PostgreSQL para 17 Entidades com RLS e Suporte a Lojas / Filiais
-- ========================================================

-- Habilita extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- --------------------------------------------------------
-- 1. ORGANIZAÇÕES (Clientes SaaS / Grupos de Lojas)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    plan TEXT DEFAULT 'pro',
    ai_credits INTEGER DEFAULT 500,
    ai_credits_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- 2. LOJAS / FILIAIS / CANAIS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cnpj TEXT,
    city TEXT,
    state TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- 3. PERFIS DE USUÁRIOS E PERMISSÕES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'store_manager', -- 'superadmin', 'org_admin', 'store_manager', 'cashier'
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger para sincronizar auth.users -> public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_app_meta_data->>'role', 'store_manager')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- --------------------------------------------------------
-- 4. CATEGORIAS DE PRODUTOS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- 5. PRODUTOS E VARIANTES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    reference TEXT,
    sku TEXT,
    gtin TEXT,
    price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    cost_price NUMERIC(10,2) DEFAULT 0.00,
    price_tables JSONB DEFAULT '{}'::jsonb,
    variants JSONB DEFAULT '[]'::jsonb, -- [{size, color, stock, sku}]
    images TEXT[] DEFAULT ARRAY[]::TEXT[],
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- 6. CLIENTES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cpf_cnpj TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    notes TEXT,
    credit_balance NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- 7. FUNCIONÁRIOS E VENDEDORES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'vendedor',
    phone TEXT,
    email TEXT,
    commission_rate NUMERIC(5,2) DEFAULT 0.00,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- 8. CAIXA (CASH REGISTERS) & MOVIMENTAÇÕES DE CAIXA
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    operator_id UUID,
    operator_name TEXT,
    initial_amount NUMERIC(10,2) DEFAULT 0.00,
    current_amount NUMERIC(10,2) DEFAULT 0.00,
    status TEXT DEFAULT 'aberto', -- 'aberto', 'fechado'
    opened_at TIMESTAMPTZ DEFAULT now(),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'suprimento', 'sangria', 'venda'
    amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- 9. VENDAS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    sale_number TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    seller_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    seller_name TEXT,
    operator_name TEXT,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(10,2) DEFAULT 0.00,
    total NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    payment_method TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'concluida',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- 10. DESPESAS E CENTROS DE CUSTO
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    category TEXT,
    cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
    due_date DATE,
    payment_date DATE,
    status TEXT DEFAULT 'pendente', -- 'pendente', 'pago'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- 11. TRANSAÇÕES FINANCEIRAS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    type TEXT NOT NULL, -- 'receita', 'despesa'
    category TEXT,
    payment_method TEXT,
    status TEXT DEFAULT 'pago',
    month TEXT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- 12. MOVIMENTAÇÕES DE ESTOQUE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    product_name TEXT,
    variant_size TEXT,
    variant_color TEXT,
    type TEXT NOT NULL, -- 'entrada', 'saida', 'transferencia'
    quantity INTEGER NOT NULL DEFAULT 1,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- 13. TRANSFERÊNCIAS ENTRE LOJAS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    origin_store_id UUID NOT NULL REFERENCES public.stores(id),
    origin_store_name TEXT,
    destination_store_id UUID NOT NULL REFERENCES public.stores(id),
    destination_store_name TEXT,
    transfer_number TEXT NOT NULL,
    status TEXT DEFAULT 'rascunho', -- 'rascunho', 'em_transito', 'recebido', 'parcial'
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    dispatched_at TIMESTAMPTZ,
    dispatched_by TEXT,
    received_at TIMESTAMPTZ,
    received_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- 14. TROCAS E DEVOLUÇÕES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exchanges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    exchange_number TEXT NOT NULL,
    exchange_type TEXT NOT NULL, -- 'troca', 'credito', 'estorno'
    original_sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    original_sale_number TEXT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    returned_items JSONB DEFAULT '[]'::jsonb,
    new_items JSONB DEFAULT '[]'::jsonb,
    returned_value NUMERIC(10,2) DEFAULT 0.00,
    new_value NUMERIC(10,2) DEFAULT 0.00,
    difference NUMERIC(10,2) DEFAULT 0.00,
    reason TEXT,
    payment_method TEXT,
    refund_method TEXT,
    status TEXT DEFAULT 'concluida',
    operator_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- 15. COMISSÕES E CONCILIAÇÕES BANCÁRIAS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    employee_name TEXT,
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    sale_number TEXT,
    sale_amount NUMERIC(10,2) DEFAULT 0.00,
    commission_rate NUMERIC(5,2) DEFAULT 0.00,
    commission_amount NUMERIC(10,2) DEFAULT 0.00,
    status TEXT DEFAULT 'pendente', -- 'pendente', 'pago'
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conciliation_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    date DATE,
    description TEXT,
    amount NUMERIC(10,2) DEFAULT 0.00,
    type TEXT,
    status TEXT DEFAULT 'pendente',
    matched_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- ÍNDICES DE ALTA PERFORMANCE (SINTAXE CORRETA POSTGRESQL)
-- --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_stores_org ON public.stores(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_org_store ON public.products(organization_id, store_id);
CREATE INDEX IF NOT EXISTS idx_products_variants ON public.products USING gin (variants);
CREATE INDEX IF NOT EXISTS idx_products_tags ON public.products USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_sales_org_store ON public.sales(organization_id, store_id);
CREATE INDEX IF NOT EXISTS idx_transactions_org_store ON public.transactions(organization_id, store_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON public.stock_movements(product_id);

-- --------------------------------------------------------
-- ATIVAÇÃO DE ROW LEVEL SECURITY (RLS) EM TODAS AS TABELAS
-- --------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conciliation_entries ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- POLÍTICAS RLS COM "TO authenticated" E Ownership Predicates
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Acesso Produtos Autenticados" ON public.products;
CREATE POLICY "Acesso Produtos Autenticados" ON public.products
FOR ALL TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  OR organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  OR organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
);

DROP POLICY IF EXISTS "Acesso Vendas Autenticados" ON public.sales;
CREATE POLICY "Acesso Vendas Autenticados" ON public.sales
FOR ALL TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  OR organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  OR organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
);

DROP POLICY IF EXISTS "Acesso Transações Autenticados" ON public.transactions;
CREATE POLICY "Acesso Transações Autenticados" ON public.transactions
FOR ALL TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  OR organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  OR organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
);
