-- Add storefront-related columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_method text NOT NULL DEFAULT 'pickup',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS items jsonb;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_method_check
  CHECK (delivery_method IN ('pickup', 'delivery'));

ALTER TABLE public.orders
  ADD CONSTRAINT orders_source_check
  CHECK (source IN ('manual', 'storefront'));

-- Add source to customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

ALTER TABLE public.customers
  ADD CONSTRAINT customers_source_check
  CHECK (source IN ('manual', 'storefront'));

-- Public anon insert policy for storefront orders
-- Only allows insert when source='storefront' and status='orcamento'
CREATE POLICY "orders public storefront insert"
ON public.orders
FOR INSERT
TO anon
WITH CHECK (
  source = 'storefront'
  AND status = 'orcamento'
  AND deposit_paid = 0
  AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = orders.shop_id)
);

-- Public anon insert policy for storefront customers
CREATE POLICY "customers public storefront insert"
ON public.customers
FOR INSERT
TO anon
WITH CHECK (
  source = 'storefront'
  AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = customers.shop_id)
);

-- Allow anon to read recipes that are public (already exists, but ensure price/desc/img readable)
-- The existing "recipes public catalog" policy already covers SELECT on recipes where show_in_catalog = true.

-- Index for fast public lookups
CREATE INDEX IF NOT EXISTS idx_recipes_shop_catalog ON public.recipes(shop_id) WHERE show_in_catalog = true;
CREATE INDEX IF NOT EXISTS idx_orders_shop_status ON public.orders(shop_id, status);