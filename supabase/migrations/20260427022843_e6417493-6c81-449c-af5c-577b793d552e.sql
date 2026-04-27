
-- ============ Enum de papéis ============
CREATE TYPE public.shop_role AS ENUM ('owner', 'manager', 'staff');

-- ============ Profiles ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ Shops ============
CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  whatsapp TEXT,
  description TEXT,
  logo_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_shops_slug ON public.shops(slug);

-- ============ Shop members ============
CREATE TABLE public.shop_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.shop_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, user_id)
);
CREATE INDEX idx_shop_members_user ON public.shop_members(user_id);
CREATE INDEX idx_shop_members_shop ON public.shop_members(shop_id);

-- ============ Helper: is user member of shop? (security definer evita recursão de RLS) ============
CREATE OR REPLACE FUNCTION public.is_shop_member(_shop_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_members
    WHERE shop_id = _shop_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_shop_role(_shop_id UUID, _user_id UUID, _roles public.shop_role[])
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_members
    WHERE shop_id = _shop_id AND user_id = _user_id AND role = ANY(_roles)
  );
$$;

-- ============ Ingredients ============
CREATE TABLE public.ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('g','kg','ml','L','un')),
  price_paid NUMERIC(10,2) NOT NULL CHECK (price_paid >= 0),
  package_qty NUMERIC(10,3) NOT NULL CHECK (package_qty > 0),
  stock_qty NUMERIC(10,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ingredients_shop ON public.ingredients(shop_id);

-- ============ Recipes ============
CREATE TABLE public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  servings INTEGER NOT NULL CHECK (servings > 0),
  labor_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  packaging_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  target_margin NUMERIC(4,3) NOT NULL DEFAULT 0.30 CHECK (target_margin >= 0 AND target_margin < 1),
  waste_pct NUMERIC(4,3) NOT NULL DEFAULT 0.10 CHECK (waste_pct >= 0 AND waste_pct < 1),
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recipes_shop ON public.recipes(shop_id);

CREATE TABLE public.recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  quantity NUMERIC(10,3) NOT NULL CHECK (quantity > 0),
  UNIQUE (recipe_id, ingredient_id)
);
CREATE INDEX idx_recipe_ing_recipe ON public.recipe_ingredients(recipe_id);

-- ============ updated_at triggers ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER shops_touch BEFORE UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER ingredients_touch BEFORE UPDATE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER recipes_touch BEFORE UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Auto-criar profile + loja ao cadastrar ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_shop_id UUID;
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
  display_name TEXT;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, display_name);

  -- slug a partir do nome ou email
  base_slug := lower(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'shop_name', display_name || ' confeitaria'), '[^a-z0-9]+', '-', 'gi'));
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN base_slug := 'loja'; END IF;
  final_slug := base_slug;

  WHILE EXISTS (SELECT 1 FROM public.shops WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  INSERT INTO public.shops (name, slug, created_by)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'shop_name', display_name || ' Confeitaria'), final_slug, NEW.id)
  RETURNING id INTO new_shop_id;

  INSERT INTO public.shop_members (shop_id, user_id, role)
  VALUES (new_shop_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS ============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- Profiles: dono lê e atualiza
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Shops: membros leem; vitrine pública é leitura anônima limitada (separada abaixo)
CREATE POLICY "shops members read" ON public.shops FOR SELECT TO authenticated USING (public.is_shop_member(id, auth.uid()));
CREATE POLICY "shops public catalog read" ON public.shops FOR SELECT TO anon USING (true);
CREATE POLICY "shops owner update" ON public.shops FOR UPDATE TO authenticated USING (public.has_shop_role(id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]));

-- Shop members: vê seus próprios e os da mesma loja
CREATE POLICY "members self read" ON public.shop_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_shop_member(shop_id, auth.uid()));
CREATE POLICY "members owner manage" ON public.shop_members FOR ALL TO authenticated
  USING (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner']::public.shop_role[]))
  WITH CHECK (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner']::public.shop_role[]));

-- Ingredients: membros leem, owner/manager escrevem
CREATE POLICY "ingredients shop read" ON public.ingredients FOR SELECT TO authenticated USING (public.is_shop_member(shop_id, auth.uid()));
CREATE POLICY "ingredients shop write" ON public.ingredients FOR ALL TO authenticated
  USING (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]))
  WITH CHECK (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]));

-- Recipes: membros leem, owner/manager escrevem
CREATE POLICY "recipes shop read" ON public.recipes FOR SELECT TO authenticated USING (public.is_shop_member(shop_id, auth.uid()));
CREATE POLICY "recipes shop write" ON public.recipes FOR ALL TO authenticated
  USING (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]))
  WITH CHECK (public.has_shop_role(shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[]));

-- Recipe ingredients: segue a receita
CREATE POLICY "recipe_ing read" ON public.recipe_ingredients FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND public.is_shop_member(r.shop_id, auth.uid()))
);
CREATE POLICY "recipe_ing write" ON public.recipe_ingredients FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND public.has_shop_role(r.shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND public.has_shop_role(r.shop_id, auth.uid(), ARRAY['owner','manager']::public.shop_role[])));
