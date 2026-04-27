-- Lock down SECURITY DEFINER helpers from anon role (they're for RLS internals only)
REVOKE EXECUTE ON FUNCTION public.is_shop_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_shop_role(uuid, uuid, shop_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_shop_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_shop_role(uuid, uuid, shop_role[]) TO authenticated;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_orders_shop_status ON public.orders(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_shop_source ON public.orders(shop_id, source) WHERE source = 'storefront';
CREATE INDEX IF NOT EXISTS idx_customers_shop_phone ON public.customers(shop_id, phone);
CREATE INDEX IF NOT EXISTS idx_sales_event ON public.sales(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_shop_sold_at ON public.sales(shop_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_products_event ON public.event_products(event_id, position);
CREATE INDEX IF NOT EXISTS idx_recipes_shop_catalog ON public.recipes(shop_id, show_in_catalog);
CREATE INDEX IF NOT EXISTS idx_events_shop_date ON public.events(shop_id, date DESC);