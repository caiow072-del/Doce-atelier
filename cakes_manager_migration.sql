-- ============================================================================
-- CAKES MANAGER — Script de Migração Completo
-- Supabase → Supabase (instância própria)
-- Gerado a partir do banco em produção (qkvwhnowqrcurmvuccce)
--
-- Como usar:
--   1. Crie um projeto novo no Supabase (sua instância).
--   2. Vá em SQL Editor → New query.
--   3. Cole este arquivo INTEIRO e execute.
--   4. Habilite os providers de Auth desejados (Email, Google) no painel.
--   5. Crie os Storage buckets listados ao final (product-images, recipe-images, storefront-banners).
--   6. Configure as variáveis VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
--      e SUPABASE_SERVICE_ROLE_KEY no novo ambiente.
--
-- O script é idempotente onde possível (IF NOT EXISTS / OR REPLACE).
-- Roda em ordem: extensions → enums → tabelas → índices → views →
-- functions → triggers → RLS → policies → grants → storage.
-- ============================================================================

-- ------------------------------------------------------------
-- 0. EXTENSIONS
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- 1. ENUMS / TIPOS CUSTOMIZADOS
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.shop_role AS ENUM ('owner','manager','staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM
    ('orcamento','confirmado','produzindo','pronto','entregue','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- 2. TABELAS
-- ------------------------------------------------------------

-- profiles (1:1 com auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- shops (multi-tenant root)
CREATE TABLE IF NOT EXISTS public.shops (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  slug           text NOT NULL UNIQUE,
  description    text,
  whatsapp       text,
  logo_url       text,
  theme          jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_margin  numeric NOT NULL DEFAULT 0.30,
  created_by     uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shops_slug ON public.shops(slug);

-- shop_members
CREATE TABLE IF NOT EXISTS public.shop_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        public.shop_role NOT NULL DEFAULT 'staff',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_shop_members_shop ON public.shop_members(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_members_user ON public.shop_members(user_id);

-- ingredients
CREATE TABLE IF NOT EXISTS public.ingredients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name          text NOT NULL,
  unit          text NOT NULL CHECK (unit IN ('g','kg','ml','L','un')),
  price_paid    numeric NOT NULL CHECK (price_paid >= 0),
  package_qty   numeric NOT NULL CHECK (package_qty > 0),
  stock_qty     numeric NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ingredients_shop ON public.ingredients(shop_id);

-- recipes
CREATE TABLE IF NOT EXISTS public.recipes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name              text NOT NULL,
  description       text,
  image_url         text,
  servings          integer NOT NULL CHECK (servings > 0),
  labor_cost        numeric NOT NULL DEFAULT 0,
  packaging_cost    numeric NOT NULL DEFAULT 0,
  target_margin     numeric NOT NULL DEFAULT 0.30 CHECK (target_margin >= 0 AND target_margin < 1),
  waste_pct         numeric NOT NULL DEFAULT 0.10 CHECK (waste_pct >= 0 AND waste_pct < 1),
  public_price      numeric,
  slice_price       numeric,
  promo_price       numeric,
  is_featured       boolean NOT NULL DEFAULT false,
  show_in_catalog   boolean NOT NULL DEFAULT false,
  category          text,
  catalog_position  integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recipes_shop          ON public.recipes(shop_id);
CREATE INDEX IF NOT EXISTS idx_recipes_shop_catalog  ON public.recipes(shop_id) WHERE show_in_catalog = true;
CREATE INDEX IF NOT EXISTS idx_recipes_catalog_pos   ON public.recipes(shop_id, catalog_position);
CREATE INDEX IF NOT EXISTS idx_recipes_featured      ON public.recipes(shop_id, is_featured) WHERE is_featured = true;

-- recipe_ingredients
CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id      uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  ingredient_id  uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity       numeric NOT NULL CHECK (quantity > 0),
  UNIQUE (recipe_id, ingredient_id)
);
CREATE INDEX IF NOT EXISTS idx_recipe_ing_recipe ON public.recipe_ingredients(recipe_id);

-- customers
CREATE TABLE IF NOT EXISTS public.customers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id     uuid,
  name        text NOT NULL,
  phone       text NOT NULL,
  address     text NOT NULL,
  email       text,
  notes       text,
  source      text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','storefront')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_shop       ON public.customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_user       ON public.customers(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_shop_phone ON public.customers(shop_id, phone);

-- orders
CREATE TABLE IF NOT EXISTS public.orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id       uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  recipe_id         uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  customer_name     text NOT NULL,
  customer_phone    text,
  description       text NOT NULL,
  servings          integer,
  delivery_at       timestamptz NOT NULL,
  delivery_address  text,
  delivery_method   text NOT NULL DEFAULT 'pickup' CHECK (delivery_method IN ('pickup','delivery')),
  total_price       numeric NOT NULL DEFAULT 0,
  deposit_paid      numeric NOT NULL DEFAULT 0,
  status            public.order_status NOT NULL DEFAULT 'orcamento',
  source            text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','storefront')),
  notes             text,
  items             jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_customer       ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_delivery  ON public.orders(shop_id, delivery_at);
CREATE INDEX IF NOT EXISTS idx_orders_shop_status    ON public.orders(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_shop_source    ON public.orders(shop_id, source) WHERE source = 'storefront';

-- event_types
CREATE TABLE IF NOT EXISTS public.event_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL,
  name        text NOT NULL,
  kind        text NOT NULL DEFAULT 'generic',
  icon        text DEFAULT 'sparkles',
  color       text DEFAULT 'rose',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, name)
);

-- events
CREATE TABLE IF NOT EXISTS public.events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             uuid NOT NULL,
  event_type_id       uuid REFERENCES public.event_types(id) ON DELETE SET NULL,
  parent_event_id     uuid,
  name                text NOT NULL,
  date                timestamptz NOT NULL,
  start_time          text,
  location            text,
  customer_name       text,
  guests              integer,
  main_flavor         text,
  fee                 numeric NOT NULL DEFAULT 0,
  opening_cash        numeric NOT NULL DEFAULT 0,
  recurrence          text NOT NULL DEFAULT 'none',
  recurrence_until    date,
  weekday             integer,
  day_of_month        integer,
  notes               text,
  closed_at           timestamptz,
  payment_summary     jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_shop_date ON public.events(shop_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_events_closed    ON public.events(closed_at);
CREATE INDEX IF NOT EXISTS idx_events_parent    ON public.events(parent_event_id);

-- event_occurrences
CREATE TABLE IF NOT EXISTS public.event_occurrences (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  occurrence_date  date NOT NULL,
  closed_at        timestamptz,
  payment_summary  jsonb,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, occurrence_date)
);
CREATE INDEX IF NOT EXISTS idx_event_occurrences_event ON public.event_occurrences(event_id, occurrence_date);

-- event_products
CREATE TABLE IF NOT EXISTS public.event_products (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  recipe_id    uuid,
  name         text NOT NULL,
  description  text,
  category     text,
  unit_price   numeric NOT NULL DEFAULT 0,
  promo_price  numeric,
  batches      numeric NOT NULL DEFAULT 0,
  planned_qty  integer NOT NULL DEFAULT 0,
  sold_qty     integer NOT NULL DEFAULT 0,
  sale_mode    text NOT NULL DEFAULT 'unit',
  is_featured  boolean NOT NULL DEFAULT false,
  image_url    text,
  position     integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_products_event ON public.event_products(event_id);

-- event_recipes
CREATE TABLE IF NOT EXISTS public.event_recipes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  recipe_id  uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  batches    numeric NOT NULL DEFAULT 1,
  UNIQUE (event_id, recipe_id)
);

-- event_tasks
CREATE TABLE IF NOT EXISTS public.event_tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  day_key     text NOT NULL,
  task        text NOT NULL,
  done        boolean NOT NULL DEFAULT false,
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_tasks_event ON public.event_tasks(event_id, day_key, position);

-- pdv_products
CREATE TABLE IF NOT EXISTS public.pdv_products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL,
  label       text NOT NULL,
  price       numeric NOT NULL,
  icon        text DEFAULT 'cake',
  tone        text DEFAULT 'rose',
  image_url   text,
  position    integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- sales (PDV)
CREATE TABLE IF NOT EXISTS public.sales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         uuid NOT NULL,
  product_id      uuid REFERENCES public.pdv_products(id) ON DELETE SET NULL,
  event_id        uuid,
  cart_id         uuid,
  item            text NOT NULL,
  price           numeric NOT NULL,
  qty             integer NOT NULL DEFAULT 1,
  discount        numeric NOT NULL DEFAULT 0,
  payment_method  text NOT NULL DEFAULT 'cash',
  refunded_at     timestamptz,
  refund_reason   text,
  created_by      uuid,
  sold_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_cart           ON public.sales(cart_id);
CREATE INDEX IF NOT EXISTS idx_sales_event          ON public.sales(event_id);
CREATE INDEX IF NOT EXISTS idx_sales_shop_date      ON public.sales(shop_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_shop_sold_at   ON public.sales(shop_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_sold_at        ON public.sales(sold_at);

-- shop_storefront (1:1 com shops)
CREATE TABLE IF NOT EXISTS public.shop_storefront (
  shop_id              uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  template             text NOT NULL DEFAULT 'romantic',
  hero_title           text,
  hero_subtitle        text,
  banner_url           text,
  hero_images          jsonb NOT NULL DEFAULT '[]'::jsonb,
  about_text           text,
  more_info            text,
  cta_label            text,
  cta_link             text,
  city                 text,
  state                text,
  social               jsonb NOT NULL DEFAULT '{}'::jsonb,
  sections             jsonb NOT NULL DEFAULT '[]'::jsonb,
  sections_config      jsonb NOT NULL DEFAULT '[]'::jsonb,
  promotions           jsonb NOT NULL DEFAULT '[]'::jsonb,
  testimonials         jsonb NOT NULL DEFAULT '[]'::jsonb,
  gallery              jsonb NOT NULL DEFAULT '[]'::jsonb,
  theme_overrides      jsonb NOT NULL DEFAULT '{}'::jsonb,
  mobile_overrides     jsonb NOT NULL DEFAULT '{}'::jsonb,
  business_hours       jsonb NOT NULL DEFAULT '{}'::jsonb,
  pickup_enabled       boolean NOT NULL DEFAULT true,
  pickup_address       text,
  delivery_enabled     boolean NOT NULL DEFAULT false,
  delivery_address     text,
  delivery_fee         numeric NOT NULL DEFAULT 0,
  delivery_radius_km   numeric NOT NULL DEFAULT 0,
  bottom_nav_enabled   boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- shop_visits (analytics público)
CREATE TABLE IF NOT EXISTS public.shop_visits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  session_key  text,
  device       text,
  referer      text,
  visited_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shop_visits_shop_date ON public.shop_visits(shop_id, visited_at DESC);

-- ------------------------------------------------------------
-- 3. FUNCTIONS
-- ------------------------------------------------------------

-- touch_updated_at: trigger genérica para manter updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- is_shop_member: SECURITY DEFINER para uso em RLS sem recursão
CREATE OR REPLACE FUNCTION public.is_shop_member(_shop_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_members
    WHERE shop_id = _shop_id AND user_id = _user_id
  );
$$;

-- has_shop_role
CREATE OR REPLACE FUNCTION public.has_shop_role(_shop_id uuid, _user_id uuid, _roles public.shop_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_members
    WHERE shop_id = _shop_id AND user_id = _user_id AND role = ANY(_roles)
  );
$$;

-- handle_new_user: cria profile + shop + membership owner ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_shop_id   uuid;
  base_slug     text;
  final_slug    text;
  counter       int := 0;
  display_name  text;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, display_name);

  base_slug := lower(regexp_replace(
    COALESCE(NEW.raw_user_meta_data->>'shop_name', display_name || ' confeitaria'),
    '[^a-z0-9]+', '-', 'gi'));
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN base_slug := 'loja'; END IF;
  final_slug := base_slug;

  WHILE EXISTS (SELECT 1 FROM public.shops WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  INSERT INTO public.shops (name, slug, created_by)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'shop_name', display_name || ' Confeitaria'),
    final_slug,
    NEW.id
  )
  RETURNING id INTO new_shop_id;

  INSERT INTO public.shop_members (shop_id, user_id, role)
  VALUES (new_shop_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

-- create_storefront_order: RPC pública que cria customer + order de forma controlada
CREATE OR REPLACE FUNCTION public.create_storefront_order(
  p_shop_id           uuid,
  p_customer_name     text,
  p_customer_phone    text,
  p_customer_address  text,
  p_delivery_method   text,
  p_delivery_address  text,
  p_delivery_at       timestamptz,
  p_description       text,
  p_total_price       numeric,
  p_notes             text,
  p_items             jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_order_id    uuid;
  v_phone text := trim(p_customer_phone);
  v_name  text := trim(p_customer_name);
BEGIN
  IF p_shop_id IS NULL THEN RAISE EXCEPTION 'shop_id required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'shop not found';
  END IF;
  IF v_name = '' OR length(v_name) > 120 THEN RAISE EXCEPTION 'invalid name'; END IF;
  IF v_phone = '' OR length(v_phone) > 30 THEN RAISE EXCEPTION 'invalid phone'; END IF;
  IF p_delivery_method NOT IN ('pickup','delivery') THEN RAISE EXCEPTION 'invalid delivery method'; END IF;
  IF p_total_price IS NULL OR p_total_price < 0 OR p_total_price > 1000000 THEN
    RAISE EXCEPTION 'invalid total';
  END IF;
  IF p_delivery_at IS NULL OR p_delivery_at < now() - interval '1 minute' THEN
    RAISE EXCEPTION 'invalid delivery date';
  END IF;

  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE shop_id = p_shop_id AND phone = v_phone
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (shop_id, name, phone, address, source)
    VALUES (p_shop_id, v_name, v_phone, COALESCE(NULLIF(trim(p_customer_address),''),'—'), 'storefront')
    RETURNING id INTO v_customer_id;
  END IF;

  INSERT INTO public.orders (
    shop_id, customer_id, customer_name, customer_phone,
    description, delivery_at, delivery_address, delivery_method,
    total_price, deposit_paid, status, source, notes, items
  ) VALUES (
    p_shop_id, v_customer_id, v_name, v_phone,
    LEFT(COALESCE(p_description,''), 2000),
    p_delivery_at,
    CASE WHEN p_delivery_method = 'delivery' THEN NULLIF(trim(p_delivery_address),'') END,
    p_delivery_method,
    p_total_price, 0, 'orcamento', 'storefront',
    NULLIF(LEFT(COALESCE(p_notes,''), 1000),''),
    p_items
  ) RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$;

-- ------------------------------------------------------------
-- 4. TRIGGERS
-- ------------------------------------------------------------

-- updated_at touchers
DROP TRIGGER IF EXISTS profiles_touch                  ON public.profiles;
CREATE TRIGGER profiles_touch                  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS shops_touch                     ON public.shops;
CREATE TRIGGER shops_touch                     BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS ingredients_touch               ON public.ingredients;
CREATE TRIGGER ingredients_touch               BEFORE UPDATE ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS recipes_touch                   ON public.recipes;
CREATE TRIGGER recipes_touch                   BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS customers_touch_updated_at      ON public.customers;
CREATE TRIGGER customers_touch_updated_at      BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated              ON public.orders;
CREATE TRIGGER trg_orders_updated              BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_events_updated              ON public.events;
CREATE TRIGGER trg_events_updated              BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_event_occurrences_updated   ON public.event_occurrences;
CREATE TRIGGER trg_event_occurrences_updated   BEFORE UPDATE ON public.event_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS event_products_touch            ON public.event_products;
CREATE TRIGGER event_products_touch            BEFORE UPDATE ON public.event_products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_shop_storefront_updated     ON public.shop_storefront;
CREATE TRIGGER trg_shop_storefront_updated     BEFORE UPDATE ON public.shop_storefront
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Trigger no auth.users (CRÍTICA): cria profile+shop+membership no signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- 5. VIEWS PÚBLICAS (não vazam campos sensíveis)
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW public.shops_public AS
  SELECT id, name, slug, whatsapp, description, logo_url, theme
  FROM public.shops;

CREATE OR REPLACE VIEW public.recipes_public AS
  SELECT id, shop_id, name, description, image_url,
         public_price, promo_price, servings, category,
         is_featured, show_in_catalog, catalog_position
  FROM public.recipes
  WHERE show_in_catalog = true;

-- ------------------------------------------------------------
-- 6. ROW LEVEL SECURITY — Enable em todas as tabelas
-- ------------------------------------------------------------
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_types       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_recipes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_tasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdv_products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_storefront   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_visits       ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 7. RLS POLICIES
-- ------------------------------------------------------------

-- profiles
CREATE POLICY "profiles self read"   ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- shops
CREATE POLICY "shops members read" ON public.shops
  FOR SELECT TO authenticated USING (public.is_shop_member(id, auth.uid()));
CREATE POLICY "shops owner update" ON public.shops
  FOR UPDATE TO authenticated USING (public.has_shop_role(id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]));

-- shop_members
CREATE POLICY "members self read" ON public.shop_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_shop_member(shop_id, auth.uid()));
CREATE POLICY "members owner manage" ON public.shop_members
  FOR ALL TO authenticated
  USING (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner']::public.shop_role[]))
  WITH CHECK (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner']::public.shop_role[]));

-- ingredients
CREATE POLICY "ingredients shop read" ON public.ingredients
  FOR SELECT TO authenticated USING (public.is_shop_member(shop_id, auth.uid()));
CREATE POLICY "ingredients shop write" ON public.ingredients
  FOR ALL TO authenticated
  USING (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]))
  WITH CHECK (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]));

-- recipes
CREATE POLICY "recipes shop read" ON public.recipes
  FOR SELECT TO authenticated USING (public.is_shop_member(shop_id, auth.uid()));
CREATE POLICY "recipes shop write" ON public.recipes
  FOR ALL TO authenticated
  USING (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]))
  WITH CHECK (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]));

-- recipe_ingredients
CREATE POLICY "recipe_ing read" ON public.recipe_ingredients
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.recipes r
            WHERE r.id = recipe_ingredients.recipe_id
              AND public.is_shop_member(r.shop_id, auth.uid())));
CREATE POLICY "recipe_ing write" ON public.recipe_ingredients
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r
                 WHERE r.id = recipe_ingredients.recipe_id
                   AND public.has_shop_role(r.shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.recipes r
                      WHERE r.id = recipe_ingredients.recipe_id
                        AND public.has_shop_role(r.shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[])));

-- customers
CREATE POLICY "customers self read"   ON public.customers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "customers self insert" ON public.customers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "customers self update" ON public.customers FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "customers shop read"   ON public.customers FOR SELECT TO authenticated USING (public.is_shop_member(shop_id, auth.uid()));
CREATE POLICY "customers shop write"  ON public.customers
  FOR ALL TO authenticated
  USING (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]))
  WITH CHECK (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]));

-- orders
CREATE POLICY "orders read"  ON public.orders FOR SELECT TO authenticated USING (public.is_shop_member(shop_id, auth.uid()));
CREATE POLICY "orders write" ON public.orders
  FOR ALL TO authenticated
  USING (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]))
  WITH CHECK (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]));

-- event_types
CREATE POLICY "event_types shop read" ON public.event_types FOR SELECT TO authenticated USING (public.is_shop_member(shop_id, auth.uid()));
CREATE POLICY "event_types shop write" ON public.event_types
  FOR ALL TO authenticated
  USING (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]))
  WITH CHECK (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]));

