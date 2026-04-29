
-- =========================================================
-- 1. PUBLIC VIEWS (replace anon SELECT on shops/recipes)
-- =========================================================

-- shops_public: only fields needed by the storefront
CREATE OR REPLACE VIEW public.shops_public
WITH (security_invoker = true) AS
SELECT id, name, slug, whatsapp, description, logo_url, theme
FROM public.shops;

GRANT SELECT ON public.shops_public TO anon, authenticated;

-- recipes_public: only fields needed by the storefront / catalog
CREATE OR REPLACE VIEW public.recipes_public
WITH (security_invoker = true) AS
SELECT
  id, shop_id, name, description, image_url,
  public_price, promo_price, servings, category,
  is_featured, show_in_catalog, catalog_position
FROM public.recipes
WHERE show_in_catalog = true;

GRANT SELECT ON public.recipes_public TO anon, authenticated;

-- Drop anon-facing policies on base tables
DROP POLICY IF EXISTS "shops public catalog read" ON public.shops;
DROP POLICY IF EXISTS "recipes public catalog" ON public.recipes;

-- The views use security_invoker, so they need a policy that lets anon
-- read the underlying rows ONLY for the safe-projection cases.
CREATE POLICY "shops anon read for public view"
  ON public.shops
  FOR SELECT
  TO anon
  USING (true);  -- still all rows, but only safe columns are exposed via shops_public; tabela direta agora não tem GRANT SELECT explícito para anon

-- Revoke direct table SELECT from anon (they must go through the view)
REVOKE SELECT ON public.shops FROM anon;
REVOKE SELECT ON public.recipes FROM anon;

-- Recipes: anon needs to read only catalog rows for the view
CREATE POLICY "recipes anon read for public view"
  ON public.recipes
  FOR SELECT
  TO anon
  USING (show_in_catalog = true);

-- =========================================================
-- 2. STOREFRONT ORDER RPC (replace anon insert into customers/orders)
-- =========================================================

CREATE OR REPLACE FUNCTION public.create_storefront_order(
  p_shop_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_delivery_method text,
  p_delivery_address text,
  p_delivery_at timestamptz,
  p_description text,
  p_total_price numeric,
  p_notes text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_order_id uuid;
  v_phone text := trim(p_customer_phone);
  v_name  text := trim(p_customer_name);
BEGIN
  -- Basic validation
  IF p_shop_id IS NULL THEN RAISE EXCEPTION 'shop_id required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'shop not found';
  END IF;
  IF v_name = '' OR length(v_name) > 120 THEN RAISE EXCEPTION 'invalid name'; END IF;
  IF v_phone = '' OR length(v_phone) > 30 THEN RAISE EXCEPTION 'invalid phone'; END IF;
  IF p_delivery_method NOT IN ('pickup','delivery') THEN RAISE EXCEPTION 'invalid delivery method'; END IF;
  IF p_total_price IS NULL OR p_total_price < 0 OR p_total_price > 1000000 THEN RAISE EXCEPTION 'invalid total'; END IF;
  IF p_delivery_at IS NULL OR p_delivery_at < now() - interval '1 minute' THEN RAISE EXCEPTION 'invalid delivery date'; END IF;

  -- Reuse customer by (shop_id, phone) when possible
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

REVOKE ALL ON FUNCTION public.create_storefront_order(
  uuid, text, text, text, text, text, timestamptz, text, numeric, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_storefront_order(
  uuid, text, text, text, text, text, timestamptz, text, numeric, text, jsonb
) TO anon, authenticated;

-- Drop anon insert policies on customers/orders (RPC replaces them)
DROP POLICY IF EXISTS "customers public storefront insert" ON public.customers;
DROP POLICY IF EXISTS "orders public storefront insert" ON public.orders;

-- =========================================================
-- 3. LOCK DOWN SECURITY DEFINER HELPERS (anon should not call them)
-- =========================================================

REVOKE EXECUTE ON FUNCTION public.is_shop_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_shop_role(uuid, uuid, public.shop_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_shop_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_shop_role(uuid, uuid, public.shop_role[]) TO authenticated;

-- =========================================================
-- 4. STORAGE: prevent bucket listing on public buckets
-- =========================================================
-- We keep individual file access by direct URL (public bucket = files served via CDN),
-- but block the SELECT-all listing policy that was created automatically.

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd = 'SELECT'
      AND (qual LIKE '%product-images%'
        OR qual LIKE '%recipe-images%'
        OR qual LIKE '%storefront-banners%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;
