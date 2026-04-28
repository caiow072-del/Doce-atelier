import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Globe,
  Save,
  Loader2,
  Image as ImageIcon,
  Copy,
  Check,
  Sparkles,
  Plus,
  Trash2,
  CalendarHeart,
  Monitor,
  Smartphone,
  ExternalLink,
  RefreshCw,
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
      { name: "description", content: "Edite sua loja virtual ao vivo: marca, banners, promoções." },
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
type Device = "desktop" | "mobile";

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
  const [device, setDevice] = useState<Device>("desktop");
  const [previewReady, setPreviewReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Load storefront + events
  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    setLoading(true);

    const fallback: Storefront = {
      shop_id: shopId,
      hero_title: currentShop?.shops.name ?? "Bem-vindo",
      hero_subtitle: "Doces feitos com carinho",
      banner_url: null,
      promotions: [],
      social: {},
    };

    (async () => {
      try {
        const [sfRes, evRes] = await Promise.all([
          supabase.from("shop_storefront").select("*").eq("shop_id", shopId).maybeSingle(),
          supabase
            .from("events")
            .select("id, name, date, closed_at")
            .eq("shop_id", shopId)
            .is("closed_at", null)
            .order("date")
            .limit(20),
        ]);

        let row = (sfRes.data as unknown) as Storefront | null;
        if (!row) {
          const ins = await supabase
            .from("shop_storefront")
            .insert({
              shop_id: shopId,
              hero_title: fallback.hero_title,
              hero_subtitle: fallback.hero_subtitle,
            })
            .select("*")
            .maybeSingle();
          row = ((ins.data as unknown) as Storefront | null) ?? fallback;
        }
        if (cancelled) return;
        setFront({ ...fallback, ...row, social: row?.social ?? {}, promotions: row?.promotions ?? [] });
        setEvents((evRes.data ?? []) as any);
      } catch (err) {
        console.error("vitrine load error", err);
        if (!cancelled) {
          setFront(fallback);
          toast.error("Não foi possível carregar a vitrine completa.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shopId]);

  // Listen for iframe ready signal
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.data?.type === "vitrine-preview-ready") setPreviewReady(true);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Push live updates to iframe
  const postPreview = (payload: { theme?: ShopTheme; draft?: Partial<Storefront> }) => {
    iframeRef.current?.contentWindow?.postMessage({ type: "vitrine-preview", ...payload }, "*");
  };

  // Whenever theme changes locally, push to iframe (no DB write yet)
  useEffect(() => {
    if (previewReady) postPreview({ theme });
  }, [theme, previewReady]);

  // Whenever front changes locally, push to iframe
  useEffect(() => {
    if (previewReady && front) {
      postPreview({
        draft: {
          hero_title: front.hero_title,
          hero_subtitle: front.hero_subtitle,
          banner_url: front.banner_url,
          social: front.social,
        },
      });
    }
  }, [front, previewReady]);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = slug ? `${baseUrl}/loja/${slug}` : "";
  const previewUrl = slug ? `${publicUrl}?preview=1` : "";

  const updateFront = (patch: Partial<Storefront>) => {
    if (!front) return;
    setFront({ ...front, ...patch });
    setDirty(true);
  };

  const saveAll = async () => {
    if (!shopId || !front) return;
    setSaving(true);
    try {
      const [t, f] = await Promise.all([
        supabase.from("shops").update({ theme: theme as any }).eq("id", shopId),
        supabase.from("shop_storefront").update({
          hero_title: front.hero_title,
          hero_subtitle: front.hero_subtitle,
          banner_url: front.banner_url,
          social: front.social as any,
          promotions: front.promotions as any,
        }).eq("shop_id", shopId),
      ]);
      if (t.error || f.error) throw t.error ?? f.error;
      toast.success("Vitrine publicada");
      setDirty(false);
      // Apply theme to the dashboard too so sidebar/global UI updates
      applyTheme(theme);
      await refreshShops();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const onBannerUpload = async (file: File) => {
    if (!shopId) return;
    try {
      const url = await uploadShopImage("storefront-banners", shopId, file);
      updateFront({ banner_url: url });
      toast.success("Banner atualizado (não esqueça de publicar)");
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const reloadPreview = () => {
    setPreviewReady(false);
    if (iframeRef.current) iframeRef.current.src = previewUrl + "&t=" + Date.now();
  };

  if (loading || !front) {
    return (
      <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-mauve" /></div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Sua marca"
        title="Minha vitrine"
        subtitle="Edite e veja o resultado ao vivo na própria loja, do lado direito."
      />

      {/* Top bar: link + save */}
      <div className="card-soft flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 flex-none place-items-center rounded-2xl bg-gradient-to-br from-blush to-rose">
            <Globe className="h-4 w-4 text-mauve" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-rose">Link público</p>
            <p className="truncate text-xs text-mauve">{publicUrl || "—"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs text-mauve hover:border-rose/50">
            {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado" : "Copiar link"}
          </button>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs text-mauve hover:border-rose/50">
            <ExternalLink className="h-3.5 w-3.5" /> Abrir
          </a>
          <button
            onClick={saveAll}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 rounded-xl bg-mauve px-4 py-2 text-xs font-semibold text-cream disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {dirty ? "Publicar alterações" : "Tudo publicado"}
          </button>
        </div>
      </div>

      {/* Split layout: editor + live preview */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,420px),1fr]">
        {/* Editor column */}
        <div className="space-y-3">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {(["marca", "vitrine", "promocoes", "eventos"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${tab === t ? "bg-mauve text-cream" : "border border-border bg-card text-mauve hover:border-rose/40"}`}
              >
                {t === "marca" ? "Marca" : t === "vitrine" ? "Conteúdo" : t === "promocoes" ? "Promoções" : "Eventos"}
              </button>
            ))}
          </div>

          {tab === "marca" && (
            <section className="card-soft space-y-4 p-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-rose mb-2">Paletas prontas</p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(PRESETS) as ThemePresetKey[]).map((k) => {
                    const p = PRESETS[k];
                    const active = (theme.preset ?? "rose") === k;
                    return (
                      <button
                        key={k}
                        onClick={() => { setTheme({ ...theme, preset: k, primary: undefined, accent: undefined, background: undefined }); setDirty(true); }}
                        className={`flex flex-col gap-1 rounded-xl border p-2 text-left transition-colors ${active ? "border-mauve" : "border-border hover:border-rose/40"}`}
                      >
                        <div className="flex gap-1">
                          <span className="h-4 w-4 rounded-full" style={{ background: p.primary }} />
                          <span className="h-4 w-4 rounded-full" style={{ background: p.accent }} />
                          <span className="h-4 w-4 rounded-full border border-border" style={{ background: p.background }} />
                        </div>
                        <span className="text-[11px] font-medium text-mauve">{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <ColorField label="Primária" value={theme.primary ?? PRESETS[theme.preset ?? "rose"].primary} onChange={(v) => { setTheme({ ...theme, primary: v }); setDirty(true); }} />
                <ColorField label="Destaque" value={theme.accent ?? PRESETS[theme.preset ?? "rose"].accent} onChange={(v) => { setTheme({ ...theme, accent: v }); setDirty(true); }} />
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-widest text-rose mb-2">Fonte de títulos</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(Object.keys(FONTS) as FontKey[]).map((k) => {
                    const f = FONTS[k];
                    const active = (theme.font ?? "playfair") === k;
                    return (
                      <button
                        key={k}
                        onClick={() => { setTheme({ ...theme, font: k }); setDirty(true); }}
                        className={`rounded-xl border p-2 text-center ${active ? "border-mauve" : "border-border hover:border-rose/40"}`}
                        style={{ fontFamily: f.family }}
                      >
                        <p className="text-base italic text-mauve leading-none">Aa</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{f.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {tab === "vitrine" && (
            <section className="card-soft space-y-3 p-4">
              <Field label="Título do banner">
                <input
                  value={front.hero_title ?? ""}
                  onChange={(e) => updateFront({ hero_title: e.target.value })}
                  className="input-base"
                  placeholder="Bem-vindo à Doçaria da Maria"
                />
              </Field>
              <Field label="Subtítulo">
                <input
                  value={front.hero_subtitle ?? ""}
                  onChange={(e) => updateFront({ hero_subtitle: e.target.value })}
                  className="input-base"
                  placeholder="Bolos artesanais para qualquer ocasião"
                />
              </Field>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-rose mb-1">Banner</p>
                <div className="overflow-hidden rounded-xl border border-border bg-blush/20">
                  {front.banner_url ? (
                    <img src={front.banner_url} alt="Banner" className="aspect-[3/1] w-full object-cover" />
                  ) : (
                    <div className="grid aspect-[3/1] place-items-center text-muted-foreground">
                      <ImageIcon className="h-7 w-7" strokeWidth={1.2} />
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onBannerUpload(f); }}
                  className="mt-2 text-[11px] text-mauve"
                />
              </div>
              <Field label="Instagram">
                <input value={front.social?.instagram ?? ""} onChange={(e) => updateFront({ social: { ...front.social, instagram: e.target.value } })} className="input-base" placeholder="@minhadoceria" />
              </Field>
              <Field label="Endereço">
                <input value={front.social?.address ?? ""} onChange={(e) => updateFront({ social: { ...front.social, address: e.target.value } })} className="input-base" />
              </Field>
              <Field label="Horários">
                <input value={front.social?.hours ?? ""} onChange={(e) => updateFront({ social: { ...front.social, hours: e.target.value } })} className="input-base" placeholder="Seg-Sex 10-18" />
              </Field>
            </section>
          )}

          {tab === "promocoes" && (
            <PromosTab front={front} onChange={(promotions) => updateFront({ promotions })} />
          )}

          {tab === "eventos" && (
            <section className="card-soft p-4">
              <p className="text-xs text-mauve mb-3">Cada evento ativo tem sua própria vitrine pública.</p>
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum evento ativo.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {events.map((e) => {
                    const eventUrl = `${baseUrl}/loja/${slug}/e/${e.id}`;
                    return (
                      <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 text-xs font-medium text-mauve"><CalendarHeart className="h-3 w-3 text-rose" /> {e.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{eventUrl}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => { navigator.clipboard.writeText(eventUrl); toast.success("Link copiado"); }} className="rounded-lg border border-border bg-card px-2 py-1 text-[10px] text-mauve hover:border-rose/50"><Copy className="inline h-3 w-3" /></button>
                          <a href={eventUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-mauve px-2 py-1 text-[10px] text-cream"><ExternalLink className="inline h-3 w-3" /></a>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          <div className="card-soft flex items-start gap-2 border-l-4 border-rose/60 bg-blush/20 p-3">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-none text-rose" />
            <p className="text-[11px] text-mauve leading-snug">
              Suas alterações aparecem na hora aqui no preview. Clique em <strong>Publicar</strong> para deixar visível para os clientes.
            </p>
          </div>
        </div>

        {/* Live preview column */}
        <div className="card-soft sticky top-4 flex h-[calc(100vh-9rem)] flex-col overflow-hidden p-0">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-cream/40 px-3 py-2">
            <div className="flex items-center gap-1">
              <DeviceBtn active={device === "desktop"} onClick={() => setDevice("desktop")} icon={<Monitor className="h-3.5 w-3.5" />} label="Desktop" />
              <DeviceBtn active={device === "mobile"} onClick={() => setDevice("mobile")} icon={<Smartphone className="h-3.5 w-3.5" />} label="Mobile" />
            </div>
            <div className="flex items-center gap-2">
              {dirty && <span className="text-[10px] text-rose">● não publicado</span>}
              <button onClick={reloadPreview} title="Recarregar" className="rounded-lg border border-border bg-card p-1.5 text-mauve hover:border-rose/40">
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="flex flex-1 items-start justify-center overflow-auto bg-gradient-to-br from-blush/20 to-cream/40 p-3">
            {previewUrl ? (
              <iframe
                ref={iframeRef}
                src={previewUrl}
                title="Pré-visualização da vitrine"
                className={`h-full w-full rounded-2xl border border-border bg-cream shadow-lg transition-all ${device === "mobile" ? "max-w-[390px]" : "max-w-full"}`}
              />
            ) : (
              <p className="text-xs text-muted-foreground">Defina um slug para ver a vitrine.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-rose">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function DeviceBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-colors ${active ? "bg-mauve text-cream" : "text-mauve hover:bg-blush/40"}`}
    >
      {icon} {label}
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-rose">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-base mt-1 font-mono text-[11px]"
        placeholder="oklch(0.78 0.09 15)"
      />
    </div>
  );
}

function PromosTab({ front, onChange }: { front: Storefront; onChange: (p: Storefront["promotions"]) => void }) {
  const list = front.promotions ?? [];
  const add = () => onChange([...list, { id: crypto.randomUUID(), title: "Nova promoção", price_from: 0, price_to: 0 }]);
  const update = (i: number, patch: Partial<(typeof list)[number]>) => {
    const copy = [...list]; copy[i] = { ...copy[i], ...patch }; onChange(copy);
  };
  const remove = (i: number) => onChange(list.filter((_, x) => x !== i));

  return (
    <section className="card-soft space-y-3 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-mauve">Promoções ativas</p>
        <button onClick={add} className="inline-flex items-center gap-1 rounded-lg bg-blush/50 px-2.5 py-1 text-[11px] text-mauve hover:bg-blush/80"><Plus className="h-3 w-3" />Adicionar</button>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma promoção.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((p, i) => (
            <li key={p.id} className="space-y-1.5 rounded-xl border border-border p-2">
              <input value={p.title} onChange={(e) => update(i, { title: e.target.value })} placeholder="Título" className="input-base text-xs" />
              <div className="grid grid-cols-2 gap-1.5">
                <input type="number" step="0.01" value={p.price_from ?? ""} onChange={(e) => update(i, { price_from: Number(e.target.value) })} placeholder="De R$" className="input-base text-xs" />
                <input type="number" step="0.01" value={p.price_to ?? ""} onChange={(e) => update(i, { price_to: Number(e.target.value) })} placeholder="Por R$" className="input-base text-xs" />
              </div>
              <div className="flex gap-1.5">
                <input type="date" value={p.valid_until ?? ""} onChange={(e) => update(i, { valid_until: e.target.value })} className="input-base flex-1 text-xs" />
                <button onClick={() => remove(i)} className="rounded-lg border border-border bg-card px-2 text-rose hover:bg-blush/30"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
