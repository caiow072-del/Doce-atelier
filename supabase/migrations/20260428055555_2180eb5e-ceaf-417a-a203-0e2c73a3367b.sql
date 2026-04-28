-- Adiciona template e configuração de seções/overrides mobile na vitrine
ALTER TABLE public.shop_storefront
  ADD COLUMN IF NOT EXISTS template text NOT NULL DEFAULT 'romantic',
  ADD COLUMN IF NOT EXISTS sections_config jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mobile_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS about_text text,
  ADD COLUMN IF NOT EXISTS testimonials jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cta_label text,
  ADD COLUMN IF NOT EXISTS cta_link text;