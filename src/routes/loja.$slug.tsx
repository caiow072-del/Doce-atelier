// Public storefront with built-in inline editor for owners.
// Mobile-first: the page is rendered as a phone-shaped column at the center
// when in edit mode, with a side rail for template/sections/save.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  ShoppingBag, Plus, Minus, X, MapPin, Phone, User, MessageCircle,
  Loader2, Search, ChevronRight, Cake, Pencil, Instagram, Clock,
  Save, Sparkles, LayoutTemplate, Eye, EyeOff, GripVertical, Smartphone, Monitor,
  Quote, ImagePlus, ChevronDown, ChevronUp, Check, Palette, Type, QrCode, Copy,
  Truck, Store,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { applyTheme, PRESETS, FONTS, type ShopTheme, type ThemePresetKey, type FontKey } from "@/lib/theme";
import { TEMPLATES, SECTION_LABELS, getTemplate, type TemplateKey, type SectionConfig, type SectionKey, DEFAULT_SECTIONS } from "@/lib/templates";
import { EditableText, EditableImage } from "@/components/InlineEdit";
import { uploadShopImage } from "@/lib/upload";
import { HeroCardapio, PickupDeliveryCard } from "./-loja/HeroCardapio";
import { ProductListHorizontal } from "./-loja/ProductListHorizontal";
import { CategoryPicker } from "./-loja/CategoryPicker";
import { BottomNav, type BottomNavTab } from "./-loja/BottomNav";
import { HoursEditor } from "./-loja/HoursEditor";
import { defaultHours, DAY_KEYS, DAY_LABELS, type BusinessHours } from "@/lib/business-hours";


const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(80),
  phone: z.string().trim().min(8, "WhatsApp inválido").max(20).regex(/^[\d\s()+\-]+$/, "Apenas números e símbolos"),
  address: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const Route = createFileRoute("/loja/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Loja — ${params.slug}` },
      { name: "description", content: "Peça seus doces favoritos diretamente pela vitrine." },
      { property: "og:title", content: `Loja ${params.slug}` },
      { property: "og:description", content: "Vitrine de doces artesanais." },
    ],
  }),
  component: StorefrontPage,
});

type Shop = {
  id: string; name: string; slug: string;
  whatsapp: string | null; description: string | null;
  logo_url: string | null; theme: ShopTheme | null;
};

type Testimonial = { id: string; name: string; text: string; rating?: number };
type GalleryItem = { id: string; url: string; caption?: string };
type Promotion = { id: string; title: string; price_from?: number; price_to?: number };

type Storefront = {
  hero_title: string | null;
  hero_subtitle: string | null;
  banner_url: string | null;
  social: { instagram?: string; address?: string; hours?: string };
  about_text: string | null;
  cta_label: string | null;
  cta_link: string | null;
  template: TemplateKey;
  sections_config: SectionConfig[];
  promotions: Promotion[];
  testimonials: Testimonial[];
  gallery: GalleryItem[];
  // Novos campos do cardápio digital
  business_hours: BusinessHours;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  pickup_address: string | null;
  delivery_address: string | null;
  delivery_fee: number;
  delivery_radius_km: number;
  hero_images: string[];
  bottom_nav_enabled: boolean;
  city: string | null;
  state: string | null;
  more_info: string | null;
};

type PublicRecipe = {
  id: string; name: string; description: string | null;
  image_url: string | null; public_price: number | null; servings: number | null;
  category: string | null; promo_price: number | null; is_featured: boolean;
};

