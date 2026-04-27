import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Globe, ExternalLink, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo — Cakes Manager" },
      { name: "description", content: "Vitrine pública da sua confeitaria." },
    ],
  }),
  component: CatalogoPage,
});

type Recipe = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  public_price: number | null;
  show_in_catalog: boolean;
};

function CatalogoPage() {
  const { currentShop } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const slug = currentShop?.shops.slug;

  useEffect(() => {
    if (!currentShop) return;
    setLoading(true);
    supabase
      .from("recipes")
      .select("id, name, description, image_url, public_price, show_in_catalog")
      .eq("shop_id", currentShop.shop_id)
      .order("name")
      .then(({ data, error }) => {
        if (error) toast.error("Erro ao carregar receitas");
        setRecipes((data ?? []) as Recipe[]);
        setLoading(false);
      });
  }, [currentShop]);

  const toggle = async (r: Recipe) => {
    const { error } = await supabase
      .from("recipes")
      .update({ show_in_catalog: !r.show_in_catalog })
      .eq("id", r.id);
    if (error) return toast.error("Erro");
    setRecipes((prev) => prev.map((x) => (x.id === r.id ? { ...x, show_in_catalog: !x.show_in_catalog } : x)));
  };

  const updatePrice = async (r: Recipe, price: number) => {
    const { error } = await supabase.from("recipes").update({ public_price: price }).eq("id", r.id);
    if (error) return toast.error("Erro");
    setRecipes((prev) => prev.map((x) => (x.id === r.id ? { ...x, public_price: price } : x)));
  };

  const visible = recipes.filter((r) => r.show_in_catalog).length;
  const publicUrl = slug ? `${typeof window !== "undefined" ? window.location.origin : ""}/loja/${slug}` : "";

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Vitrine pública" title="Catálogo da loja" subtitle="Escolha quais bolos aparecem para seus clientes." />

      <div className="card-soft p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blush to-rose">
              <Globe className="h-6 w-6 text-mauve" strokeWidth={1.4} />
            </div>
            <div>
              <p className="text-sm text-mauve font-medium">{visible} {visible === 1 ? "produto visível" : "produtos visíveis"}</p>
              <p className="text-xs text-muted-foreground break-all">{publicUrl || "Sem loja selecionada"}</p>
            </div>
          </div>
          {publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-4 py-2 text-sm text-cream hover:opacity-90"
            >
              <ExternalLink className="h-4 w-4" /> Abrir vitrine
            </a>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card-soft p-10 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : recipes.length === 0 ? (
        <div className="card-soft p-10 text-center text-sm text-muted-foreground">
          Cadastre receitas primeiro para montar seu catálogo.
        </div>
      ) : (
        <ul className="card-soft divide-y divide-border/60 overflow-hidden">
          {recipes.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-mauve truncate">{r.name}</p>
                {r.description && <p className="text-[11px] text-muted-foreground line-clamp-1">{r.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Preço público</label>
                <input
                  type="number"
                  defaultValue={r.public_price ?? ""}
                  onBlur={(e) => updatePrice(r, Number(e.target.value) || 0)}
                  className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-sm text-right"
                  placeholder="R$"
                />
                <button
                  onClick={() => toggle(r)}
                  className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs ${
                    r.show_in_catalog ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.show_in_catalog ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {r.show_in_catalog ? "Visível" : "Oculto"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