-- events
CREATE POLICY "events shop read" ON public.events FOR SELECT TO authenticated USING (public.is_shop_member(shop_id, auth.uid()));
CREATE POLICY "events shop write" ON public.events
  FOR ALL TO authenticated
  USING (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]))
  WITH CHECK (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]));

-- event_occurrences
CREATE POLICY "event_occurrences read" ON public.event_occurrences FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_occurrences.event_id AND public.is_shop_member(e.shop_id, auth.uid())));
CREATE POLICY "event_occurrences write" ON public.event_occurrences
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_occurrences.event_id AND public.has_shop_role(e.shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_occurrences.event_id AND public.has_shop_role(e.shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[])));

-- event_products
CREATE POLICY "event_products read" ON public.event_products FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_products.event_id AND public.is_shop_member(e.shop_id, auth.uid())));
CREATE POLICY "event_products write" ON public.event_products
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_products.event_id AND public.has_shop_role(e.shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_products.event_id AND public.has_shop_role(e.shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[])));

-- event_recipes
CREATE POLICY "event_recipes read" ON public.event_recipes FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_recipes.event_id AND public.is_shop_member(e.shop_id, auth.uid())));
CREATE POLICY "event_recipes write" ON public.event_recipes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_recipes.event_id AND public.has_shop_role(e.shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_recipes.event_id AND public.has_shop_role(e.shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[])));