type CartItem = {
  recipe_id: string; name: string; price: number; qty: number; image_url: string | null;
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const EMPTY_FRONT: Storefront = {
  hero_title: null, hero_subtitle: null, banner_url: null, social: {},
  about_text: null, cta_label: null, cta_link: null,
  template: "romantic", sections_config: DEFAULT_SECTIONS,
  promotions: [], testimonials: [], gallery: [],
  business_hours: {}, pickup_enabled: true, delivery_enabled: false,
  pickup_address: null, delivery_address: null,
  delivery_fee: 0, delivery_radius_km: 0,
  hero_images: [], bottom_nav_enabled: true,
  city: null, state: null, more_info: null,
};

function StorefrontPage() {
  const { slug } = Route.useParams();
  const { session, shops } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [recipes, setRecipes] = useState<PublicRecipe[]>([]);
  const [front, setFront] = useState<Storefront>(EMPTY_FRONT);
  const [theme, setTheme] = useState<ShopTheme>({ preset: "rose", font: "playfair" });
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [editing, setEditing] = useState(false);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [editorTab, setEditorTab] = useState<"template" | "sections" | "design" | "shop">("template");
  const [panelOpen, setPanelOpen] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<BottomNavTab>("home");
  const catalogRef = useRef<HTMLDivElement | null>(null);
  const promoRef = useRef<HTMLDivElement | null>(null);

  const isOwner = !!shop && shops.some((m) => m.shop_id === shop.id && (m.role === "owner" || m.role === "manager"));

  // Auto-open editor when ?edit=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.has("edit") && isOwner) setEditing(true);
  }, [isOwner]);

  // Load shop + storefront + recipes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: shopData } = await supabase
        .from("shops")
        .select("id, name, slug, whatsapp, description, logo_url, theme")
        .eq("slug", slug)
        .maybeSingle();
      if (cancelled) return;
      if (!shopData) { setLoading(false); return; }
      setShop(shopData as Shop);
      const t = (shopData.theme ?? { preset: "rose", font: "playfair" }) as ShopTheme;
      setTheme(t);
      applyTheme(t);

      // SEO dinâmico: usar dados reais da loja no <title>/<meta>
      if (typeof document !== "undefined") {
        document.title = `${shopData.name} — Doces artesanais`;
        const setMeta = (sel: string, attr: string, content: string) => {
          let el = document.head.querySelector(sel) as HTMLMetaElement | null;
          if (!el) {
            el = document.createElement("meta");
            const [, key] = sel.match(/\[(.+?)=/) ?? [];
            const [, val] = sel.match(/="(.+?)"/) ?? [];
            if (key && val) el.setAttribute(key, val);
            document.head.appendChild(el);
          }
          el.setAttribute(attr, content);
        };
        const desc = (shopData.description ?? "").trim() || `Peça os doces de ${shopData.name} pela vitrine online.`;
        setMeta('meta[name="description"]', "content", desc.slice(0, 160));
        setMeta('meta[property="og:title"]', "content", shopData.name);
        setMeta('meta[property="og:description"]', "content", desc.slice(0, 160));
        if (shopData.logo_url) setMeta('meta[property="og:image"]', "content", shopData.logo_url);
      }

      // Analytics: registra 1 visita por sessão por loja (anônima)
      if (typeof window !== "undefined" && !isOwner) {
        try {
          const key = `visit:${shopData.id}`;
          if (!sessionStorage.getItem(key)) {
            const device = window.matchMedia("(max-width: 640px)").matches ? "mobile" : "desktop";
            await supabase.from("shop_visits").insert({
              shop_id: shopData.id,
              referer: document.referrer || null,
              device,
              session_key: crypto.randomUUID(),
            });
            sessionStorage.setItem(key, "1");
          }
        } catch { /* silencioso */ }
      }

      const [recsRes, sfRes] = await Promise.all([
        supabase.from("recipes")
          .select("id, name, description, image_url, public_price, servings, category, promo_price, is_featured")
          .eq("shop_id", shopData.id).eq("show_in_catalog", true).order("is_featured", { ascending: false }).order("catalog_position").order("name"),
        supabase.from("shop_storefront").select("*").eq("shop_id", shopData.id).maybeSingle(),
      ]);
      if (cancelled) return;
      setRecipes((recsRes.data ?? []) as PublicRecipe[]);
      const sf = sfRes.data as any;
      if (sf) {
        const sections: SectionConfig[] = Array.isArray(sf.sections_config) && sf.sections_config.length > 0
          ? sf.sections_config
          : getTemplate(sf.template).sections;
        setFront({
          hero_title: sf.hero_title ?? null,
          hero_subtitle: sf.hero_subtitle ?? null,
          banner_url: sf.banner_url ?? null,
          social: sf.social ?? {},
          about_text: sf.about_text ?? null,
          cta_label: sf.cta_label ?? null,
          cta_link: sf.cta_link ?? null,
          template: (sf.template ?? "romantic") as TemplateKey,
          sections_config: sections,
          promotions: (sf.promotions ?? []) as Promotion[],
          testimonials: (sf.testimonials ?? []) as Testimonial[],
          gallery: (sf.gallery ?? []) as GalleryItem[],
          business_hours: (sf.business_hours ?? {}) as BusinessHours,
          pickup_enabled: sf.pickup_enabled ?? true,
          delivery_enabled: sf.delivery_enabled ?? false,
          pickup_address: sf.pickup_address ?? null,
          delivery_address: sf.delivery_address ?? null,
          delivery_fee: Number(sf.delivery_fee ?? 0),
          delivery_radius_km: Number(sf.delivery_radius_km ?? 0),
          hero_images: Array.isArray(sf.hero_images) ? (sf.hero_images as string[]) : [],
          bottom_nav_enabled: sf.bottom_nav_enabled ?? true,
          city: sf.city ?? null,
          state: sf.state ?? null,
          more_info: sf.more_info ?? null,
        });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const update = useCallback(<K extends keyof Storefront>(key: K, value: Storefront[K]) => {
    setFront((p) => ({ ...p, [key]: value }));
    setDirty(true);
  }, []);

  const updateTheme = useCallback((t: ShopTheme) => {
    setTheme(t);
    applyTheme(t);
    setDirty(true);
  }, []);

  const applyTemplate = (key: TemplateKey) => {
    const tpl = TEMPLATES[key];
    setTheme(tpl.theme);
    applyTheme(tpl.theme);
    setFront((p) => ({ ...p, template: key, sections_config: tpl.sections }));
    setDirty(true);
    toast.success(`Template "${tpl.label}" aplicado`);
  };

  const save = async () => {
    if (!shop) return;
    setSaving(true);
    try {
      const [t, s] = await Promise.all([
        supabase.from("shops").update({ theme: theme as any }).eq("id", shop.id),
        supabase.from("shop_storefront").upsert({
          shop_id: shop.id,
          hero_title: front.hero_title,
          hero_subtitle: front.hero_subtitle,
          banner_url: front.banner_url,
          social: front.social as any,
          about_text: front.about_text,
          cta_label: front.cta_label,
          cta_link: front.cta_link,
          template: front.template,
          sections_config: front.sections_config as any,
          promotions: front.promotions as any,
          testimonials: front.testimonials as any,
          gallery: front.gallery as any,
          business_hours: front.business_hours as any,
          pickup_enabled: front.pickup_enabled,
          delivery_enabled: front.delivery_enabled,
          pickup_address: front.pickup_address,
          delivery_address: front.delivery_address,
          delivery_fee: front.delivery_fee,
          delivery_radius_km: front.delivery_radius_km,
          hero_images: front.hero_images as any,
          bottom_nav_enabled: front.bottom_nav_enabled,
          city: front.city,
          state: front.state,
          more_info: front.more_info,
        }, { onConflict: "shop_id" }),
      ]);
      if (t.error || s.error) throw t.error ?? s.error;
      toast.success("Vitrine publicada ✨");
      setDirty(false);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message ?? ""));
    } finally {
      setSaving(false);
    }
  };

  const onUploadBanner = async (file: File) => {
    if (!shop) return;
    try {
      const url = await uploadShopImage("storefront-banners", shop.id, file);
      update("banner_url", url);
      toast.success("Banner atualizado — clique em Publicar para salvar.");
    } catch (e: any) { toast.error(e?.message ?? "Erro upload"); }
  };

  const onUploadGallery = async (file: File) => {
    if (!shop) return;
    try {
      const url = await uploadShopImage("storefront-banners", shop.id, file);
      update("gallery", [...front.gallery, { id: crypto.randomUUID(), url }]);
    } catch (e: any) { toast.error(e?.message ?? "Erro upload"); }
  };

  const addToCart = (r: PublicRecipe) => {
    if (editing) return;
    const effective = (r.promo_price != null && r.public_price != null && r.promo_price < r.public_price) ? r.promo_price : r.public_price;
    if (effective == null) { toast.error("Produto sem preço, fale com a loja."); return; }
    setCart((prev) => {
      const found = prev.find((i) => i.recipe_id === r.id);
      if (found) return prev.map((i) => (i.recipe_id === r.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { recipe_id: r.id, name: r.name, price: effective, qty: 1, image_url: r.image_url }];
    });
    toast.success(`${r.name} adicionado`);
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => prev.map((i) => (i.recipe_id === id ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0));
  };

  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const categories = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((r) => r.category && set.add(r.category));
    return Array.from(set).sort();
  }, [recipes]);
  const filtered = recipes.filter((r) => {
    const okSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const okCat = activeCategory === "all" || r.category === activeCategory;
    return okSearch && okCat;
  });
  const promoMap = useMemo(() => {
    const m = new Map<string, Promotion>();
    front.promotions.forEach((p) => {
      // matching simples por nome (case-insensitive)
      const r = recipes.find((x) => x.name.toLowerCase() === p.title.toLowerCase());
      if (r) m.set(r.id, p);
    });
    return m;
  }, [front.promotions, recipes]);

  if (loading) {
    return (
      <div className="floral-bg flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-mauve" />
      </div>
    );
  }
  if (!shop) {
    return (
      <div className="floral-bg flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <Cake className="h-12 w-12 text-mauve/40" strokeWidth={1.2} />
        <h1 className="font-display text-3xl italic text-mauve">Loja não encontrada</h1>
        <Link to="/" className="mt-2 rounded-full bg-rose px-6 py-3 text-sm text-mauve">Voltar</Link>
      </div>
    );
  }

  const heroTitle = front.hero_title || shop.name;
  const heroSubtitle = front.hero_subtitle || shop.description || "";

  // Storefront body — same JSX is reused both for normal viewing and edit preview.
  const storefrontBody = (
    <div className={`floral-bg min-h-screen pb-32`}>
      {front.sections_config.filter((s) => s.visible).map((s) => {
        switch (s.key) {
          case "hero": return (
            <Hero
              key={s.key}
              shop={shop}
              front={front}
              editing={editing}
              heroTitle={heroTitle}
              heroSubtitle={heroSubtitle}
              onTitle={(v) => update("hero_title", v)}
              onSubtitle={(v) => update("hero_subtitle", v)}
              onBanner={onUploadBanner}
            />
          );
          case "about": return (
            <Section key={s.key} title="Sobre">
              <EditableText
                editing={editing}
                value={front.about_text ?? ""}
                onChange={(v) => update("about_text", v)}
                as="p"
                multiline
                placeholder="Conte sua história, o que te inspira, há quanto tempo está nessa…"
                className="text-base text-mauve/80 leading-relaxed whitespace-pre-wrap"
              />
            </Section>
          );
          case "promotions": return (
            <PromotionsSection
              key={s.key}
              promotions={front.promotions}
              editing={editing}
              onChange={(p) => update("promotions", p)}
            />
          );
          case "catalog": return (
            <section key={s.key} className="mx-auto max-w-5xl px-5 py-6">
              <SectionHeading>Catálogo</SectionHeading>
              {!editing && (
                <div className="mb-4 relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mauve/50" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar bolo, doce..."
                    className="w-full rounded-full border border-rose/40 bg-white py-2.5 pl-10 pr-4 text-sm text-mauve placeholder:text-mauve/40 focus:border-rose focus:outline-none"
                  />
                </div>
              )}
              {!editing && categories.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {(["all", ...categories] as const).map((c) => (
                    <button key={c} onClick={() => setActiveCategory(c)}
                      className={`rounded-full px-3 py-1 text-[11px] transition ${activeCategory === c ? "bg-mauve text-cream" : "bg-white border border-rose/30 text-mauve hover:border-rose"}`}>
                      {c === "all" ? "Todos" : c}
                    </button>
                  ))}
                </div>
              )}
              {filtered.length === 0 ? (
                <div className="card-soft p-10 text-center text-mauve/70">
                  <Cake className="mx-auto mb-3 h-10 w-10 text-mauve/30" strokeWidth={1.2} />
                  <p>Nenhum produto disponível.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((r) => {
                    const promo = promoMap.get(r.id);
                    const hasPromoPrice = r.promo_price != null && r.public_price != null && r.promo_price < r.public_price;
                    const showPriceTo = promo?.price_to != null;
                    const priceFrom = promo?.price_from ?? r.public_price;
                    const finalPrice = showPriceTo ? promo!.price_to! : (hasPromoPrice ? r.promo_price! : r.public_price);
                    const compareAt = showPriceTo ? priceFrom : (hasPromoPrice ? r.public_price : null);
                    return (
                      <article key={r.id} className={`group flex flex-col overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:shadow-lg ${r.is_featured ? "border-rose ring-2 ring-rose/40" : "border-rose/30"}`}>
                        <div className="relative aspect-[4/3] overflow-hidden bg-blush">
                          {r.image_url ? (
                            <img src={r.image_url} alt={r.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                          ) : (<div className="grid h-full w-full place-items-center"><Cake className="h-12 w-12 text-mauve/40" /></div>)}
                          {(promo || hasPromoPrice) && (
                            <span className="absolute left-2 top-2 rounded-full bg-rose px-2.5 py-0.5 text-[10px] font-semibold text-mauve shadow">PROMO</span>
                          )}
                          {r.is_featured && (
                            <span className="absolute left-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-mauve px-2 py-0.5 text-[10px] font-semibold text-cream shadow">
                              ★ Destaque
                            </span>
                          )}
                          {r.category && (
                            <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] text-mauve">{r.category}</span>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col gap-2 p-4">
                          <h3 className="font-display text-lg italic text-mauve">{r.name}</h3>
                          {r.description && <p className="line-clamp-2 text-xs text-mauve/70">{r.description}</p>}
                          <div className="mt-auto flex items-center justify-between pt-2">
                            <div className="flex items-baseline gap-1.5">
                              {compareAt != null && (
                                <span className="text-xs text-mauve/50 line-through">{brl(compareAt)}</span>
                              )}
                              <span className="text-base font-semibold text-mauve">
                                {finalPrice != null ? brl(finalPrice) : "Sob consulta"}
                              </span>
                            </div>
                            <button onClick={() => addToCart(r)} disabled={editing} className="inline-flex items-center gap-1 rounded-full bg-mauve px-4 py-2 text-xs font-medium text-cream hover:opacity-90 disabled:opacity-50">
                              <Plus className="h-3.5 w-3.5" /> Adicionar
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          );
          case "events": return null; // shown via /loja/{slug}/e/{eventId}
          case "gallery": return (
            <GallerySection
              key={s.key}
              gallery={front.gallery}
              editing={editing}
              onAdd={onUploadGallery}
              onRemove={(id) => update("gallery", front.gallery.filter((g) => g.id !== id))}
            />
          );
          case "testimonials": return (
            <TestimonialsSection
              key={s.key}
              testimonials={front.testimonials}
              editing={editing}
              onChange={(t) => update("testimonials", t)}
            />
          );
          case "contact": return (
            <Section key={s.key} title="Contato">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
                <ContactRow icon={<Instagram className="h-4 w-4" />}>
                  <EditableText editing={editing} value={front.social?.instagram ?? ""} onChange={(v) => update("social", { ...front.social, instagram: v })} placeholder="@minhadoceria" className="text-mauve" />
                </ContactRow>
                <ContactRow icon={<MapPin className="h-4 w-4" />}>
                  <EditableText editing={editing} value={front.social?.address ?? ""} onChange={(v) => update("social", { ...front.social, address: v })} placeholder="Rua, número, cidade" className="text-mauve" />
                </ContactRow>
                <ContactRow icon={<Clock className="h-4 w-4" />}>
                  <EditableText editing={editing} value={front.social?.hours ?? ""} onChange={(v) => update("social", { ...front.social, hours: v })} placeholder="Seg-Sex 10h–18h" className="text-mauve" />
                </ContactRow>
              </div>
            </Section>
          );
          default: return null;
        }
      })}

      <footer className="mx-auto max-w-5xl px-6 pb-8 pt-4 text-center text-xs text-mauve/50">
        Pedidos enviados via WhatsApp — sujeitos à confirmação da loja.
      </footer>

      {/* Floating cart button */}
      {cartCount > 0 && !cartOpen && !editing && (
        <button onClick={() => setCartOpen(true)} className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-mauve px-6 py-3.5 text-sm font-medium text-cream shadow-2xl">
          <ShoppingBag className="h-4 w-4" />
          <span>{cartCount} {cartCount === 1 ? "item" : "itens"}</span>
          <span className="opacity-70">·</span>
          <span>{brl(total)}</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  // Owner that hasn't entered edit mode → show floating "Edit" button.
  if (!editing) {
    return (
      <>
        {storefrontBody}
        {isOwner && session && (
          <div className="fixed right-4 top-4 z-40 flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/90 px-3 py-2 text-xs font-medium text-mauve shadow-sm backdrop-blur hover:border-rose/50"
            >
              ← Painel
            </Link>
            <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-full bg-mauve px-4 py-2 text-xs font-medium text-cream shadow-lg hover:opacity-90">
              <Pencil className="h-3.5 w-3.5" /> Editar vitrine
            </button>
          </div>
        )}
        {cartOpen && (
          <CartDrawer cart={cart} total={total} updateQty={updateQty} onClose={() => setCartOpen(false)} onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }} />
        )}
        {checkoutOpen && (
          <CheckoutModal shop={shop} cart={cart} total={total} onClose={() => setCheckoutOpen(false)} onSuccess={() => { setCart([]); setCheckoutOpen(false); }} />
        )}
      </>
    );
  }

  // EDIT MODE: side rail + framed mobile preview.
  return (
    <div className="min-h-screen bg-[oklch(0.96_0.005_60)]">
      {/* Top bar */}
      <header className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-border bg-cream/95 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-rose" />
          <span className="font-display text-base italic text-mauve">Editor de vitrine</span>
          {dirty && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">não salvo</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-border bg-white p-0.5">
            <button onClick={() => setDevice("mobile")} className={`rounded-full p-1.5 ${device === "mobile" ? "bg-mauve text-cream" : "text-mauve"}`} title="Mobile"><Smartphone className="h-3.5 w-3.5" /></button>
            <button onClick={() => setDevice("desktop")} className={`rounded-full p-1.5 ${device === "desktop" ? "bg-mauve text-cream" : "text-mauve"}`} title="Desktop"><Monitor className="h-3.5 w-3.5" /></button>
          </div>
          <button
            onClick={() => {
              setEditing(false);
              if (typeof window !== "undefined") {
                const url = new URL(window.location.href);
                url.searchParams.delete("edit");
                window.history.replaceState({}, "", url.pathname + url.search);
              }
            }}
            className="rounded-full border border-border bg-white px-3 py-1.5 text-xs text-mauve hover:border-rose/50"
            title="Ver vitrine como cliente"
          >
            <Eye className="inline h-3 w-3 mr-1" /> Ver pública
          </button>
          <button
            onClick={() => setShareOpen(true)}
            className="rounded-full border border-border bg-white px-3 py-1.5 text-xs text-mauve hover:border-rose/50"
            title="Compartilhar com QR Code"
          >
            <QrCode className="inline h-3 w-3 mr-1" /> Compartilhar
          </button>
          <Link
            to="/"
            className="rounded-full border border-border bg-white px-3 py-1.5 text-xs text-mauve hover:border-rose/50"
            title="Voltar ao painel"
          >
            ← Painel
          </Link>
          <button onClick={save} disabled={saving || !dirty} className="inline-flex items-center gap-1.5 rounded-full bg-mauve px-4 py-1.5 text-xs font-semibold text-cream disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Publicar
          </button>
        </div>
      </header>

      {/* Preview ocupa toda largura disponível */}
      <div className="p-3 sm:p-4">
        <div className="overflow-hidden rounded-3xl border border-border bg-white">
          <div className={`mx-auto h-[calc(100vh-110px)] overflow-y-auto bg-cream ${device === "mobile" ? "max-w-[420px] border-x border-border" : "w-full"}`}>
            {storefrontBody}
          </div>
        </div>
      </div>

      {/* Painel flutuante de edição (fixo na tela) */}
      <aside
        className={`fixed bottom-4 right-4 z-40 w-[320px] max-w-[calc(100vw-2rem)] transition-transform duration-300 ${panelOpen ? "translate-y-0" : "translate-y-[calc(100%+1rem)]"}`}
      >
        <div className="card-soft overflow-hidden p-0 shadow-2xl border border-border">
          <div className="flex items-center border-b border-border bg-cream/95 backdrop-blur">
            {([
              { k: "template", l: "Template", i: <LayoutTemplate className="h-3.5 w-3.5" /> },
              { k: "sections", l: "Seções", i: <Eye className="h-3.5 w-3.5" /> },
              { k: "design", l: "Design", i: <Palette className="h-3.5 w-3.5" /> },
            ] as const).map((t) => (
              <button key={t.k} onClick={() => setEditorTab(t.k)}
                className={`flex flex-1 items-center justify-center gap-1 px-2 py-2.5 text-[11px] font-medium transition ${editorTab === t.k ? "bg-mauve text-cream" : "text-mauve hover:bg-rose/10"}`}>
                {t.i}{t.l}
              </button>
            ))}
            <button
              onClick={() => setPanelOpen(false)}
              className="px-2 py-2.5 text-mauve/70 hover:text-mauve hover:bg-rose/10"
              title="Recolher painel"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-3 bg-white">
            {editorTab === "template" && (
              <div className="grid gap-2">
                <p className="text-[10px] uppercase tracking-widest text-rose mb-1">Escolha um ponto de partida</p>
                {Object.values(TEMPLATES).map((tpl) => {
                  const active = front.template === tpl.key;
                  const p = PRESETS[tpl.theme.preset];
                  return (
                    <button key={tpl.key} onClick={() => applyTemplate(tpl.key)}
                      className={`flex items-center gap-3 rounded-2xl border p-2.5 text-left transition ${active ? "border-mauve bg-blush/30" : "border-border hover:border-rose/40 bg-white"}`}>
                      <div className="flex flex-col gap-1">
                        <span className="block h-4 w-4 rounded-full" style={{ background: p.primary }} />
                        <span className="block h-4 w-4 rounded-full" style={{ background: p.accent }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-mauve" style={{ fontFamily: FONTS[tpl.theme.font].family }}>{tpl.label}</p>
                        <p className="text-[10px] text-mauve/60 truncate">{tpl.description}</p>
                      </div>
                      {active && <Check className="h-4 w-4 text-mauve flex-none" />}
                    </button>
                  );
                })}
              </div>
            )}

            {editorTab === "sections" && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-widest text-rose mb-1">Mostre, esconda e reordene</p>
                {front.sections_config.map((s, idx) => (
                  <div key={s.key} className="flex items-center gap-2 rounded-xl border border-border bg-white px-2 py-1.5">
                    <GripVertical className="h-3.5 w-3.5 text-mauve/40" />
                    <span className="flex-1 text-xs text-mauve">{SECTION_LABELS[s.key]}</span>
                    <div className="flex gap-0.5">
                      <button disabled={idx === 0} onClick={() => {
                        const next = [...front.sections_config]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; update("sections_config", next);
                      }} className="grid h-6 w-6 place-items-center rounded text-mauve hover:bg-rose/20 disabled:opacity-30"><ChevronUp className="h-3 w-3" /></button>
                      <button disabled={idx === front.sections_config.length - 1} onClick={() => {
                        const next = [...front.sections_config]; [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]]; update("sections_config", next);
                      }} className="grid h-6 w-6 place-items-center rounded text-mauve hover:bg-rose/20 disabled:opacity-30"><ChevronDown className="h-3 w-3" /></button>
                      <button onClick={() => {
                        const next = front.sections_config.map((x, i) => i === idx ? { ...x, visible: !x.visible } : x);
                        update("sections_config", next);
                      }} className={`grid h-6 w-6 place-items-center rounded ${s.visible ? "text-mauve hover:bg-rose/20" : "text-mauve/30 hover:bg-rose/10"}`}>
                        {s.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {editorTab === "design" && (
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-rose mb-2">Paleta</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(Object.keys(PRESETS) as ThemePresetKey[]).map((k) => {
                      const p = PRESETS[k];
                      const active = (theme.preset ?? "rose") === k;
                      return (
                        <button key={k} onClick={() => updateTheme({ ...theme, preset: k, primary: undefined, accent: undefined, background: undefined })}
                          className={`flex flex-col items-start gap-1 rounded-xl border p-2 ${active ? "border-mauve" : "border-border hover:border-rose/40"}`}>
                          <div className="flex gap-0.5">
                            <span className="h-3.5 w-3.5 rounded-full" style={{ background: p.primary }} />
                            <span className="h-3.5 w-3.5 rounded-full" style={{ background: p.accent }} />
                          </div>
                          <span className="text-[10px] font-medium text-mauve">{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-rose mb-2 flex items-center gap-1"><Type className="h-3 w-3" /> Fonte de títulos</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(FONTS) as FontKey[]).map((k) => {
                      const f = FONTS[k];
                      const active = (theme.font ?? "playfair") === k;
                      return (
                        <button key={k} onClick={() => updateTheme({ ...theme, font: k })}
                          className={`rounded-xl border p-2 text-center ${active ? "border-mauve" : "border-border hover:border-rose/40"}`}
                          style={{ fontFamily: f.family }}>
                          <p className="text-base italic text-mauve leading-none">Aa</p>
                          <p className="mt-0.5 text-[9px] text-muted-foreground">{f.label}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* FAB para reabrir painel quando recolhido */}
      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-1.5 rounded-full bg-mauve px-4 py-3 text-xs font-semibold text-cream shadow-2xl hover:opacity-90"
        >
          <Palette className="h-3.5 w-3.5" /> Editar
        </button>
      )}
      {shareOpen && (
        <ShareModal
          url={typeof window !== "undefined" ? `${window.location.origin}/loja/${shop.slug}` : ""}
          shopName={shop.name}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}

function ShareModal({ url, shopName, onClose }: { url: string; shopName: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success("Link copiado");
    } catch { toast.error("Não foi possível copiar"); }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-mauve/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-cream p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl italic text-mauve">Compartilhar vitrine</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-rose/30"><X className="h-4 w-4 text-mauve" /></button>
        </div>
        <div className="grid place-items-center rounded-2xl bg-white p-6 shadow-sm">
          <QRCodeSVG value={url} size={192} bgColor="transparent" fgColor="#5b3a4a" />
        </div>
        <p className="mt-4 text-center text-xs text-mauve/70">Aponte a câmera para visitar <strong className="text-mauve">{shopName}</strong></p>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-white border border-border px-3 py-2 text-xs text-mauve">
          <span className="truncate flex-1">{url}</span>
          <button onClick={copy} className="inline-flex items-center gap-1 rounded-lg bg-mauve px-2.5 py-1 text-cream hover:opacity-90">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
        <a
          href={url} target="_blank" rel="noreferrer"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-full border border-border bg-white py-2.5 text-xs text-mauve hover:border-rose/50"
        >
          <Eye className="h-3.5 w-3.5" /> Abrir em nova aba
        </a>
      </div>
    </div>
  );
}

// ---------- Section building blocks ----------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-2xl italic text-mauve mb-4">{children}</h2>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-5xl px-5 py-6">
      <SectionHeading>{title}</SectionHeading>
      {children}
    </section>
  );
}

function ContactRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white/60 border border-rose/20 px-3 py-2.5">
      <span className="text-rose">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Hero({
  shop, front, editing, heroTitle, heroSubtitle, onTitle, onSubtitle, onBanner,
}: {
  shop: Shop; front: Storefront; editing: boolean;
  heroTitle: string; heroSubtitle: string;
  onTitle: (v: string) => void; onSubtitle: (v: string) => void;
  onBanner: (f: File) => void;
}) {
  return (
    <header className="relative overflow-hidden">
      <EditableImage
        editing={editing}
        src={front.banner_url}
        alt=""
        aspect="aspect-[16/7] sm:aspect-[16/6]"
        onUpload={onBanner}
        fallback={<div className="grid h-full w-full place-items-center bg-gradient-to-br from-blush via-cream to-rose/40"><ImagePlus className="h-10 w-10 text-mauve/30" /></div>}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-cream via-cream/40 to-transparent pointer-events-none" />
      <div className="relative -mt-16 mx-auto max-w-5xl px-5">
        <div className="flex flex-col items-center gap-3 text-center">
          {shop.logo_url ? (
            <img src={shop.logo_url} alt={shop.name} className="h-20 w-20 rounded-3xl border-4 border-cream object-cover shadow-lg" />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-3xl border-4 border-cream bg-rose shadow-lg"><Cake className="h-9 w-9 text-mauve" strokeWidth={1.3} /></div>
          )}
          <EditableText
            editing={editing}
            value={heroTitle}
            onChange={onTitle}
            as="h1"
            className="font-brand text-4xl text-mauve md:text-5xl"
            placeholder="Nome da sua loja"
          />
          <EditableText
            editing={editing}
            value={heroSubtitle}
            onChange={onSubtitle}
            as="p"
            className="max-w-xl text-sm text-mauve/80"
            placeholder="Uma frase curta sobre você"
          />
        </div>
      </div>
    </header>
  );
}

function PromotionsSection({
  promotions, editing, onChange,
}: {
  promotions: Promotion[]; editing: boolean; onChange: (p: Promotion[]) => void;
}) {
  if (!editing && promotions.length === 0) return null;
  return (
    <Section title="Promoções">
      <div className="grid gap-2 sm:grid-cols-2">
        {promotions.map((p) => (
          <div key={p.id} className="rounded-2xl border border-rose/30 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <EditableText editing={editing} value={p.title} onChange={(v) => onChange(promotions.map((x) => x.id === p.id ? { ...x, title: v } : x))} className="text-sm font-medium text-mauve flex-1" placeholder="Nome do produto em promoção" />
              {editing && (
                <button onClick={() => onChange(promotions.filter((x) => x.id !== p.id))} className="text-rose hover:text-rose/70"><X className="h-4 w-4" /></button>
              )}
            </div>
            {editing ? (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <label className="text-mauve/60">De</label>
                <input
                  type="number" step="0.01" defaultValue={p.price_from ?? ""}
                  onBlur={(e) => onChange(promotions.map((x) => x.id === p.id ? { ...x, price_from: Number(e.target.value) || undefined } : x))}
                  className="w-20 rounded-lg border border-rose/30 bg-white px-2 py-1 text-right"
                />
                <label className="text-mauve/60">Por</label>
                <input
                  type="number" step="0.01" defaultValue={p.price_to ?? ""}
                  onBlur={(e) => onChange(promotions.map((x) => x.id === p.id ? { ...x, price_to: Number(e.target.value) || undefined } : x))}
                  className="w-20 rounded-lg border border-rose/30 bg-white px-2 py-1 text-right"
                />
              </div>
            ) : (
              (p.price_from || p.price_to) && (
                <p className="text-xs text-mauve/70 mt-1">
                  {p.price_from && <span className="line-through opacity-70 mr-1">{brl(p.price_from)}</span>}
                  {p.price_to && <span className="font-semibold text-mauve">{brl(p.price_to)}</span>}
                </p>
              )
            )}
            {editing && (
              <p className="mt-1.5 text-[10px] text-mauve/50">Dica: use o nome exato do produto do catálogo para aparecer com selo PROMO no card.</p>
            )}
          </div>
        ))}
        {editing && (
          <button onClick={() => onChange([...promotions, { id: crypto.randomUUID(), title: "Nova promoção" }])}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-rose/40 bg-blush/20 p-3 text-xs text-mauve hover:bg-blush/40">
            <Plus className="h-3.5 w-3.5" /> Adicionar promoção
          </button>
        )}
      </div>
    </Section>
  );
}

function GallerySection({
  gallery, editing, onAdd, onRemove,
}: {
  gallery: GalleryItem[]; editing: boolean;
  onAdd: (f: File) => void; onRemove: (id: string) => void;
}) {
  if (!editing && gallery.length === 0) return null;
  return (
    <Section title="Galeria">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {gallery.map((g) => (
          <div key={g.id} className="group relative aspect-square overflow-hidden rounded-2xl bg-blush">
            <img src={g.url} alt={g.caption ?? ""} className="h-full w-full object-cover transition group-hover:scale-105" />
            {editing && (
              <button onClick={() => onRemove(g.id)} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-mauve/80 text-cream opacity-0 group-hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        {editing && (
          <label className="flex aspect-square cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-rose/40 bg-blush/20 hover:bg-blush/40">
            <ImagePlus className="h-6 w-6 text-mauve/60" />
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onAdd(f); e.currentTarget.value = ""; }} />
          </label>
        )}
      </div>
    </Section>
  );
}

function TestimonialsSection({
  testimonials, editing, onChange,
}: {
  testimonials: Testimonial[]; editing: boolean; onChange: (t: Testimonial[]) => void;
}) {
  if (!editing && testimonials.length === 0) return null;
  return (
    <Section title="Depoimentos">
      <div className="grid gap-3 sm:grid-cols-2">
        {testimonials.map((t) => (
          <article key={t.id} className="relative rounded-3xl border border-rose/30 bg-white p-4">
            <Quote className="absolute right-3 top-3 h-5 w-5 text-rose/30" />
            <EditableText editing={editing} value={t.text} onChange={(v) => onChange(testimonials.map((x) => x.id === t.id ? { ...x, text: v } : x))}
              as="p" multiline className="text-sm text-mauve/80 italic mb-2" placeholder="O que essa pessoa disse?" />
            <EditableText editing={editing} value={t.name} onChange={(v) => onChange(testimonials.map((x) => x.id === t.id ? { ...x, name: v } : x))}
              as="p" className="text-xs font-medium text-mauve" placeholder="— Nome" />
            {editing && (
              <button onClick={() => onChange(testimonials.filter((x) => x.id !== t.id))} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-mauve text-cream"><X className="h-3 w-3" /></button>
            )}
          </article>
        ))}
        {editing && (
          <button onClick={() => onChange([...testimonials, { id: crypto.randomUUID(), name: "", text: "" }])}
            className="flex items-center justify-center gap-1.5 rounded-3xl border-2 border-dashed border-rose/40 bg-blush/20 p-6 text-xs text-mauve hover:bg-blush/40">
            <Plus className="h-3.5 w-3.5" /> Adicionar depoimento
          </button>
        )}
      </div>
    </Section>
  );
}

// ---------- Cart + checkout (kept from previous version) ----------

function CartDrawer({
  cart, total, updateQty, onClose, onCheckout,
}: {
  cart: CartItem[]; total: number;
  updateQty: (id: string, d: number) => void;
  onClose: () => void; onCheckout: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-mauve/40 backdrop-blur-sm md:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-t-3xl bg-cream md:rounded-3xl">
        <div className="flex items-center justify-between border-b border-rose/30 px-5 py-4">
          <h2 className="font-display text-xl italic text-mauve">Seu pedido</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-rose/30"><X className="h-4 w-4 text-mauve" /></button>
        </div>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto p-5">
          {cart.map((item) => (
            <div key={item.recipe_id} className="flex items-center gap-3 rounded-2xl bg-white p-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-blush">
                {item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center"><Cake className="h-5 w-5 text-mauve/50" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-mauve">{item.name}</p>
                <p className="text-xs text-mauve/60">{brl(item.price)}</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-rose/40 bg-white px-1 py-0.5">
                <button onClick={() => updateQty(item.recipe_id, -1)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-rose/30"><Minus className="h-3 w-3 text-mauve" /></button>
                <span className="w-6 text-center text-sm font-medium text-mauve">{item.qty}</span>
                <button onClick={() => updateQty(item.recipe_id, +1)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-rose/30"><Plus className="h-3 w-3 text-mauve" /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-3 border-t border-rose/30 bg-white p-5">
          <div className="flex items-center justify-between"><span className="text-sm text-mauve/70">Total</span><span className="font-display text-2xl italic text-mauve">{brl(total)}</span></div>
          <button onClick={onCheckout} className="w-full rounded-full bg-mauve py-3.5 text-sm font-medium text-cream hover:opacity-95">Continuar para meus dados</button>
        </div>
      </div>
    </div>
  );
}

function CheckoutModal({
  shop, cart, total, onClose, onSuccess,
}: {
  shop: Shop; cart: CartItem[]; total: number;
  onClose: () => void; onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [method, setMethod] = useState<"pickup" | "delivery">("pickup");
  const [deliveryAt, setDeliveryAt] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const parsed = checkoutSchema.safeParse({ name, phone, address, notes });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
    if (method === "delivery" && !parsed.data.address) return toast.error("Informe o endereço de entrega");
    if (!deliveryAt) return toast.error("Escolha data e hora");
    if (cart.length === 0) return toast.error("Carrinho vazio");
    const when = new Date(deliveryAt);
    if (isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) return toast.error("Escolha uma data futura");
    setSubmitting(true);
    try {
      const { data: existing } = await supabase.from("customers").select("id").eq("shop_id", shop.id).eq("phone", phone.trim()).maybeSingle();
      let customerId = existing?.id ?? null;
      if (!customerId) {
        const { data: newCust } = await supabase.from("customers")
          .insert({ shop_id: shop.id, name: name.trim(), phone: phone.trim(), address: address.trim() || "—", source: "storefront" })
          .select("id").single();
        customerId = newCust?.id ?? null;
      }
      const description = cart.map((i) => `${i.qty}x ${i.name}`).join(", ");
      const { error: orderErr } = await supabase.from("orders").insert({
        shop_id: shop.id, customer_id: customerId,
        customer_name: name.trim(), customer_phone: phone.trim(),
        description, delivery_at: new Date(deliveryAt).toISOString(),
        delivery_address: method === "delivery" ? address.trim() : null,
        delivery_method: method, total_price: total, deposit_paid: 0,
        status: "orcamento", source: "storefront",
        notes: notes.trim() || null, items: cart,
      });
      if (orderErr) { toast.error("Não foi possível enviar o pedido"); setSubmitting(false); return; }

      const lines = [
        `*Novo pedido — ${shop.name}*`, ``,
        `*Cliente:* ${name}`, `*WhatsApp:* ${phone}`,
        `*Modo:* ${method === "pickup" ? "Retirada" : "Entrega"}`,
        method === "delivery" ? `*Endereço:* ${address}` : null,
        `*Data:* ${new Date(deliveryAt).toLocaleString("pt-BR")}`, ``,
        `*Itens:*`, ...cart.map((i) => `• ${i.qty}x ${i.name} — ${brl(i.price * i.qty)}`),
        ``, `*Total:* ${brl(total)}`,
        notes ? `\n_Obs:_ ${notes}` : null,
      ].filter(Boolean).join("\n");
      const wa = (shop.whatsapp ?? "").replace(/\D/g, "");
      const url = wa ? `https://wa.me/${wa}?text=${encodeURIComponent(lines)}` : `https://wa.me/?text=${encodeURIComponent(lines)}`;
      window.open(url, "_blank");
      toast.success("Pedido enviado!");
      onSuccess();
    } catch (e) {
      toast.error("Erro inesperado");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-mauve/50 backdrop-blur-sm md:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-cream md:rounded-3xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-rose/30 bg-cream px-5 py-4">
          <h2 className="font-display text-xl italic text-mauve">Seus dados</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-rose/30"><X className="h-4 w-4 text-mauve" /></button>
        </div>
        <div className="space-y-4 p-5">
          <CkField icon={<User className="h-4 w-4" />} label="Seu nome">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria Silva" className="storefront-input" />
          </CkField>
          <CkField icon={<Phone className="h-4 w-4" />} label="WhatsApp">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" className="storefront-input" />
          </CkField>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-mauve/70">Como deseja receber?</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMethod("pickup")} className={`rounded-2xl border-2 p-3 text-sm transition ${method === "pickup" ? "border-mauve bg-mauve text-cream" : "border-rose/40 bg-white text-mauve hover:border-rose"}`}>Retirada</button>
              <button onClick={() => setMethod("delivery")} className={`rounded-2xl border-2 p-3 text-sm transition ${method === "delivery" ? "border-mauve bg-mauve text-cream" : "border-rose/40 bg-white text-mauve hover:border-rose"}`}>Entrega</button>
            </div>
          </div>
          {method === "delivery" && (
            <CkField icon={<MapPin className="h-4 w-4" />} label="Endereço">
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro" className="storefront-input" />
            </CkField>
          )}
          <CkField label="Data e hora desejada">
            <input type="datetime-local" value={deliveryAt} onChange={(e) => setDeliveryAt(e.target.value)} className="storefront-input" />
          </CkField>
          <CkField label="Observações (opcional)">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Sabor, mensagem, alergia..." className="storefront-input resize-none" />
          </CkField>
          <div className="rounded-2xl bg-blush/40 p-3 text-sm text-mauve">
            <div className="flex items-center justify-between"><span>Total estimado</span><span className="font-display text-xl italic">{brl(total)}</span></div>
            <p className="mt-1 text-xs text-mauve/70">A loja confirmará o valor final.</p>
          </div>
          <button onClick={submit} disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-full bg-mauve py-3.5 text-sm font-medium text-cream hover:opacity-95 disabled:opacity-60">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            Enviar pedido pelo WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

function CkField({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-mauve/70">{icon}{label}</span>
      {children}
    </label>
  );
}
