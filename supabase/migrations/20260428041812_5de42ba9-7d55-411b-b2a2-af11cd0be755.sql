
-- =========== SHOPS: theme + target margin ===========
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS target_margin NUMERIC NOT NULL DEFAULT 0.30;

-- =========== RECIPES: catalog UX ===========
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS catalog_position INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS slice_price NUMERIC;

CREATE INDEX IF NOT EXISTS idx_recipes_catalog_pos ON public.recipes (shop_id, catalog_position);

-- =========== EVENTS: real recurrence ===========
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS weekday INT,        -- 0..6 (0 = Sunday)
  ADD COLUMN IF NOT EXISTS day_of_month INT;   -- 1..31

-- =========== EVENT_OCCURRENCES (per-date snapshot) ===========
CREATE TABLE IF NOT EXISTS public.event_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  closed_at TIMESTAMPTZ,
  payment_summary JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS idx_event_occurrences_event ON public.event_occurrences (event_id, occurrence_date);

ALTER TABLE public.event_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_occurrences read"
  ON public.event_occurrences FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_occurrences.event_id AND public.is_shop_member(e.shop_id, auth.uid())));

CREATE POLICY "event_occurrences write"
  ON public.event_occurrences FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_occurrences.event_id AND public.has_shop_role(e.shop_id, auth.uid(), ARRAY['owner'::shop_role, 'manager'::shop_role])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_occurrences.event_id AND public.has_shop_role(e.shop_id, auth.uid(), ARRAY['owner'::shop_role, 'manager'::shop_role])));

CREATE TRIGGER trg_event_occurrences_updated
  BEFORE UPDATE ON public.event_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========== EVENT_PRODUCTS: link to recipe + sale mode ===========
ALTER TABLE public.event_products
  ADD COLUMN IF NOT EXISTS sale_mode TEXT NOT NULL DEFAULT 'unit',  -- 'unit' (whole) | 'slice'
  ADD COLUMN IF NOT EXISTS batches NUMERIC NOT NULL DEFAULT 0;

-- =========== PDV_PRODUCTS: image ===========
ALTER TABLE public.pdv_products
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- =========== SHOP_STOREFRONT (visual editor) ===========
CREATE TABLE IF NOT EXISTS public.shop_storefront (
  shop_id UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  hero_title TEXT,
  hero_subtitle TEXT,
  banner_url TEXT,
  theme_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  promotions JSONB NOT NULL DEFAULT '[]'::jsonb,
  social JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_storefront ENABLE ROW LEVEL SECURITY;

CREATE POLICY "storefront public read"
  ON public.shop_storefront FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "storefront shop write"
  ON public.shop_storefront FOR ALL
  TO authenticated
  USING (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner'::shop_role, 'manager'::shop_role]))
  WITH CHECK (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner'::shop_role, 'manager'::shop_role]));

CREATE TRIGGER trg_shop_storefront_updated
  BEFORE UPDATE ON public.shop_storefront
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========== STORAGE BUCKETS ===========
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('product-images', 'product-images', true),
  ('recipe-images', 'recipe-images', true),
  ('storefront-banners', 'storefront-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for all 3 image buckets
CREATE POLICY "public read product-images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "public read recipe-images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'recipe-images');

CREATE POLICY "public read storefront-banners"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'storefront-banners');

-- Authenticated members of the shop can write to their shop folder
-- Convention: path = "{shop_id}/..."
CREATE POLICY "shop members write product-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_shop_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "shop members update product-images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.is_shop_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "shop members delete product-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.is_shop_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "shop members write recipe-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'recipe-images'
    AND public.is_shop_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "shop members update recipe-images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'recipe-images'
    AND public.is_shop_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "shop members delete recipe-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'recipe-images'
    AND public.is_shop_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "shop members write storefront-banners"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'storefront-banners'
    AND public.is_shop_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "shop members update storefront-banners"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'storefront-banners'
    AND public.is_shop_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "shop members delete storefront-banners"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'storefront-banners'
    AND public.is_shop_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );
