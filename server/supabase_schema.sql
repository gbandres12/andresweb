-- ========================================================
-- ANDRESWEB — ESQUEMA MULTI-TENANT HIERÁRQUICO NO SUPABASE
-- Suporte a Organizações (Clientes com N Lojas) e SuperAdmin
-- ========================================================

-- Habilita extensão de UUID se necessário
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------
-- 1. TABELA DE ORGANIZAÇÕES (Clientes / Grupos de Lojas)
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
-- 2. TABELA DE LOJAS / FILIAIS / CANAIS
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
-- 3. TABELA DE USUÁRIOS E PERFIS DE ACESSO
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

-- --------------------------------------------------------
-- 4. TABELA DE PRODUTOS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
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
-- 5. TABELA DE VENDAS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    sale_number TEXT NOT NULL,
    customer_id UUID,
    customer_name TEXT,
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
-- 6. TABELA DE TRANSAÇÕES FINANCEIRAS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    type TEXT NOT NULL, -- 'receita' ou 'despesa'
    category TEXT,
    payment_method TEXT,
    status TEXT DEFAULT 'pago',
    month TEXT,
    customer_id UUID,
    customer_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------
-- 7. TABELA DE MOVIMENTAÇÕES DE ESTOQUE
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
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
-- 8. TABELA DE TRANSFERÊNCIAS ENTRE LOJAS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
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
-- ÍNDICES GIN E B-TREE PARA ALTA PERFORMANCE
-- --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_stores_org ON public.stores(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_org_store ON public.products(organization_id, store_id);
CREATE INDEX IF NOT EXISTS idx_products_variants GIN ON public.products(variants);
CREATE INDEX IF NOT EXISTS idx_sales_org_store ON public.sales(organization_id, store_id);
CREATE INDEX IF NOT EXISTS idx_transactions_org_store ON public.transactions(organization_id, store_id);

-- --------------------------------------------------------
-- SEGURANÇA ROW LEVEL SECURITY (RLS) MULTI-TENANT
-- --------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

-- Política RLS Global para Produtos
CREATE POLICY "Isolamento Multi-tenant Produtos" ON public.products
FOR ALL USING (
    -- SuperAdmin enxerga tudo
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
    OR
    -- Admin do Cliente enxerga todas as lojas de sua Organização
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
);

-- Política RLS Global para Vendas
CREATE POLICY "Isolamento Multi-tenant Vendas" ON public.sales
FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
    OR
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
);

-- Política RLS Global para Transações Financeiras
CREATE POLICY "Isolamento Multi-tenant Transações" ON public.transactions
FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
    OR
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
);

-- Política RLS Global para Transferências entre Lojas
CREATE POLICY "Isolamento Multi-tenant Transferências" ON public.transfers
FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
    OR
    organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
);
