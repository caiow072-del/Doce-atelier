
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, public;
-- helpers podem continuar EXECUTE (são usadas em policies via auth.uid()) mas removemos do anon
REVOKE EXECUTE ON FUNCTION public.is_shop_member(UUID, UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_shop_role(UUID, UUID, public.shop_role[]) FROM anon, public;
