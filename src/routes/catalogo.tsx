import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Globe, ExternalLink, Eye, EyeOff, ChevronUp, ChevronDown,
  Tag, Sparkles, Calendar, ShoppingBag, Cake, Copy, Check,
} from "lucide-react";
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
  category: string | null;
  catalog_position: number;
};

type EventLite = {
  id: string;
  name: string;
  date: string;
  location: string | null;
};

function CatalogoPage() {
  const { currentShop } = useAuth();
  const [tab, setTab] = useState<"loja" | "eventos">("loja");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [events, setEvents] = useState<EventLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [copied, setCopied] = useState<string | null>(null);
  const slug = currentShop?.shops.slug;

  useEffect(() => {
    if (!currentShop) return;
    setLoading(true);
    Promise.all([
      supabase
        .from("recipes")
        .select("id, name, description, image_url, public_price, show_in_catalog, category, catalog_position")
        .eq("shop_id", currentShop.shop_id)
        .order("catalog_position", { ascending: true })
        .order("name"),
      supabase
        .from("events")
        .select("id, name, date, location")
        .eq("shop_id", currentShop.shop_id)
        .order("date", { ascending: false })
        .limit(50),
    ]).then(([r, e]) => {
      if (r.error) toast.error("Erro ao carregar receitas");
      setRecipes((r.data ?? []) as Recipe[]);
      setEvents((e.data ?? []) as EventLite[]);
      setLoading(false);
    });
  }, [currentShop]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((r) => r.category && set.add(r.category));
    return Array.from(set).sort();
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    if (filterCat === "all") return recipes;
    if (filterCat === "none") return recipes.filter((r) => !r.category);
    return recipes.filter((r) => r.category === filterCat);
  }, [recipes, filterCat]);

  const toggle = async (r: Recipe) => {
    const { error } = await supabase
      .from("recipes")
      .update({ show_in_catalog: !r.show_in_catalog })
      .eq("id", r.id);
    if (error) return toast.error("Erro");
    setRecipes((prev) => prev.map((x) => (x.id === r.id ? { ...x, show_in_catalog: !x.show_in_catalog } : x)));
  };

  const updatePrice = async (r: Recipe, value: number) => {
    const { error } = await supabase.from("recipes").update({ public_price: value }).eq("id", r.id);
    if (error) return toast.error("Erro");
    setRecipes((prev) => prev.map((x) => (x.id === r.id ? { ...x, public_price: value } : x)));
  };
  const updateCategory = async (r: Recipe, value: string | null) => {
    const { error } = await supabase.from("recipes").update({ category: value }).eq("id", r.id);
    if (error) return toast.error("Erro");
    setRecipes((prev) => prev.map((x) => (x.id === r.id ? { ...x, category: value } : x)));
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...recipes];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    // re-sequenciar posições
    const updated = next.map((r, i) => ({ ...r, catalog_position: i }));
    setRecipes(updated);
    // persistir as duas trocadas
    await Promise.all([
      supabase.from("recipes").update({ catalog_position: idx }).eq("id", updated[idx].id),
      supabase.from("recipes").update({ catalog_position: target }).eq("id", updated[target].id),
    ]);
  };

  const visible = recipes.filter((r) => r.show_in_catalog).length;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const lojaUrl = slug ? `${origin}/loja/${slug}` : "";

  const copy = async (url: string, key: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Vitrine pública" title="Catálogo" subtitle="Tudo que aparece na sua loja virtual." />

      {/* Tabs */}
      <div className="card-soft inline-flex gap-1 p-1">
        <button
          onClick={() => setTab("loja")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm transition ${tab === "loja" ? "bg-mauve text-cream" : "text-mauve hover:bg-rose/10"}`}
        >
          <ShoppingBag className="h-4 w-4" /> Vitrine da loja
        </button>
        <button
          onClick={() => setTab("eventos")}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm transition ${tab === "eventos" ? "bg-mauve text-cream" : "text-mauve hover:bg-rose/10"}`}
        >
          <Calendar className="h-4 w-4" /> Vitrines de eventos
          <span className="rounded-full bg-rose/30 px-1.5 text-[10px]">{events.length}</span>
        </button>
      </div>

      {tab === "loja" && (
        <>
          <div className="card-soft p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blush to-rose">
                  <Globe className="h-6 w-6 text-mauve" strokeWidth={1.4} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-mauve font-medium">{visible} {visible === 1 ? "produto visível" : "produtos visíveis"}</p>
                  <p className="text-xs text-muted-foreground break-all">{lojaUrl || "Sem loja selecionada"}</p>
                </div>
              </div>
              {lojaUrl && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => copy(lojaUrl, "loja")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-xs text-mauve hover:border-rose/50"
                  >
                    {copied === "loja" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    Copiar link
                  </button>
                  <Link
                    to="/vitrine"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-xs text-mauve hover:border-rose/50"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-rose" /> Editar vitrine
                  </Link>
                  <a
                    href={lojaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-4 py-2 text-xs text-cream hover:opacity-90"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Abrir
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Filtro de categoria */}
          {categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-mauve/60" />
              {(["all", ...categories, "none"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setFilterCat(c)}
                  className={`rounded-full px-3 py-1 text-[11px] transition ${filterCat === c ? "bg-mauve text-cream" : "bg-white border border-border text-mauve hover:border-rose/50"}`}
                >
                  {c === "all" ? "Todos" : c === "none" ? "Sem categoria" : c}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="card-soft p-10 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : recipes.length === 0 ? (
            <div className="card-soft p-10 text-center text-sm text-muted-foreground">
              Cadastre receitas primeiro para montar seu catálogo.
            </div>
          ) : (
            <ul className="card-soft divide-y divide-border/60 overflow-hidden">
              {filteredRecipes.map((r) => {
                const realIdx = recipes.findIndex((x) => x.id === r.id);
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="flex flex-col">
                      <button
                        disabled={realIdx === 0}
                        onClick={() => move(realIdx, -1)}
                        className="grid h-5 w-5 place-items-center rounded text-mauve/70 hover:bg-rose/20 disabled:opacity-25"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        disabled={realIdx === recipes.length - 1}
                        onClick={() => move(realIdx, 1)}
                        className="grid h-5 w-5 place-items-center rounded text-mauve/70 hover:bg-rose/20 disabled:opacity-25"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {r.image_url ? (
                      <img src={r.image_url} alt={r.name} className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-blush"><Cake className="h-4 w-4 text-mauve/50" /></div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-mauve truncate">{r.name}</p>
                      {r.description && <p className="text-[11px] text-muted-foreground line-clamp-1">{r.description}</p>}
                    </div>

                    <input
                      list="cat-suggestions"
                      defaultValue={r.category ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (r.category ?? "")) updateCategory(r, v || null);
                      }}
                      placeholder="Categoria"
                      className="w-28 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                    />
                    <input
                      type="number"
                      defaultValue={r.public_price ?? ""}
                      onBlur={(e) => {
                        const v = Number(e.target.value) || 0;
                        if (v !== (r.public_price ?? 0)) updatePrice(r, v);
                      }}
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
                  </li>
                );
              })}
            </ul>
          )}
          <datalist id="cat-suggestions">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </>
      )}

      {tab === "eventos" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Cada evento gera uma vitrine pública dedicada com seus produtos planejados. Compartilhe o link específico antes da data.
          </p>
          {loading ? (
            <div className="card-soft p-10 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : events.length === 0 ? (
            <div className="card-soft p-10 text-center text-sm text-muted-foreground">
              Nenhum evento cadastrado ainda. <Link to="/eventos" className="underline text-mauve">Criar evento</Link>.
            </div>
          ) : (
            <ul className="card-soft divide-y divide-border/60 overflow-hidden">
              {events.map((ev) => {
                const url = slug ? `${origin}/loja/${slug}/e/${ev.id}` : "";
                const date = new Date(ev.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                return (
                  <li key={ev.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blush to-rose">
                      <Calendar className="h-4 w-4 text-mauve" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-mauve truncate">{ev.name}</p>
                      <p className="text-[11px] text-muted-foreground">{date} {ev.location ? `· ${ev.location}` : ""}</p>
                    </div>
                    {url && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => copy(url, ev.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] text-mauve hover:border-rose/50"
                        >
                          {copied === ev.id ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                          Copiar
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-mauve px-2.5 py-1.5 text-[11px] text-cream hover:opacity-90"
                        >
                          <ExternalLink className="h-3 w-3" /> Abrir
                        </a>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
