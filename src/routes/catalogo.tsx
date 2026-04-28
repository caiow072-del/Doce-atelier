// Catálogo redesenhado — vitrine da loja + vitrines de eventos
// Cards visuais, modal de edição completo, destaque, promoção, upload de
// imagem, copiar produtos entre vitrine da loja e vitrine de eventos.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Globe, ExternalLink, Eye, EyeOff, ChevronUp, ChevronDown,
  Tag, Sparkles, Calendar, ShoppingBag, Cake, Copy, Check, Plus,
  Pencil, Trash2, Star, Image as ImageIcon, X, QrCode, Upload, ArrowRight,
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
  unit_price: number;
  planned_qty: number;
  sold_qty: number;
  image_url: string | null;
  position: number;
  sale_mode: string;
  batches: number;
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
                  className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white text-mauve hover:border-rose/50">
                  <Sparkles className="h-3.5 w-3.5 text-rose" />
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
    return <div className="card-soft p-10 text-center text-sm text-muted-foreground">
      Nenhum evento cadastrado. <Link to="/eventos" className="underline text-mauve">Criar evento</Link>.
    </div>;
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
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blush to-rose">
                <Calendar className="h-4 w-4 text-mauve" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-mauve truncate">{ev.name}</p>
                <p className="text-[11px] text-muted-foreground">{date}{ev.location ? ` · ${ev.location}` : ""}</p>
              </div>
              {url && (
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => copy(url, ev.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] text-mauve hover:border-rose/50">
                    {copied === ev.id ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                    Copiar
                  </button>
                  <button onClick={() => openQr(url, ev.name)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] text-mauve hover:border-rose/50">
                    <QrCode className="h-3 w-3" /> QR
                  </button>
                  <a href={url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-mauve px-2.5 py-1.5 text-[11px] text-cream hover:opacity-90">
                    <ExternalLink className="h-3 w-3" /> Abrir
                  </a>
                </div>
              )}
              <button onClick={() => setExpandedEvent(isOpen ? null : ev.id)}
                className="grid h-8 w-8 place-items-center rounded-lg text-mauve hover:bg-rose/20">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
            {isOpen && shopId && (
              <EventProductsPanel eventId={ev.id} shopRecipes={recipes} shopId={shopId} />
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
  const [picker, setPicker] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("event_products").select("*")
      .eq("event_id", eventId).order("position");
    setItems((data ?? []) as EventProduct[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [eventId]);

  const updateItem = async (id: string, patch: Partial<EventProduct>) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    await supabase.from("event_products").update(patch).eq("id", id);
  };
  const removeItem = async (id: string) => {
    if (!confirm("Remover esse produto do evento?")) return;
    await supabase.from("event_products").delete().eq("id", id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const addFromRecipe = async (r: Recipe) => {
    const pos = items.length;
    const { data, error } = await supabase.from("event_products").insert({
      event_id: eventId, recipe_id: r.id, name: r.name,
      unit_price: r.promo_price ?? r.public_price ?? 0,
      planned_qty: 0, position: pos, image_url: r.image_url,
      sale_mode: "unit", batches: 0,
    }).select().single();
    if (error) return toast.error("Erro: " + error.message);
    setItems((prev) => [...prev, data as EventProduct]);
    setPicker(false);
    toast.success("Adicionado");
  };

  const addBlank = async () => {
    const pos = items.length;
    const { data, error } = await supabase.from("event_products").insert({
      event_id: eventId, name: "Novo produto", unit_price: 0, planned_qty: 0, position: pos,
      sale_mode: "unit", batches: 0,
    }).select().single();
    if (error) return toast.error("Erro: " + error.message);
    setItems((prev) => [...prev, data as EventProduct]);
  };

  const copyAllFromShop = async () => {
    const visible = shopRecipes.filter((r) => r.show_in_catalog);
    if (visible.length === 0) return toast.error("Nenhum produto visível na vitrine da loja");
    if (!confirm(`Copiar ${visible.length} produto(s) da vitrine da loja para este evento?`)) return;
    const rows = visible.map((r, i) => ({
      event_id: eventId, recipe_id: r.id, name: r.name,
      unit_price: r.promo_price ?? r.public_price ?? 0,
      planned_qty: 0, position: items.length + i, image_url: r.image_url,
      sale_mode: "unit" as const, batches: 0,
    }));
    const { error } = await supabase.from("event_products").insert(rows);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(`${visible.length} produto(s) copiados`);
    load();
  };

  return (
    <div className="border-t border-border/60 bg-cream/20 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-mauve/70">{items.length} produto(s) na vitrine deste evento</p>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setPicker(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] text-mauve hover:border-rose/50">
            <Plus className="h-3 w-3" /> Da vitrine da loja
          </button>
          <button onClick={copyAllFromShop}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] text-mauve hover:border-rose/50">
            <ArrowLeftRight className="h-3 w-3" /> Copiar tudo da loja
          </button>
          <button onClick={addBlank}
            className="inline-flex items-center gap-1 rounded-lg bg-mauve px-2.5 py-1.5 text-[11px] text-cream hover:opacity-90">
            <Plus className="h-3 w-3" /> Em branco
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-xs text-mauve/60">Nenhum produto neste evento ainda.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {items.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-xl border border-border/60 bg-white p-2">
              {p.image_url ? (
                <img src={p.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-blush"><Cake className="h-4 w-4 text-mauve/50" /></div>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <input value={p.name} onChange={(e) => updateItem(p.id, { name: e.target.value })}
                  className="w-full rounded-md border border-transparent bg-transparent px-1 text-sm font-medium text-mauve hover:border-border focus:border-rose focus:outline-none" />
                <div className="flex items-center gap-2 text-[11px] text-mauve/70">
                  <span>R$</span>
                  <input type="number" step="0.01" value={p.unit_price}
                    onChange={(e) => updateItem(p.id, { unit_price: Number(e.target.value) || 0 })}
                    className="w-20 rounded-md border border-border bg-background px-1.5 py-0.5 text-right" />
                  <span>·</span>
                  <span>Qtd</span>
                  <input type="number" min={0} value={p.planned_qty}
                    onChange={(e) => updateItem(p.id, { planned_qty: Number(e.target.value) || 0 })}
                    className="w-16 rounded-md border border-border bg-background px-1.5 py-0.5 text-right" />
                </div>
              </div>
              <button onClick={() => removeItem(p.id)}
                className="grid h-7 w-7 place-items-center rounded-lg text-mauve/60 hover:bg-red-100 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {picker && (
        <RecipePickerModal
          recipes={shopRecipes}
          onPick={(r) => addFromRecipe(r)}
          onClose={() => setPicker(false)}
        />
      )}
    </div>
  );
}

function RecipePickerModal({ recipes, onPick, onClose }: {
  recipes: Recipe[]; onPick: (r: Recipe) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = recipes.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <h3 className="font-display italic text-mauve">Escolher produto da vitrine</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..."
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-mauve/60">Nenhum produto.</p>
          ) : filtered.map((r) => (
            <button key={r.id} onClick={() => onPick(r)}
              className="flex w-full items-center gap-2 rounded-xl border border-border/40 p-2 text-left hover:border-rose/50 hover:bg-rose/5">
              {r.image_url ? (
                <img src={r.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-blush"><Cake className="h-4 w-4 text-mauve/50" /></div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-mauve truncate">{r.name}</p>
                <p className="text-[11px] text-mauve/60">{brl(r.promo_price ?? r.public_price)}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-mauve/50" />
            </button>
          ))}
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
