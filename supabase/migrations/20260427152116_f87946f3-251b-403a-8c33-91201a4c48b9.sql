
-- Tipos de eventos personalizáveis por loja (festival, feira, festa, casamento, etc.)
CREATE TABLE public.event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT 'rose',
  icon TEXT DEFAULT 'sparkles',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, name)
);
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_types shop read" ON public.event_types FOR SELECT TO authenticated
  USING (is_shop_member(shop_id, auth.uid()));
CREATE POLICY "event_types shop write" ON public.event_types FOR ALL TO authenticated
  USING (has_shop_role(shop_id, auth.uid(), ARRAY['owner'::shop_role,'manager'::shop_role]))
  WITH CHECK (has_shop_role(shop_id, auth.uid(), ARRAY['owner'::shop_role,'manager'::shop_role]));

-- Eventos (festivais, feiras, festas, etc.)
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL,
  event_type_id UUID REFERENCES public.event_types(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_shop_date ON public.events(shop_id, date DESC);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events shop read" ON public.events FOR SELECT TO authenticated
  USING (is_shop_member(shop_id, auth.uid()));
CREATE POLICY "events shop write" ON public.events FOR ALL TO authenticated
  USING (has_shop_role(shop_id, auth.uid(), ARRAY['owner'::shop_role,'manager'::shop_role]))
  WITH CHECK (has_shop_role(shop_id, auth.uid(), ARRAY['owner'::shop_role,'manager'::shop_role]));
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Receitas em eventos (com lotes)
CREATE TABLE public.event_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  batches NUMERIC NOT NULL DEFAULT 1,
  UNIQUE (event_id, recipe_id)
);
ALTER TABLE public.event_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_recipes read" ON public.event_recipes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_recipes.event_id AND is_shop_member(e.shop_id, auth.uid())));
CREATE POLICY "event_recipes write" ON public.event_recipes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_recipes.event_id AND has_shop_role(e.shop_id, auth.uid(), ARRAY['owner'::shop_role,'manager'::shop_role])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_recipes.event_id AND has_shop_role(e.shop_id, auth.uid(), ARRAY['owner'::shop_role,'manager'::shop_role])));

-- Tarefas livres por dia
CREATE TABLE public.event_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  day_key TEXT NOT NULL, -- 'qua','qui','sex','sab' ou data ISO custom
  task TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_tasks_event ON public.event_tasks(event_id, day_key, position);
ALTER TABLE public.event_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_tasks read" ON public.event_tasks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_tasks.event_id AND is_shop_member(e.shop_id, auth.uid())));
CREATE POLICY "event_tasks write" ON public.event_tasks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_tasks.event_id AND has_shop_role(e.shop_id, auth.uid(), ARRAY['owner'::shop_role,'manager'::shop_role])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_tasks.event_id AND has_shop_role(e.shop_id, auth.uid(), ARRAY['owner'::shop_role,'manager'::shop_role])));

-- Produtos do PDV personalizáveis
CREATE TABLE public.pdv_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL,
  label TEXT NOT NULL,
  price NUMERIC NOT NULL,
  icon TEXT DEFAULT 'cake',
  tone TEXT DEFAULT 'rose',
  position INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pdv_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pdv_products read" ON public.pdv_products FOR SELECT TO authenticated
  USING (is_shop_member(shop_id, auth.uid()));
CREATE POLICY "pdv_products write" ON public.pdv_products FOR ALL TO authenticated
  USING (has_shop_role(shop_id, auth.uid(), ARRAY['owner'::shop_role,'manager'::shop_role]))
  WITH CHECK (has_shop_role(shop_id, auth.uid(), ARRAY['owner'::shop_role,'manager'::shop_role]));

-- Vendas
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL,
  product_id UUID REFERENCES public.pdv_products(id) ON DELETE SET NULL,
  item TEXT NOT NULL,
  price NUMERIC NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  sold_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
CREATE INDEX idx_sales_shop_date ON public.sales(shop_id, sold_at DESC);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales read" ON public.sales FOR SELECT TO authenticated
  USING (is_shop_member(shop_id, auth.uid()));
CREATE POLICY "sales write" ON public.sales FOR ALL TO authenticated
  USING (is_shop_member(shop_id, auth.uid()))
  WITH CHECK (is_shop_member(shop_id, auth.uid()));

-- Encomendas (pedidos de clientes)
CREATE TYPE public.order_status AS ENUM ('orcamento','confirmado','produzindo','pronto','entregue','cancelado');

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  servings INT,
  delivery_at TIMESTAMPTZ NOT NULL,
  delivery_address TEXT,
  total_price NUMERIC NOT NULL DEFAULT 0,
  deposit_paid NUMERIC NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'orcamento',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_shop_delivery ON public.orders(shop_id, delivery_at);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders read" ON public.orders FOR SELECT TO authenticated
  USING (is_shop_member(shop_id, auth.uid()));
CREATE POLICY "orders write" ON public.orders FOR ALL TO authenticated
  USING (has_shop_role(shop_id, auth.uid(), ARRAY['owner'::shop_role,'manager'::shop_role]))
  WITH CHECK (has_shop_role(shop_id, auth.uid(), ARRAY['owner'::shop_role,'manager'::shop_role]));
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Catálogo público: marca produtos visíveis na vitrine e recipes podem ter preço público
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS public_price NUMERIC;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS show_in_catalog BOOLEAN NOT NULL DEFAULT false;

CREATE POLICY "recipes public catalog" ON public.recipes FOR SELECT TO anon
  USING (show_in_catalog = true);