-- event_tasks
CREATE POLICY "event_tasks read" ON public.event_tasks FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_tasks.event_id AND public.is_shop_member(e.shop_id, auth.uid())));
CREATE POLICY "event_tasks write" ON public.event_tasks
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_tasks.event_id AND public.has_shop_role(e.shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_tasks.event_id AND public.has_shop_role(e.shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[])));

-- pdv_products
CREATE POLICY "pdv_products read" ON public.pdv_products FOR SELECT TO authenticated USING (public.is_shop_member(shop_id, auth.uid()));
CREATE POLICY "pdv_products write" ON public.pdv_products
  FOR ALL TO authenticated
  USING (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]))
  WITH CHECK (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]));

-- sales
CREATE POLICY "sales read"  ON public.sales FOR SELECT TO authenticated USING (public.is_shop_member(shop_id, auth.uid()));
CREATE POLICY "sales write" ON public.sales
  FOR ALL TO authenticated
  USING (public.is_shop_member(shop_id, auth.uid()))
  WITH CHECK (public.is_shop_member(shop_id, auth.uid()));

-- shop_storefront
CREATE POLICY "storefront public read" ON public.shop_storefront
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "storefront shop write" ON public.shop_storefront
  FOR ALL TO authenticated
  USING (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]))
  WITH CHECK (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]));

