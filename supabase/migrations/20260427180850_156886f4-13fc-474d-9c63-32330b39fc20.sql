-- Tabela de clientes (cadastrados pela vitrine ou manualmente)
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL,
  user_id UUID NULL, -- null se cadastrado manualmente; preenchido se for um auth.users que se autocadastrou
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  email TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_shop ON public.customers(shop_id);
CREATE INDEX idx_customers_user ON public.customers(user_id);
CREATE UNIQUE INDEX idx_customers_shop_phone ON public.customers(shop_id, phone);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Confeiteiras (membros da loja) podem ler/gerenciar clientes da sua loja
CREATE POLICY "customers shop read"
ON public.customers FOR SELECT
TO authenticated
USING (public.is_shop_member(shop_id, auth.uid()));

CREATE POLICY "customers shop write"
ON public.customers FOR ALL
TO authenticated
USING (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner'::shop_role, 'manager'::shop_role]))
WITH CHECK (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner'::shop_role, 'manager'::shop_role]));

-- O próprio cliente (logado) pode ler e atualizar SEU registro
CREATE POLICY "customers self read"
ON public.customers FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "customers self update"
ON public.customers FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- O próprio cliente pode criar seu cadastro (uma vez), forçando user_id = auth.uid()
CREATE POLICY "customers self insert"
ON public.customers FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Trigger updated_at
CREATE TRIGGER customers_touch_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Liga encomendas a clientes
ALTER TABLE public.orders
  ADD COLUMN customer_id UUID NULL REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX idx_orders_customer ON public.orders(customer_id);
