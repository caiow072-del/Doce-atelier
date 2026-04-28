import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Palette,
  Globe,
  Save,
  Loader2,
  Image as ImageIcon,
  Type,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Plus,
  Trash2,
  CalendarHeart,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import {
  PRESETS,
  FONTS,
  applyTheme,
  type ShopTheme,
  type ThemePresetKey,
  type FontKey,
} from "@/lib/theme";
import { uploadShopImage } from "@/lib/upload";

export const Route = createFileRoute("/vitrine")({
  head: () => ({
    meta: [
      { title: "Minha vitrine — Cakes Manager" },
      { name: "description", content: "Personalize sua loja virtual: marca, banners, promoções." },
    ],
  }),
  component: VitrinePage,
});

type Storefront = {
  shop_id: string;
  hero_title: string | null;
  hero_subtitle: string | null;
  banner_url: string | null;
  promotions: Array<{ id: string; title: string; price_from?: number; price_to?: number; valid_until?: string }>;
  social: { instagram?: string; address?: string; hours?: string };
};

type Tab = "marca" | "vitrine" | "promocoes" | "eventos";

function VitrinePage() {
  const { currentShop, refreshShops } = useAuth();
  const shopId = currentShop?.shop_id;
  const slug = currentShop?.shops.slug;

  const [tab, setTab] = useState<Tab>("marca");
  const [theme, setTheme] = useState<ShopTheme>(((currentShop?.shops as any)?.theme as ShopTheme) || { preset: "rose", font: "playfair" });
  const [front, setFront] = useState<Storefront | null>(null);
  const [events, setEvents] = useState<{ id: string; name: string; date: string; closed_at: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    Promise.all([
      supabase.from("shop_storefront").select("*").eq("shop_id", shopId).maybeSingle(),
      supabase.from("events").select("id, name, date, closed_at").eq("shop_id", shopId).is("closed_at", null).order("date").limit(20),
    ]).then(async ([sf, ev]) => {
      let row = sf.data as unknown as Storefront | null;
      if (!row) {
        const { data } = await supabase.from("shop_storefront").insert({
          shop_id: shopId,
          hero_title: currentShop?.shops.name ?? "Bem-vindo",
          hero_subtitle: "Doces feitos com carinho",
        }).select("*").single();
        row = data as Storefront;
      }
      setFront(row);
      setEvents((ev.data ?? []) as any);
      setLoading(false);
    });
  }, [shopId]);

  // Live preview
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = slug ? `${baseUrl}/loja/${slug}` : "";

  const saveTheme = async () => {
    if (!shopId) return;
    setSaving(true);
    const { error } = await supabase.from("shops").update({ theme: theme as any }).eq("id", shopId);
    setSaving(false);
    if (error) return toast.error("Erro ao salvar tema");
    toast.success("Tema salvo");
    await refreshShops();
  };

  const saveFront = async (patch: Partial<Storefront>) => {
    if (!shopId || !front) return;
    setFront({ ...front, ...patch });
    await supabase.from("shop_storefront").update(patch as any).eq("shop_id", shopId);
  };

  const onBannerUpload = async (file: File) => {
    if (!shopId) return;
    try {
      const url = await uploadShopImage("storefront-banners", shopId, file);
      await saveFront({ banner_url: url });
      toast.success("Banner atualizado");
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading || !front) {
    return (
      <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-mauve" /></div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Sua marca" title="Minha vitrine" subtitle="Personalize sua loja virtual e a vitrine de cada evento." />

      {/* Public URL */}
      <div className="card-soft flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blush to-rose">
            <Globe className="h-5 w-5 text-mauve" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-rose">Link público da loja</p>
            <p className="break-all text-sm text-mauve">{publicUrl || "—"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs text-mauve hover:border-rose/50">
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-3 py-2 text-xs text-cream hover:opacity-90">
            <ExternalLink className="h-3.5 w-3.5" /> Abrir
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {(["marca", "vitrine", "promocoes", "eventos"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${tab === t ? "bg-mauve text-cream" : "border border-border bg-card text-mauve hover:border-rose/40"}`}
          >
            {t === "marca" ? "Marca & Tema" : t === "vitrine" ? "Vitrine" : t === "promocoes" ? "Promoções" : "Vitrines de eventos"}
          </button>
        ))}
      </div>

      {tab === "marca" && (
        <section className="card-soft space-y-5 p-5">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-rose mb-2">Preset</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {(Object.keys(PRESETS) as ThemePresetKey[]).map((k) => {
                const p = PRESETS[k];
                const active = (theme.preset ?? "rose") === k;
                return (
                  <button
                    key={k}
                    onClick={() => setTheme({ ...theme, preset: k, primary: undefined, accent: undefined, background: undefined })}
                    className={`flex flex-col gap-1 rounded-2xl border p-3 text-left transition-colors ${active ? "border-mauve" : "border-border hover:border-rose/40"}`}
                  >
                    <div className="flex gap-1">
                      <span className="h-5 w-5 rounded-full" style={{ background: p.primary }} />
                      <span className="h-5 w-5 rounded-full" style={{ background: p.accent }} />
                      <span className="h-5 w-5 rounded-full border border-border" style={{ background: p.background }} />
                    </div>
                    <span className="text-xs font-medium text-mauve">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ColorField label="Cor primária" value={theme.primary ?? PRESETS[theme.preset ?? "rose"].primary} onChange={(v) => setTheme({ ...theme, primary: v })} />
            <ColorField label="Cor de destaque" value={theme.accent ?? PRESETS[theme.preset ?? "rose"].accent} onChange={(v) => setTheme({ ...theme, accent: v })} />
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-widest text-rose mb-2">Fonte de títulos</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(FONTS) as FontKey[]).map((k) => {
                const f = FONTS[k];
                const active = (theme.font ?? "playfair") === k;
                return (
                  <button
                    key={k}
                    onClick={() => setTheme({ ...theme, font: k })}
                    className={`rounded-2xl border p-3 text-left ${active ? "border-mauve" : "border-border hover:border-rose/40"}`}
                    style={{ fontFamily: f.family }}
                  >
                    <p className="text-lg italic text-mauve">Aa</p>
                    <p className="text-[11px] text-muted-foreground">{f.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-blush/60 to-rose/30 p-6">
            <p className="text-[10px] uppercase tracking-widest text-rose">Pré-visualização</p>
            <h3 className="mt-1 font-display text-3xl italic text-mauve">{currentShop?.shops.name}</h3>
            <p className="text-sm text-mauve/80">Doces feitos com carinho · entregamos amor.</p>
            <button className="mt-3 rounded-full bg-mauve px-4 py-2 text-xs text-cream">Botão exemplo</button>
          </div>

          <button onClick={saveTheme} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-mauve py-3 text-sm font-semibold text-cream disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar tema
          </button>
        </section>
      )}

      {tab === "vitrine" && (
        <section className="card-soft space-y-4 p-5">
          <div>
            <label className="text-[11px] uppercase tracking-widest text-rose">Título do banner</label>
            <input
              defaultValue={front.hero_title ?? ""}
              onBlur={(e) => saveFront({ hero_title: e.target.value })}
              className="input-base mt-1"
              placeholder="Bem-vindo à Doçaria da Maria"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest text-rose">Subtítulo</label>
            <input
              defaultValue={front.hero_subtitle ?? ""}
              onBlur={(e) => saveFront({ hero_subtitle: e.target.value })}
              className="input-base mt-1"
              placeholder="Bolos artesanais para qualquer ocasião"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest text-rose">Banner</label>
            <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-blush/20">
              {front.banner_url ? (
                <img src={front.banner_url} alt="Banner" className="aspect-[3/1] w-full object-cover" />
              ) : (
                <div className="grid aspect-[3/1] place-items-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8" strokeWidth={1.2} />
                </div>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onBannerUpload(f); }}
              className="mt-2 text-xs text-mauve"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-rose">Instagram</label>
              <input defaultValue={front.social?.instagram ?? ""} onBlur={(e) => saveFront({ social: { ...front.social, instagram: e.target.value } })} className="input-base mt-1" placeholder="@minhadoceria" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-rose">Endereço</label>
              <input defaultValue={front.social?.address ?? ""} onBlur={(e) => saveFront({ social: { ...front.social, address: e.target.value } })} className="input-base mt-1" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-rose">Horários</label>
              <input defaultValue={front.social?.hours ?? ""} onBlur={(e) => saveFront({ social: { ...front.social, hours: e.target.value } })} className="input-base mt-1" placeholder="Seg-Sex 10-18" />
            </div>
          </div>
        </section>
      )}

      {tab === "promocoes" && (
        <PromosTab front={front} onSave={(promotions) => saveFront({ promotions })} />
      )}

      {tab === "eventos" && (
        <section className="card-soft p-5">
          <p className="text-sm text-mauve mb-3">Cada evento ativo tem sua própria vitrine pública com os produtos planejados.</p>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento ativo. Crie um na página de Eventos.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {events.map((e) => {
                const eventUrl = `${baseUrl}/loja/${slug}/e/${e.id}`;
                return (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-mauve"><CalendarHeart className="h-3.5 w-3.5 text-rose" /> {e.name}</p>
                      <p className="text-[11px] text-muted-foreground break-all">{eventUrl}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { navigator.clipboard.writeText(eventUrl); toast.success("Link copiado"); }} className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-mauve hover:border-rose/50"><Copy className="inline h-3 w-3 mr-1" />Copiar</button>
                      <a href={eventUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-mauve px-3 py-1.5 text-xs text-cream"><ExternalLink className="inline h-3 w-3 mr-1" />Abrir</a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-widest text-rose">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-base mt-1 font-mono text-xs"
        placeholder="oklch(0.78 0.09 15)"
      />
    </div>
  );
}

function PromosTab({ front, onSave }: { front: Storefront; onSave: (p: Storefront["promotions"]) => void }) {
  const [list, setList] = useState(front.promotions ?? []);
  const add = () => setList([...list, { id: crypto.randomUUID(), title: "Nova promoção", price_from: 0, price_to: 0 }]);
  const update = (i: number, patch: Partial<(typeof list)[number]>) => {
    const copy = [...list]; copy[i] = { ...copy[i], ...patch }; setList(copy);
  };
  const remove = (i: number) => setList(list.filter((_, x) => x !== i));

  return (
    <section className="card-soft space-y-3 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-mauve">Promoções ativas</p>
        <button onClick={add} className="inline-flex items-center gap-1 rounded-xl bg-blush/50 px-3 py-1.5 text-xs text-mauve hover:bg-blush/80"><Plus className="h-3 w-3" />Adicionar</button>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma promoção. Crie uma para destacar na vitrine.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((p, i) => (
            <li key={p.id} className="grid grid-cols-12 gap-2 rounded-xl border border-border p-2">
              <input value={p.title} onChange={(e) => update(i, { title: e.target.value })} placeholder="Título" className="col-span-12 sm:col-span-5 input-base" />
              <input type="number" step="0.01" value={p.price_from ?? ""} onChange={(e) => update(i, { price_from: Number(e.target.value) })} placeholder="De R$" className="col-span-6 sm:col-span-2 input-base" />
              <input type="number" step="0.01" value={p.price_to ?? ""} onChange={(e) => update(i, { price_to: Number(e.target.value) })} placeholder="Por R$" className="col-span-6 sm:col-span-2 input-base" />
              <input type="date" value={p.valid_until ?? ""} onChange={(e) => update(i, { valid_until: e.target.value })} className="col-span-10 sm:col-span-2 input-base" />
              <button onClick={() => remove(i)} className="col-span-2 sm:col-span-1 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20"><Trash2 className="mx-auto h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <button onClick={() => onSave(list)} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-mauve py-3 text-sm font-semibold text-cream"><Save className="h-4 w-4" />Salvar promoções</button>
    </section>
  );
}