-- shop_visits (analytics público — anônimo pode inserir, só membros leem)
CREATE POLICY "shop_visits_insert_anyone" ON public.shop_visits
  FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_visits.shop_id));
CREATE POLICY "shop_visits_select_members" ON public.shop_visits
  FOR SELECT TO authenticated USING (public.is_shop_member(shop_id, auth.uid()));

-- ------------------------------------------------------------
-- 8. GRANTS
-- ------------------------------------------------------------

-- Acesso anônimo APENAS via views públicas + RPC + tabelas com policies anon
GRANT SELECT ON public.shops_public      TO anon, authenticated;
GRANT SELECT ON public.recipes_public    TO anon, authenticated;

-- RPC pública para criar pedidos da vitrine
GRANT EXECUTE ON FUNCTION public.create_storefront_order(
  uuid, text, text, text, text, text, timestamptz, text, numeric, text, jsonb
) TO anon, authenticated;

-- Funções de role check podem ser executadas por authenticated (usadas em RLS via SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION public.is_shop_member(uuid, uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_shop_role(uuid, uuid, public.shop_role[]) TO authenticated;

-- ============================================================================
-- ============================================================================
-- 9. STORAGE BUCKETS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public) VALUES
  ('product-images',     'product-images',     true),
  ('recipe-images',      'recipe-images',      true),
  ('storefront-banners', 'storefront-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Policies para product-images
CREATE POLICY "auth upload product-images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "auth update product-images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'product-images');
CREATE POLICY "auth delete product-images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'product-images');
CREATE POLICY "public read product-images" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'product-images');

-- Policies para recipe-images
CREATE POLICY "auth upload recipe-images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'recipe-images');
CREATE POLICY "auth update recipe-images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'recipe-images');
CREATE POLICY "auth delete recipe-images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'recipe-images');
CREATE POLICY "public read recipe-images" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'recipe-images');

-- Policies para storefront-banners
CREATE POLICY "auth upload storefront-banners" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'storefront-banners');
CREATE POLICY "auth update storefront-banners" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'storefront-banners');
CREATE POLICY "auth delete storefront-banners" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'storefront-banners');
CREATE POLICY "public read storefront-banners" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'storefront-banners');