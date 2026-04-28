import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ShoppingBag,
  Plus,
  Minus,
  X,
  MapPin,
  Phone,
  User,
  MessageCircle,
  Loader2,
  Search,
  ChevronRight,
  Cake,
  Pencil,
  Instagram,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { StorefrontEditor, type StorefrontDraft } from "@/components/StorefrontEditor";
import { applyTheme, type ShopTheme } from "@/lib/theme";

const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(80),
  phone: z
    .string()
    .trim()
    .min(8, "WhatsApp inválido")
    .max(20)
    .regex(/^[\d\s()+\-]+$/, "Apenas números e símbolos"),
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
  id: string;
  name: string;
  slug: string;
  whatsapp: string | null;
  description: string | null;
  logo_url: string | null;
  theme: ShopTheme | null;
};

const EMPTY_DRAFT: StorefrontDraft = {
  hero_title: null,
  hero_subtitle: null,
  banner_url: null,
  social: {},
};

type PublicRecipe = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  public_price: number | null;
  servings: number | null;
};

type CartItem = {
  recipe_id: string;
  name: string;
  price: number;
  qty: number;
  image_url: string | null;
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function StorefrontPage() {
  const { slug } = Route.useParams();
  const { session, shops } = useAuth();
  const [shop, setShop] = useState<Shop | null>(null);
  const [recipes, setRecipes] = useState<PublicRecipe[]>([]);
  const [draft, setDraft] = useState<StorefrontDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const isOwner = !!shop && shops.some((m) => m.shop_id === shop.id && (m.role === "owner" || m.role === "manager"));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: shopData, error: shopErr } = await supabase
        .from("shops")
        .select("id, name, slug, whatsapp, description, logo_url, theme")
        .eq("slug", slug)
        .maybeSingle();
      if (cancelled) return;
      if (shopErr || !shopData) {
        setLoading(false);
        return;
      }
      setShop(shopData as Shop);
      // Apply theme for visitors
      applyTheme((shopData.theme ?? null) as ShopTheme | null);

      const [recsRes, sfRes] = await Promise.all([
        supabase
          .from("recipes")
          .select("id, name, description, image_url, public_price, servings")
          .eq("shop_id", shopData.id)
          .eq("show_in_catalog", true)
          .order("name"),
        supabase
          .from("shop_storefront")
          .select("hero_title, hero_subtitle, banner_url, social")
          .eq("shop_id", shopData.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setRecipes((recsRes.data ?? []) as PublicRecipe[]);
      const sf = sfRes.data as any;
      setDraft({
        hero_title: sf?.hero_title ?? null,
        hero_subtitle: sf?.hero_subtitle ?? null,
        banner_url: sf?.banner_url ?? null,
        social: sf?.social ?? {},
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const onDraftChange = useCallback((d: StorefrontDraft) => setDraft(d), []);


  const addToCart = (r: PublicRecipe) => {
    if (r.public_price == null) {
      toast.error("Produto sem preço, fale com a loja.");
      return;
    }
    setCart((prev) => {
      const found = prev.find((i) => i.recipe_id === r.id);
      if (found) {
        return prev.map((i) =>
          i.recipe_id === r.id ? { ...i, qty: i.qty + 1 } : i,
        );
      }
      return [
        ...prev,
        { recipe_id: r.id, name: r.name, price: r.public_price!, qty: 1, image_url: r.image_url },
      ];
    });
    toast.success(`${r.name} adicionado`);
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.recipe_id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0),
    );
  };

  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const filtered = recipes.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  );

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
        <p className="text-muted-foreground">O link "{slug}" não está disponível.</p>
        <Link to="/" className="mt-2 rounded-full bg-rose px-6 py-3 text-sm text-mauve">Voltar</Link>
      </div>
    );
  }

  const heroTitle = draft.hero_title || shop.name;
  const heroSubtitle = draft.hero_subtitle || shop.description;

  return (
    <div className={`floral-bg min-h-screen pb-32 ${editing ? "lg:pr-[24rem]" : ""}`}>
      {/* Owner edit bar */}
      {isOwner && session && !editing && (
        <button
          onClick={() => setEditing(true)}
          className="fixed right-4 top-4 z-40 inline-flex items-center gap-1.5 rounded-full bg-mauve px-4 py-2 text-xs font-medium text-cream shadow-lg hover:opacity-90"
        >
          <Pencil className="h-3.5 w-3.5" /> Editar vitrine
        </button>
      )}

      {/* Hero */}
      <header className="relative overflow-hidden">
        {draft.banner_url ? (
          <div className="relative">
            <img src={draft.banner_url} alt="" className="h-48 w-full object-cover sm:h-64 md:h-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-cream via-cream/60 to-transparent" />
          </div>
        ) : null}
        <div className={`bg-gradient-to-br from-blush via-cream to-rose/40 ${draft.banner_url ? "" : ""}`}>
          <div className="mx-auto max-w-5xl px-6 py-10 md:py-14">
            <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-end md:gap-6 md:text-left">
              {shop.logo_url ? (
                <img
                  src={shop.logo_url}
                  alt={shop.name}
                  className="h-24 w-24 rounded-3xl border-4 border-cream object-cover shadow-lg md:h-28 md:w-28"
                />
              ) : (
                <div className="grid h-24 w-24 place-items-center rounded-3xl border-4 border-cream bg-rose shadow-lg md:h-28 md:w-28">
                  <Cake className="h-10 w-10 text-mauve" strokeWidth={1.3} />
                </div>
              )}
              <div className="flex-1">
                <p className="text-xs uppercase tracking-widest text-mauve/70">Vitrine</p>
                <h1 className="font-display text-4xl italic text-mauve md:text-5xl">{heroTitle}</h1>
                {heroSubtitle && (
                  <p className="mt-2 max-w-xl text-sm text-mauve/80">{heroSubtitle}</p>
                )}
                {(draft.social.instagram || draft.social.address || draft.social.hours) && (
                  <div className="mt-3 flex flex-wrap justify-center gap-3 text-[11px] text-mauve/70 md:justify-start">
                    {draft.social.instagram && (
                      <span className="inline-flex items-center gap-1"><Instagram className="h-3 w-3" /> {draft.social.instagram}</span>
                    )}
                    {draft.social.address && (
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {draft.social.address}</span>
                    )}
                    {draft.social.hours && (
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {draft.social.hours}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="sticky top-0 z-20 border-b border-rose/30 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mauve/50" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar bolo, doce..."
              className="w-full rounded-full border border-rose/40 bg-white py-2.5 pl-10 pr-4 text-sm text-mauve placeholder:text-mauve/40 focus:border-rose focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Catalog grid */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        {filtered.length === 0 ? (
          <div className="card-soft p-10 text-center text-mauve/70">
            <Cake className="mx-auto mb-3 h-10 w-10 text-mauve/30" strokeWidth={1.2} />
            <p>Nenhum produto disponível no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <article
                key={r.id}
                className="group flex flex-col overflow-hidden rounded-3xl border border-rose/30 bg-white shadow-sm transition hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-blush">
                  {r.image_url ? (
                    <img
                      src={r.image_url}
                      alt={r.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center">
                      <Cake className="h-12 w-12 text-mauve/40" strokeWidth={1.2} />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h3 className="font-display text-lg italic text-mauve">{r.name}</h3>
                  {r.description && (
                    <p className="line-clamp-2 text-xs text-mauve/70">{r.description}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="text-base font-semibold text-mauve">
                      {r.public_price != null ? brl(r.public_price) : "Sob consulta"}
                    </span>
                    <button
                      onClick={() => addToCart(r)}
                      className="inline-flex items-center gap-1 rounded-full bg-mauve px-4 py-2 text-xs font-medium text-cream transition hover:opacity-90"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Floating cart button */}
      {cartCount > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-mauve px-6 py-3.5 text-sm font-medium text-cream shadow-2xl transition hover:opacity-95"
        >
          <ShoppingBag className="h-4 w-4" />
          <span>{cartCount} {cartCount === 1 ? "item" : "itens"}</span>
          <span className="opacity-70">·</span>
          <span>{brl(total)}</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-mauve/40 backdrop-blur-sm md:items-center">
          <div className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-t-3xl bg-cream md:rounded-3xl">
            <div className="flex items-center justify-between border-b border-rose/30 px-5 py-4">
              <h2 className="font-display text-xl italic text-mauve">Seu pedido</h2>
              <button onClick={() => setCartOpen(false)} className="rounded-full p-1.5 hover:bg-rose/30">
                <X className="h-4 w-4 text-mauve" />
              </button>
            </div>
            <div className="max-h-[50vh] space-y-2 overflow-y-auto p-5">
              {cart.map((item) => (
                <div key={item.recipe_id} className="flex items-center gap-3 rounded-2xl bg-white p-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-blush">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center"><Cake className="h-5 w-5 text-mauve/50" /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-mauve">{item.name}</p>
                    <p className="text-xs text-mauve/60">{brl(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-rose/40 bg-white px-1 py-0.5">
                    <button onClick={() => updateQty(item.recipe_id, -1)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-rose/30">
                      <Minus className="h-3 w-3 text-mauve" />
                    </button>
                    <span className="w-6 text-center text-sm font-medium text-mauve">{item.qty}</span>
                    <button onClick={() => updateQty(item.recipe_id, +1)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-rose/30">
                      <Plus className="h-3 w-3 text-mauve" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3 border-t border-rose/30 bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-mauve/70">Total</span>
                <span className="font-display text-2xl italic text-mauve">{brl(total)}</span>
              </div>
              <button
                onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}
                className="w-full rounded-full bg-mauve py-3.5 text-sm font-medium text-cream hover:opacity-95"
              >
                Continuar para meus dados
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout modal */}
      {checkoutOpen && (
        <CheckoutModal
          shop={shop}
          cart={cart}
          total={total}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={() => { setCart([]); setCheckoutOpen(false); }}
        />
      )}

      <footer className="mx-auto max-w-5xl px-6 pb-8 pt-4 text-center text-xs text-mauve/50">
        Pedidos enviados via WhatsApp — sujeitos à confirmação da loja.
      </footer>
    </div>
  );
}

function CheckoutModal({
  shop,
  cart,
  total,
  onClose,
  onSuccess,
}: {
  shop: Shop;
  cart: CartItem[];
  total: number;
  onClose: () => void;
  onSuccess: () => void;
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
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    if (method === "delivery" && !parsed.data.address) {
      toast.error("Informe o endereço de entrega");
      return;
    }
    if (!deliveryAt) {
      toast.error("Escolha data e hora");
      return;
    }
    if (cart.length === 0) {
      toast.error("Carrinho vazio");
      return;
    }
    const when = new Date(deliveryAt);
    if (isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
      toast.error("Escolha uma data futura");
      return;
    }
    setSubmitting(true);
    try {
      // Try to find existing customer by phone
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("shop_id", shop.id)
        .eq("phone", phone.trim())
        .maybeSingle();

      let customerId = existing?.id ?? null;
      if (!customerId) {
        const { data: newCust, error: custErr } = await supabase
          .from("customers")
          .insert({
            shop_id: shop.id,
            name: name.trim(),
            phone: phone.trim(),
            address: address.trim() || "—",
            source: "storefront",
          })
          .select("id")
          .single();
        if (custErr) {
          // anon may not see existing customer; just continue without customer_id
          console.warn("customer insert failed", custErr.message);
        } else {
          customerId = newCust.id;
        }
      }

      const description = cart
        .map((i) => `${i.qty}x ${i.name}`)
        .join(", ");

      const { error: orderErr } = await supabase.from("orders").insert({
        shop_id: shop.id,
        customer_id: customerId,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        description,
        delivery_at: new Date(deliveryAt).toISOString(),
        delivery_address: method === "delivery" ? address.trim() : null,
        delivery_method: method,
        total_price: total,
        deposit_paid: 0,
        status: "orcamento",
        source: "storefront",
        notes: notes.trim() || null,
        items: cart,
      });

      if (orderErr) {
        toast.error("Não foi possível enviar o pedido");
        console.error(orderErr);
        setSubmitting(false);
        return;
      }

      // Build WhatsApp message
      const lines = [
        `*Novo pedido — ${shop.name}*`,
        ``,
        `*Cliente:* ${name}`,
        `*WhatsApp:* ${phone}`,
        `*Modo:* ${method === "pickup" ? "Retirada" : "Entrega"}`,
        method === "delivery" ? `*Endereço:* ${address}` : null,
        `*Data:* ${new Date(deliveryAt).toLocaleString("pt-BR")}`,
        ``,
        `*Itens:*`,
        ...cart.map((i) => `• ${i.qty}x ${i.name} — ${brl(i.price * i.qty)}`),
        ``,
        `*Total:* ${brl(total)}`,
        notes ? `\n_Obs:_ ${notes}` : null,
      ].filter(Boolean).join("\n");

      const wa = (shop.whatsapp ?? "").replace(/\D/g, "");
      const url = wa
        ? `https://wa.me/${wa}?text=${encodeURIComponent(lines)}`
        : `https://wa.me/?text=${encodeURIComponent(lines)}`;
      window.open(url, "_blank");

      toast.success("Pedido enviado! Continue no WhatsApp.");
      onSuccess();
    } catch (e) {
      console.error(e);
      toast.error("Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-mauve/50 backdrop-blur-sm md:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-cream md:rounded-3xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-rose/30 bg-cream px-5 py-4">
          <h2 className="font-display text-xl italic text-mauve">Seus dados</h2>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-rose/30">
            <X className="h-4 w-4 text-mauve" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <Field icon={<User className="h-4 w-4" />} label="Seu nome">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Maria Silva"
              className="storefront-input"
            />
          </Field>
          <Field icon={<Phone className="h-4 w-4" />} label="WhatsApp">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="storefront-input"
            />
          </Field>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-mauve/70">Como deseja receber?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMethod("pickup")}
                className={`rounded-2xl border-2 p-3 text-sm transition ${
                  method === "pickup"
                    ? "border-mauve bg-mauve text-cream"
                    : "border-rose/40 bg-white text-mauve hover:border-rose"
                }`}
              >
                Retirada
              </button>
              <button
                onClick={() => setMethod("delivery")}
                className={`rounded-2xl border-2 p-3 text-sm transition ${
                  method === "delivery"
                    ? "border-mauve bg-mauve text-cream"
                    : "border-rose/40 bg-white text-mauve hover:border-rose"
                }`}
              >
                Entrega
              </button>
            </div>
          </div>

          {method === "delivery" && (
            <Field icon={<MapPin className="h-4 w-4" />} label="Endereço">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, bairro"
                className="storefront-input"
              />
            </Field>
          )}

          <Field label="Data e hora desejada">
            <input
              type="datetime-local"
              value={deliveryAt}
              onChange={(e) => setDeliveryAt(e.target.value)}
              className="storefront-input"
            />
          </Field>

          <Field label="Observações (opcional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Sabor, mensagem, alergia..."
              className="storefront-input resize-none"
            />
          </Field>

          <div className="rounded-2xl bg-blush/40 p-3 text-sm text-mauve">
            <div className="flex items-center justify-between">
              <span>Total estimado</span>
              <span className="font-display text-xl italic">{brl(total)}</span>
            </div>
            <p className="mt-1 text-xs text-mauve/70">A loja confirmará o valor final.</p>
          </div>

          <button
            onClick={submit}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-mauve py-3.5 text-sm font-medium text-cream transition hover:opacity-95 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            Enviar pedido pelo WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-mauve/70">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
