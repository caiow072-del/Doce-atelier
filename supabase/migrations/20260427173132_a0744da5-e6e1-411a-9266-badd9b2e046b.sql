ALTER TABLE public.recipe_ingredients
  DROP CONSTRAINT recipe_ingredients_ingredient_id_fkey,
  ADD CONSTRAINT recipe_ingredients_ingredient_id_fkey
    FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE;