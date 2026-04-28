// Catálogo redesenhado — vitrine da loja + vitrines de eventos
// Cards visuais, modal de edição completo, destaque, promoção, upload de
// imagem, copiar produtos entre vitrine da loja e vitrine de eventos.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Globe, ExternalLink, Eye, EyeOff, ChevronUp, ChevronDown,
  Tag, Sparkles, Calendar, ShoppingBag, Cake, Copy, Check, Plus,
  Pencil, Trash2, Star, Image as ImageIcon, X, QrCode, Upload,
  ArrowLeftRight, Loader2, Search,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { uploadShopImage } from "@/lib/upload";
import { toast } from "sonner";

export const Route = createFileRoute("/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo — Cakes Manager" },
      { name: "description", content: "Gerencie sua vitrine pública e vitrines de eventos." },
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
  promo_price: number | null;
  show_in_catalog: boolean;
  is_featured: boolean;
  category: string | null;
  catalog_position: number;
};

type EventLite = {
  id: string;
  name: string;
  date: string;
  location: string | null;
};

type EventProduct = {
  id: string;
  event_id: string;
  recipe_id: string | null;
  name: string;
  description: string | null;
  category: string | null;
  unit_price: number;
  promo_price: number | null;
  planned_qty: number;
  sold_qty: number;
  image_url: string | null;
  position: number;
  sale_mode: string;
  batches: number;
  is_featured: boolean;
};

const brl = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function CatalogoPage() {
  const { currentShop } = useAuth();
  const [tab, setTab] = useState<"loja" | "eventos">("loja");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [events, setEvents] = useState<EventLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [qrTarget, setQrTarget] = useState<{ url: string; label: string } | null>(null);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [creating, setCreating] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const slug = currentShop?.shops.slug;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const lojaUrl = slug ? `${origin}/loja/${slug}` : "";

  const reload = async () => {
    if (!currentShop) return;
    setLoading(true);
    const [r, e] = await Promise.all([
      supabase
        .from("recipes")
        .select("id, name, description, image_url, public_price, promo_price, show_in_catalog, is_featured, category, catalog_position")
        .eq("shop_id", currentShop.shop_id)
        .order("catalog_position", { ascending: true })
        .order("name"),
      supabase
        .from("events")
        .select("id, name, date, location")
        .eq("shop_id", currentShop.shop_id)
        .order("date", { ascending: false })
        .limit(100),
    ]);
    if (r.error) toast.error("Erro ao carregar produtos");
    setRecipes((r.data ?? []) as Recipe[]);
    setEvents((e.data ?? []) as EventLite[]);
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [currentShop?.shop_id]);

  // Auto-expandir o primeiro evento ao abrir a aba quando ainda não houver seleção
  useEffect(() => {
    if (tab === "eventos" && !expandedEvent && events.length > 0) {
      setExpandedEvent(events[0].id);
    }
  }, [tab, events, expandedEvent]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((r) => r.category && set.add(r.category));
    return Array.from(set).sort();
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes.filter((r) => {
      if (filterCat === "featured" && !r.is_featured) return false;
      else if (filterCat === "hidden" && r.show_in_catalog) return false;
      else if (filterCat === "none" && r.category) return false;
      else if (filterCat !== "all" && filterCat !== "featured" && filterCat !== "hidden" && filterCat !== "none" && r.category !== filterCat) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [recipes, filterCat, search]);

  const visible = recipes.filter((r) => r.show_in_catalog).length;
  const featured = recipes.filter((r) => r.is_featured).length;

  const move = async (id: string, dir: -1 | 1) => {
    const idx = recipes.findIndex((r) => r.id === id);
    const target = idx + dir;
    if (target < 0 || target >= recipes.length) return;
    const next = [...recipes];
    [next[idx], next[target]] = [next[target], next[idx]];
    const updated = next.map((r, i) => ({ ...r, catalog_position: i }));
    setRecipes(updated);
    await Promise.all([
      supabase.from("recipes").update({ catalog_position: idx }).eq("id", updated[idx].id),
      supabase.from("recipes").update({ catalog_position: target }).eq("id", updated[target].id),
    ]);
  };

  const quickToggle = async (r: Recipe, key: "show_in_catalog" | "is_featured") => {
    const next = !r[key];
    setRecipes((prev) => prev.map((x) => (x.id === r.id ? { ...x, [key]: next } : x)));
    const { error } = await supabase.from("recipes").update({ [key]: next } as any).eq("id", r.id);
    if (error) {
      toast.error("Erro ao salvar");
      setRecipes((prev) => prev.map((x) => (x.id === r.id ? { ...x, [key]: !next } : x)));
    }
  };

  const removeRecipe = async (r: Recipe) => {
    if (!confirm(`Remover "${r.name}" do catálogo? A receita será apagada.`)) return;
    const { error } = await supabase.from("recipes").delete().eq("id", r.id);
    if (error) return toast.error("Erro ao remover");
    setRecipes((prev) => prev.filter((x) => x.id !== r.id));
    toast.success("Removido");
  };

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
      <PageHeader
        eyebrow="Vitrine pública"
        title="Catálogo"
        subtitle="Gerencie os produtos que aparecem na sua loja virtual e nas vitrines de eventos."
      />

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="card-soft inline-flex gap-1 p-1">
          <button
            onClick={() => setTab("loja")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm transition ${tab === "loja" ? "bg-mauve text-cream" : "text-mauve hover:bg-rose/10"}`}
          >
            <ShoppingBag className="h-4 w-4" /> Vitrine da loja
            <span className="rounded-full bg-rose/30 px-1.5 text-[10px]">{visible}</span>
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
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-4 py-2 text-sm text-cream hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Novo produto
          </button>
        )}
      </div>

      {tab === "loja" && (
        <>
          {/* Barra compacta de status + ações */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-white px-3 py-2 text-sm">
            <div className="flex items-center gap-2 text-mauve">
              <Globe className="h-4 w-4 text-rose" />
              <span className="font-medium">{visible}</span>
              <span className="text-mauve/60">{visible === 1 ? "produto visível" : "produtos visíveis"}</span>
              {featured > 0 && (
                <span className="hidden sm:inline text-xs text-mauve/50">· {featured} em destaque</span>
              )}
            </div>
            {lojaUrl && (
              <div className="flex flex-wrap gap-1">
                <button onClick={() => copy(lojaUrl, "loja")} title="Copiar link da vitrine"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white text-mauve hover:border-rose/50">
                  {copied === "loja" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => setQrTarget({ url: lojaUrl, label: "Vitrine da loja" })} title="QR Code"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white text-mauve hover:border-rose/50">
                  <QrCode className="h-3.5 w-3.5" />
                </button>
                <Link to="/vitrine" title="Personalizar vitrine"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 text-xs text-mauve hover:border-rose/50">
                  <Sparkles className="h-3.5 w-3.5 text-rose" /> Personalizar vitrine
                </Link>
                <a href={lojaUrl} target="_blank" rel="noreferrer" title="Abrir vitrine"
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-mauve px-2.5 text-xs text-cream hover:opacity-90">
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir
                </a>
              </div>
            )}
          </div>

          {/* Filtros */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mauve/50" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full rounded-xl border border-border bg-white py-2 pl-9 pr-3 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-mauve/60" />
              <FilterPill active={filterCat === "all"} onClick={() => setFilterCat("all")}>Todos</FilterPill>
              <FilterPill active={filterCat === "featured"} onClick={() => setFilterCat("featured")}>
                <Star className="h-3 w-3" /> Destaques
              </FilterPill>
              <FilterPill active={filterCat === "hidden"} onClick={() => setFilterCat("hidden")}>Ocultos</FilterPill>
              {categories.map((c) => (
                <FilterPill key={c} active={filterCat === c} onClick={() => setFilterCat(c)}>{c}</FilterPill>
              ))}
              {categories.length > 0 && (
                <FilterPill active={filterCat === "none"} onClick={() => setFilterCat("none")}>Sem categoria</FilterPill>
              )}
            </div>
          </div>

          {/* Grid de produtos */}
          {loading ? (
            <div className="card-soft p-10 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Carregando...
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div className="card-soft p-10 text-center text-sm text-muted-foreground">
              {recipes.length === 0
                ? <>Nenhum produto ainda. <button onClick={() => setCreating(true)} className="underline text-mauve">Criar o primeiro</button>.</>
                : "Nenhum produto com esses filtros."}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filteredRecipes.map((r) => (
                <ProductCard
                  key={r.id} r={r}
                  onEdit={() => setEditing(r)}
                  onToggleVisible={() => quickToggle(r, "show_in_catalog")}
                  onToggleFeatured={() => quickToggle(r, "is_featured")}
                  onDelete={() => removeRecipe(r)}
                  onMoveUp={() => move(r.id, -1)}
                  onMoveDown={() => move(r.id, 1)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "eventos" && (
        <EventsTab
          events={events}
          loading={loading}
          slug={slug}
          origin={origin}
          recipes={recipes}
          expandedEvent={expandedEvent}
          setExpandedEvent={setExpandedEvent}
          copy={copy}
          copied={copied}
          openQr={(url, label) => setQrTarget({ url, label })}
          shopId={currentShop?.shop_id}
        />
      )}

      {/* Modal editar / criar */}
      {(editing || creating) && currentShop && (
        <ProductEditorModal
          recipe={editing}
          shopId={currentShop.shop_id}
          categories={categories}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); reload(); }}
        />
      )}

      {/* Modal QR */}
      {qrTarget && <QrModal target={qrTarget} onClose={() => setQrTarget(null)} />}
    </div>
  );
}

/* ---------- Helpers ---------- */

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] transition ${active ? "bg-mauve text-cream" : "bg-white border border-border text-mauve hover:border-rose/50"}`}>
      {children}
    </button>
  );
}

function ProductCard({ r, onEdit, onToggleVisible, onToggleFeatured, onDelete, onMoveUp, onMoveDown }: {
  r: Recipe;
  onEdit: () => void; onToggleVisible: () => void; onToggleFeatured: () => void;
  onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  const hasPromo = r.promo_price != null && r.public_price != null && r.promo_price < r.public_price;
  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md ${r.is_featured ? "border-rose ring-1 ring-rose/30" : "border-border/60"} ${!r.show_in_catalog ? "opacity-60" : ""}`}>
      {/* Imagem */}
      <button onClick={onEdit} className="relative aspect-square overflow-hidden bg-blush">
        {r.image_url ? (
          <img src={r.image_url} alt={r.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="grid h-full w-full place-items-center text-mauve/40">
            <ImageIcon className="h-7 w-7" strokeWidth={1.2} />
          </div>
        )}
        {hasPromo && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-rose px-1.5 py-0.5 text-[9px] font-semibold text-mauve shadow">PROMO</span>
        )}
        {r.is_featured && (
          <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-rose text-mauve shadow">
            <Star className="h-3 w-3 fill-current" />
          </span>
        )}
      </button>

      {/* Conteúdo */}
      <div className="flex flex-1 flex-col gap-0.5 px-2 py-1.5">
        <h3 className="text-xs font-medium text-mauve line-clamp-1">{r.name}</h3>
        {r.category && <span className="text-[9px] text-mauve/50 line-clamp-1">{r.category}</span>}
        <div className="mt-auto flex items-baseline gap-1 pt-1">
          {hasPromo ? (
            <>
              <span className="text-[10px] text-mauve/50 line-through">{brl(r.public_price)}</span>
              <span className="text-xs font-semibold text-rose">{brl(r.promo_price)}</span>
            </>
          ) : (
            <span className="text-xs font-semibold text-mauve">{brl(r.public_price)}</span>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center justify-between border-t border-border/50 bg-cream/30 px-1 py-0.5">
        <div className="flex">
          <IconBtn label="Subir" onClick={onMoveUp}><ChevronUp className="h-3 w-3" /></IconBtn>
          <IconBtn label="Descer" onClick={onMoveDown}><ChevronDown className="h-3 w-3" /></IconBtn>
        </div>
        <div className="flex">
          <IconBtn label={r.is_featured ? "Remover destaque" : "Destacar"} onClick={onToggleFeatured} active={r.is_featured}>
            <Star className={`h-3 w-3 ${r.is_featured ? "fill-current" : ""}`} />
          </IconBtn>
          <IconBtn label={r.show_in_catalog ? "Ocultar" : "Mostrar"} onClick={onToggleVisible} active={r.show_in_catalog}>
            {r.show_in_catalog ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </IconBtn>
          <IconBtn label="Editar" onClick={onEdit}><Pencil className="h-3 w-3" /></IconBtn>
          <IconBtn label="Remover" onClick={onDelete} danger><Trash2 className="h-3 w-3" /></IconBtn>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, label, active, danger }: {
  children: React.ReactNode; onClick: () => void; label: string; active?: boolean; danger?: boolean;
}) {
  return (
    <button title={label} onClick={onClick}
      className={`grid h-6 w-6 place-items-center rounded-md transition ${
        danger ? "text-mauve/60 hover:bg-red-100 hover:text-red-600"
        : active ? "bg-rose/30 text-mauve" : "text-mauve/70 hover:bg-rose/20"
      }`}>
      {children}
    </button>
  );
}

/* ---------- Modal de edição/criação de produto ---------- */

function ProductEditorModal({ recipe, shopId, categories, onClose, onSaved }: {
  recipe: Recipe | null;
  shopId: string;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !recipe;
  const [form, setForm] = useState<Partial<Recipe>>(recipe ?? {
    name: "", description: "", image_url: null,
    public_price: null, promo_price: null,
    show_in_catalog: true, is_featured: false,
    category: null, catalog_position: 0,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Recipe>(k: K, v: Recipe[K]) => setForm((p) => ({ ...p, [k]: v }));

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadShopImage("recipe-images", shopId, file);
      set("image_url", url);
      toast.success("Imagem carregada");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload");
    } finally { setUploading(false); }
  };

  const save = async () => {
    if (!form.name?.trim()) return toast.error("Informe o nome");
    setSaving(true);
    const payload: any = {
      shop_id: shopId,
      name: form.name.trim(),
      description: form.description || null,
      image_url: form.image_url || null,
      public_price: form.public_price ?? null,
      promo_price: form.promo_price ?? null,
      show_in_catalog: form.show_in_catalog ?? true,
      is_featured: form.is_featured ?? false,
      category: form.category || null,
    };
    let error;
    if (isNew) {
      // Defaults requeridos pelo schema
      payload.servings = 1;
      ({ error } = await supabase.from("recipes").insert(payload));
    } else {
      ({ error } = await supabase.from("recipes").update(payload).eq("id", recipe!.id));
    }
    setSaving(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(isNew ? "Produto criado" : "Produto atualizado");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h2 className="text-lg font-display italic text-mauve">{isNew ? "Novo produto" : "Editar produto"}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-5 p-6 md:grid-cols-[180px_1fr]">
          {/* Imagem */}
          <div>
            <label className="text-xs font-medium text-mauve">Imagem</label>
            <div className="mt-2 aspect-square overflow-hidden rounded-2xl border border-dashed border-border bg-blush/40">
              {form.image_url ? (
                <img src={form.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-mauve/40">
                  <ImageIcon className="h-10 w-10" strokeWidth={1.2} />
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-xs text-mauve hover:border-rose/50 disabled:opacity-50">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {form.image_url ? "Trocar imagem" : "Enviar imagem"}
            </button>
            {form.image_url && (
              <button onClick={() => set("image_url", null)} className="mt-1 w-full rounded-xl px-3 py-1.5 text-[11px] text-mauve/60 hover:text-red-600">
                Remover imagem
              </button>
            )}
          </div>

          {/* Form */}
          <div className="space-y-3">
            <Field label="Nome">
              <input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Descrição (opcional)">
              <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Preço (R$)">
                <input type="number" step="0.01" min={0} value={form.public_price ?? ""}
                  onChange={(e) => set("public_price", e.target.value === "" ? null : Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              </Field>
              <Field label="Promoção (opcional)">
                <input type="number" step="0.01" min={0} value={form.promo_price ?? ""}
                  onChange={(e) => set("promo_price", e.target.value === "" ? null : Number(e.target.value))}
                  placeholder="Riscado se preenchido"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              </Field>
            </div>

            <Field label="Categoria">
              <input list="cat-list" value={form.category ?? ""} onChange={(e) => set("category", e.target.value || null)}
                placeholder="Bolos, Doces, Salgados..."
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              <datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <ToggleRow label="Visível na vitrine" icon={<Eye className="h-3.5 w-3.5" />}
                checked={form.show_in_catalog ?? true} onChange={(v) => set("show_in_catalog", v)} />
              <ToggleRow label="Em destaque" icon={<Star className="h-3.5 w-3.5" />}
                checked={form.is_featured ?? false} onChange={(v) => set("is_featured", v)} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border/60 bg-cream/30 px-6 py-4">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-mauve hover:bg-muted">Cancelar</button>
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-4 py-2 text-sm text-cream hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isNew ? "Criar" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-mauve">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({ label, icon, checked, onChange }: {
  label: string; icon: React.ReactNode; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition ${
        checked ? "border-rose bg-rose/15 text-mauve" : "border-border bg-white text-mauve/70"
      }`}>
      <span className="inline-flex items-center gap-1.5">{icon}{label}</span>
      <span className={`grid h-5 w-9 place-items-center rounded-full text-[10px] font-semibold ${
        checked ? "bg-mauve text-cream" : "bg-muted text-muted-foreground"
      }`}>{checked ? "ON" : "OFF"}</span>
    </button>
  );
}

/* ---------- Aba de Eventos ---------- */

function EventsTab({
  events, loading, slug, origin, recipes,
  expandedEvent, setExpandedEvent, copy, copied, openQr, shopId,
}: {
  events: EventLite[]; loading: boolean; slug: string | undefined; origin: string;
  recipes: Recipe[];
  expandedEvent: string | null; setExpandedEvent: (id: string | null) => void;
  copy: (url: string, key: string) => void; copied: string | null;
  openQr: (url: string, label: string) => void;
  shopId: string | undefined;
}) {
  if (loading) {
    return <div className="card-soft p-10 text-center text-sm text-muted-foreground">
      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Carregando...
    </div>;
  }
  if (events.length === 0) {
    return (
      <div className="card-soft p-10 text-center text-sm text-muted-foreground space-y-3">
        <Calendar className="mx-auto h-10 w-10 text-mauve/30" strokeWidth={1.2} />
        <p>Você ainda não tem eventos cadastrados.</p>
        <p className="text-xs">Cada evento ganha sua própria vitrine pública para os clientes encomendarem antes do dia.</p>
        <Link to="/eventos" className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-4 py-2 text-xs text-cream hover:opacity-90">
          <Plus className="h-3.5 w-3.5" /> Criar evento
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Cada evento tem sua própria vitrine pública com produtos planejados. Compartilhe o link específico antes da data.
      </p>
      {events.map((ev) => {
        const url = slug ? `${origin}/loja/${slug}/e/${ev.id}` : "";
        const date = new Date(ev.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
        const isOpen = expandedEvent === ev.id;
        return (
          <div key={ev.id} className="card-soft overflow-hidden">
            <button onClick={() => setExpandedEvent(isOpen ? null : ev.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-rose/5 transition">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blush to-rose">
                <Calendar className="h-4 w-4 text-mauve" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-mauve truncate">{ev.name}</p>
                <p className="text-[11px] text-muted-foreground">{date}{ev.location ? ` · ${ev.location}` : ""}</p>
              </div>
              {isOpen ? <ChevronUp className="h-4 w-4 text-mauve/60" /> : <ChevronDown className="h-4 w-4 text-mauve/60" />}
            </button>
            {isOpen && shopId && (
              <EventProductsPanel
                eventId={ev.id}
                eventName={ev.name}
                eventUrl={url}
                shopRecipes={recipes}
                shopId={shopId}
                copy={copy}
                copied={copied}
                openQr={openQr}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function EventProductsPanel({ eventId, shopRecipes, shopId }: {
  eventId: string; shopRecipes: Recipe[]; shopId: string;
}) {
  const [items, setItems] = useState<EventProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EventProduct | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("event_products").select("*")
      .eq("event_id", eventId).order("position");
    setItems((data ?? []) as EventProduct[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [eventId]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    items.forEach((p) => p.category && s.add(p.category));
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((p) => {
      if (filterCat === "featured" && !p.is_featured) return false;
      else if (filterCat !== "all" && filterCat !== "featured" && p.category !== filterCat) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, filterCat]);

  const featured = items.filter((p) => p.is_featured).length;

  const updateItem = async (id: string, patch: Partial<EventProduct>) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    await supabase.from("event_products").update(patch).eq("id", id);
  };
  const removeItem = async (p: EventProduct) => {
    if (!confirm(`Remover "${p.name}" deste evento?`)) return;
    await supabase.from("event_products").delete().eq("id", p.id);
    setItems((prev) => prev.filter((x) => x.id !== p.id));
  };
  const move = async (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((p) => p.id === id);
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    setItems(next.map((p, i) => ({ ...p, position: i })));
    await Promise.all([
      supabase.from("event_products").update({ position: idx }).eq("id", next[idx].id),
      supabase.from("event_products").update({ position: target }).eq("id", next[target].id),
    ]);
  };
  const toggleFeatured = async (p: EventProduct) => {
    await updateItem(p.id, { is_featured: !p.is_featured });
  };

  const pushToShop = async (p: EventProduct) => {
    if (p.recipe_id) {
      const { error } = await supabase
        .from("recipes")
        .update({ show_in_catalog: true, public_price: p.unit_price, promo_price: p.promo_price })
        .eq("id", p.recipe_id);
      if (error) return toast.error("Erro: " + error.message);
      toast.success(`"${p.name}" agora aparece na vitrine da loja`);
      return;
    }
    if (!confirm(`Criar "${p.name}" como produto na vitrine da loja?`)) return;
    const { error } = await supabase.from("recipes").insert({
      shop_id: shopId, name: p.name, public_price: p.unit_price, promo_price: p.promo_price,
      description: p.description, category: p.category, image_url: p.image_url,
      is_featured: p.is_featured, show_in_catalog: true, servings: 1,
    } as any);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Adicionado à vitrine da loja");
  };

  return (
    <div className="border-t border-border/60 bg-cream/20 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-mauve">
          <ShoppingBag className="h-3.5 w-3.5 text-rose" />
          <span className="font-medium">{items.length}</span>
          <span className="text-mauve/60">{items.length === 1 ? "produto" : "produtos"} no evento</span>
          {featured > 0 && <span className="text-mauve/50">· {featured} em destaque</span>}
        </div>
        <button onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-3 py-1.5 text-xs text-cream hover:opacity-90">
          <Plus className="h-3.5 w-3.5" /> Novo produto
        </button>
      </div>

      {/* Filtros */}
      {items.length > 0 && (
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mauve/50" />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full rounded-xl border border-border bg-white py-1.5 pl-9 pr-3 text-xs"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterPill active={filterCat === "all"} onClick={() => setFilterCat("all")}>Todos</FilterPill>
            <FilterPill active={filterCat === "featured"} onClick={() => setFilterCat("featured")}>
              <Star className="h-3 w-3" /> Destaques
            </FilterPill>
            {categories.map((c) => (
              <FilterPill key={c} active={filterCat === c} onClick={() => setFilterCat(c)}>{c}</FilterPill>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-white/50 p-8 text-center text-xs text-mauve/70 space-y-2">
          <Cake className="mx-auto h-8 w-8 text-mauve/30" strokeWidth={1.2} />
          <p>Nenhum produto neste evento ainda.</p>
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1 rounded-lg bg-mauve px-3 py-1.5 text-cream hover:opacity-90">
            <Plus className="h-3 w-3" /> Adicionar produto
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-4 text-center text-xs text-mauve/60">Nenhum produto com esses filtros.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((p) => (
            <EventProductCard
              key={p.id} p={p}
              onEdit={() => setEditing(p)}
              onToggleFeatured={() => toggleFeatured(p)}
              onPushToShop={() => pushToShop(p)}
              onDelete={() => removeItem(p)}
              onMoveUp={() => move(p.id, -1)}
              onMoveDown={() => move(p.id, 1)}
            />
          ))}
        </div>
      )}

      {(editing || creating) && (
        <EventProductEditorModal
          product={editing}
          eventId={eventId}
          shopId={shopId}
          shopRecipes={shopRecipes}
          existingCount={items.length}
          categories={categories}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </div>
  );
}

function EventProductCard({ p, onEdit, onToggleFeatured, onPushToShop, onDelete, onMoveUp, onMoveDown }: {
  p: EventProduct;
  onEdit: () => void; onToggleFeatured: () => void; onPushToShop: () => void;
  onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  const hasPromo = p.promo_price != null && p.promo_price < p.unit_price;
  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md ${p.is_featured ? "border-rose ring-1 ring-rose/30" : "border-border/60"}`}>
      <button onClick={onEdit} className="relative aspect-square overflow-hidden bg-blush">
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="grid h-full w-full place-items-center text-mauve/40">
            <ImageIcon className="h-7 w-7" strokeWidth={1.2} />
          </div>
        )}
        {hasPromo && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-rose px-1.5 py-0.5 text-[9px] font-semibold text-mauve shadow">PROMO</span>
        )}
        {p.is_featured && (
          <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-rose text-mauve shadow">
            <Star className="h-3 w-3 fill-current" />
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-0.5 px-2 py-1.5">
        <h3 className="text-xs font-medium text-mauve line-clamp-1">{p.name}</h3>
        {p.category && <span className="text-[9px] text-mauve/50 line-clamp-1">{p.category}</span>}
        <div className="mt-auto flex items-baseline gap-1 pt-1">
          {hasPromo ? (
            <>
              <span className="text-[10px] text-mauve/50 line-through">{brl(p.unit_price)}</span>
              <span className="text-xs font-semibold text-rose">{brl(p.promo_price)}</span>
            </>
          ) : (
            <span className="text-xs font-semibold text-mauve">{brl(p.unit_price)}</span>
          )}
          {p.planned_qty > 0 && (
            <span className="ml-auto text-[9px] text-mauve/50">{p.sold_qty}/{p.planned_qty}</span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border/50 bg-cream/30 px-1 py-0.5">
        <div className="flex">
          <IconBtn label="Subir" onClick={onMoveUp}><ChevronUp className="h-3 w-3" /></IconBtn>
          <IconBtn label="Descer" onClick={onMoveDown}><ChevronDown className="h-3 w-3" /></IconBtn>
        </div>
        <div className="flex">
          <IconBtn label={p.is_featured ? "Remover destaque" : "Destacar"} onClick={onToggleFeatured} active={p.is_featured}>
            <Star className={`h-3 w-3 ${p.is_featured ? "fill-current" : ""}`} />
          </IconBtn>
          <IconBtn label="Enviar para vitrine da loja" onClick={onPushToShop}>
            <ArrowLeftRight className="h-3 w-3" />
          </IconBtn>
          <IconBtn label="Editar" onClick={onEdit}><Pencil className="h-3 w-3" /></IconBtn>
          <IconBtn label="Remover" onClick={onDelete} danger><Trash2 className="h-3 w-3" /></IconBtn>
        </div>
      </div>
    </div>
  );
}

/* ---------- Modal de produto do evento (com opção de copiar da loja) ---------- */

function EventProductEditorModal({ product, eventId, shopId, shopRecipes, existingCount, categories, onClose, onSaved }: {
  product: EventProduct | null;
  eventId: string;
  shopId: string;
  shopRecipes: Recipe[];
  existingCount: number;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !product;
  const [mode, setMode] = useState<"manual" | "shop">(isNew ? "manual" : "manual");
  const [shopSearch, setShopSearch] = useState("");
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<Partial<EventProduct>>(product ?? {
    name: "", description: "", image_url: null,
    unit_price: 0, promo_price: null,
    is_featured: false, planned_qty: 0,
    category: null, sale_mode: "unit", batches: 0,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof EventProduct>(k: K, v: EventProduct[K]) => setForm((p) => ({ ...p, [k]: v }));

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadShopImage("recipe-images", shopId, file);
      set("image_url", url);
      toast.success("Imagem carregada");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload");
    } finally { setUploading(false); }
  };

  const filteredShop = useMemo(() => {
    const q = shopSearch.trim().toLowerCase();
    return shopRecipes.filter((r) => !q || r.name.toLowerCase().includes(q));
  }, [shopRecipes, shopSearch]);

  const togglePick = (id: string) => {
    const next = new Set(pickedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPickedIds(next);
  };

  const saveManual = async () => {
    if (!form.name?.trim()) return toast.error("Informe o nome");
    setSaving(true);
    const payload: any = {
      event_id: eventId,
      name: form.name.trim(),
      description: form.description || null,
      category: form.category || null,
      image_url: form.image_url || null,
      unit_price: form.unit_price ?? 0,
      promo_price: form.promo_price ?? null,
      planned_qty: form.planned_qty ?? 0,
      is_featured: form.is_featured ?? false,
      sale_mode: form.sale_mode ?? "unit",
      batches: form.batches ?? 0,
    };
    let error;
    if (isNew) {
      payload.position = existingCount;
      ({ error } = await supabase.from("event_products").insert(payload));
    } else {
      ({ error } = await supabase.from("event_products").update(payload).eq("id", product!.id));
    }
    setSaving(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(isNew ? "Produto adicionado" : "Produto atualizado");
    onSaved();
  };

  const saveFromShop = async () => {
    if (pickedIds.size === 0) return toast.error("Selecione pelo menos um produto");
    setSaving(true);
    const picked = shopRecipes.filter((r) => pickedIds.has(r.id));
    const rows = picked.map((r, i) => ({
      event_id: eventId, recipe_id: r.id, name: r.name,
      description: r.description, category: r.category, image_url: r.image_url,
      unit_price: r.public_price ?? 0, promo_price: r.promo_price,
      is_featured: r.is_featured, planned_qty: 0, position: existingCount + i,
      sale_mode: "unit" as const, batches: 0,
    }));
    const { error } = await supabase.from("event_products").insert(rows);
    setSaving(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(`${picked.length} produto(s) copiado(s) da loja`);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <h2 className="text-lg font-display italic text-mauve">{isNew ? "Adicionar produto ao evento" : "Editar produto do evento"}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {isNew && (
          <div className="border-b border-border/60 px-6 pt-3">
            <div className="card-soft inline-flex gap-1 p-1">
              <button onClick={() => setMode("manual")}
                className={`rounded-lg px-3 py-1.5 text-xs transition ${mode === "manual" ? "bg-mauve text-cream" : "text-mauve hover:bg-rose/10"}`}>
                Criar novo
              </button>
              <button onClick={() => setMode("shop")}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs transition ${mode === "shop" ? "bg-mauve text-cream" : "text-mauve hover:bg-rose/10"}`}>
                <ArrowLeftRight className="h-3 w-3" /> Copiar da vitrine da loja
              </button>
            </div>
          </div>
        )}

        {mode === "shop" && isNew ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            <p className="text-xs text-mauve/70">Selecione um ou mais produtos da sua vitrine principal para copiar para este evento (preço, imagem e descrição são copiados).</p>
            <input value={shopSearch} onChange={(e) => setShopSearch(e.target.value)} placeholder="Buscar..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            {filteredShop.length === 0 ? (
              <p className="py-6 text-center text-xs text-mauve/60">Nenhum produto na vitrine da loja ainda.</p>
            ) : (
              <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                {filteredShop.map((r) => {
                  const checked = pickedIds.has(r.id);
                  return (
                    <button key={r.id} onClick={() => togglePick(r.id)}
                      className={`flex w-full items-center gap-2 rounded-xl border p-2 text-left transition ${checked ? "border-rose bg-rose/10" : "border-border/40 hover:border-rose/50 hover:bg-rose/5"}`}>
                      <div className={`grid h-5 w-5 flex-none place-items-center rounded-md border-2 ${checked ? "border-mauve bg-mauve text-cream" : "border-border bg-white"}`}>
                        {checked && <Check className="h-3 w-3" />}
                      </div>
                      {r.image_url ? (
                        <img src={r.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div className="grid h-10 w-10 place-items-center rounded-lg bg-blush"><Cake className="h-4 w-4 text-mauve/50" /></div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-mauve truncate">{r.name}</p>
                        <p className="text-[11px] text-mauve/60">{brl(r.promo_price ?? r.public_price)}{r.category ? ` · ${r.category}` : ""}</p>
                      </div>
                      {r.is_featured && <Star className="h-3.5 w-3.5 fill-rose text-rose" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto grid gap-5 p-6 md:grid-cols-[180px_1fr]">
            <div>
              <label className="text-xs font-medium text-mauve">Imagem</label>
              <div className="mt-2 aspect-square overflow-hidden rounded-2xl border border-dashed border-border bg-blush/40">
                {form.image_url ? (
                  <img src={form.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-mauve/40">
                    <ImageIcon className="h-10 w-10" strokeWidth={1.2} />
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-xs text-mauve hover:border-rose/50 disabled:opacity-50">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {form.image_url ? "Trocar imagem" : "Enviar imagem"}
              </button>
              {form.image_url && (
                <button onClick={() => set("image_url", null)} className="mt-1 w-full rounded-xl px-3 py-1.5 text-[11px] text-mauve/60 hover:text-red-600">
                  Remover imagem
                </button>
              )}
            </div>

            <div className="space-y-3">
              <Field label="Nome">
                <input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
              </Field>
              <Field label="Descrição (opcional)">
                <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Preço (R$)">
                  <input type="number" step="0.01" min={0} value={form.unit_price ?? ""}
                    onChange={(e) => set("unit_price", e.target.value === "" ? 0 : Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                </Field>
                <Field label="Promoção (opcional)">
                  <input type="number" step="0.01" min={0} value={form.promo_price ?? ""}
                    onChange={(e) => set("promo_price", e.target.value === "" ? null : Number(e.target.value))}
                    placeholder="Riscado se preenchido"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantidade planejada">
                  <input type="number" min={0} value={form.planned_qty ?? 0}
                    onChange={(e) => set("planned_qty", Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                </Field>
                <Field label="Categoria">
                  <input list="evt-cat-list" value={form.category ?? ""} onChange={(e) => set("category", e.target.value || null)}
                    placeholder="Bolos, Doces..."
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                  <datalist id="evt-cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
                </Field>
              </div>
              <ToggleRow label="Em destaque na vitrine deste evento" icon={<Star className="h-3.5 w-3.5" />}
                checked={form.is_featured ?? false} onChange={(v) => set("is_featured", v)} />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border/60 bg-cream/30 px-6 py-4">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-mauve hover:bg-muted">Cancelar</button>
          <button onClick={mode === "shop" && isNew ? saveFromShop : saveManual} disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-4 py-2 text-sm text-cream hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {mode === "shop" && isNew ? `Copiar ${pickedIds.size || ""}` : isNew ? "Adicionar" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Modal de QR ---------- */

function QrModal({ target, onClose }: { target: { url: string; label: string }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display italic text-mauve">{target.label}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid place-items-center rounded-2xl bg-cream p-4">
          <QRCodeSVG value={target.url} size={220} />
        </div>
        <p className="mt-3 break-all text-[11px] text-muted-foreground">{target.url}</p>
        <a href={target.url} target="_blank" rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-mauve px-4 py-2 text-xs text-cream hover:opacity-90">
          <ExternalLink className="h-3.5 w-3.5" /> Abrir
        </a>
      </div>
    </div>
  );
}
