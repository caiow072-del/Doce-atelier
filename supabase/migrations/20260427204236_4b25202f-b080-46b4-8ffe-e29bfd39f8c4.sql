-- 1) event_products
CREATE TABLE public.event_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  recipe_id UUID,
  name TEXT NOT NULL,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  planned_qty INTEGER NOT NULL DEFAULT 0,
  sold_qty INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_products_event ON public.event_products(event_id);

ALTER TABLE public.event_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_products read"
  ON public.event_products FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_products.event_id AND public.is_shop_member(e.shop_id, auth.uid())));

CREATE POLICY "event_products write"
  ON public.event_products FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_products.event_id AND public.has_shop_role(e.shop_id, auth.uid(), ARRAY['owner'::shop_role,'manager'::shop_role])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_products.event_id AND public.has_shop_role(e.shop_id, auth.uid(), ARRAY['owner'::shop_role,'manager'::shop_role])));

CREATE TRIGGER event_products_touch
  BEFORE UPDATE ON public.event_products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) events: recurrence + closing
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS recurrence TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_until DATE,
  ADD COLUMN IF NOT EXISTS parent_event_id UUID,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_summary JSONB;

CREATE INDEX IF NOT EXISTS idx_events_parent ON public.events(parent_event_id);
CREATE INDEX IF NOT EXISTS idx_events_closed ON public.events(closed_at);

-- 3) sales: event + payment + cart grouping
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS event_id UUID,
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS cart_id UUID;

CREATE INDEX IF NOT EXISTS idx_sales_event ON public.sales(event_id);
CREATE INDEX IF NOT EXISTS idx_sales_cart ON public.sales(cart_id);
CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON public.sales(sold_at);