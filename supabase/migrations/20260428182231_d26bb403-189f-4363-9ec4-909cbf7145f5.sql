-- Add featured flag and per-recipe promo price for catalog editing
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_price numeric;

CREATE INDEX IF NOT EXISTS idx_recipes_featured ON public.recipes (shop_id, is_featured) WHERE is_featured = true;