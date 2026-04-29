DROP POLICY IF EXISTS "shop_visits_insert_anyone" ON public.shop_visits;
CREATE POLICY "shop_visits_insert_anyone"
  ON public.shop_visits FOR INSERT
  TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_visits.shop_id));