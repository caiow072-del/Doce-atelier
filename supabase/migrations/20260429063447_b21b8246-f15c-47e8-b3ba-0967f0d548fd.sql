CREATE TABLE IF NOT EXISTS public.shop_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  visited_at timestamptz NOT NULL DEFAULT now(),
  referer text,
  device text,
  session_key text
);

CREATE INDEX IF NOT EXISTS idx_shop_visits_shop_date ON public.shop_visits(shop_id, visited_at DESC);

ALTER TABLE public.shop_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_visits_insert_anyone" ON public.shop_visits;
CREATE POLICY "shop_visits_insert_anyone"
  ON public.shop_visits FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "shop_visits_select_members" ON public.shop_visits;
CREATE POLICY "shop_visits_select_members"
  ON public.shop_visits FOR SELECT
  TO authenticated
  USING (is_shop_member(shop_id, auth.uid()));