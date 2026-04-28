// Floating side panel for live-editing the storefront (theme + content).
// Shown only to authenticated owners/managers of the shop.
import { useEffect, useState } from "react";
import { Palette, Save, Loader2, X, Sparkles, Image as ImageIcon, Type } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { applyTheme, PRESETS, FONTS, type ShopTheme, type ThemePresetKey, type FontKey } from "@/lib/theme";
import { uploadShopImage } from "@/lib/upload";

export type StorefrontDraft = {
  hero_title: string | null;
  hero_subtitle: string | null;
  banner_url: string | null;
  social: { instagram?: string; address?: string; hours?: string };
};

type Props = {
  shopId: string;
  initialTheme: ShopTheme;
  initialDraft: StorefrontDraft;
  onDraftChange: (d: StorefrontDraft) => void;
  onClose: () => void;
};

export function StorefrontEditor({ shopId, initialTheme, initialDraft, onDraftChange, onClose }: Props) {
  const [tab, setTab] = useState<"tema" | "conteudo">("tema");
  const [theme, setTheme] = useState<ShopTheme>(initialTheme);
  const [draft, setDraft] = useState<StorefrontDraft>(initialDraft);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    onDraftChange(draft);
  }, [draft, onDraftChange]);

  const save = async () => {
    setSaving(true);
    try {
      const [t, s] = await Promise.all([
        supabase.from("shops").update({ theme: theme as any }).eq("id", shopId),
        supabase
          .from("shop_storefront")
          .upsert(
            {
              shop_id: shopId,
              hero_title: draft.hero_title,
              hero_subtitle: draft.hero_subtitle,
              banner_url: draft.banner_url,
              social: draft.social as any,
            },
            { onConflict: "shop_id" },
          ),
      ]);
      if (t.error || s.error) throw t.error ?? s.error;
      toast.success("Vitrine salva");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message ?? ""));
    } finally {
      setSaving(false);
    }
  };

  const onBanner = async (file: File) => {
    try {
      const url = await uploadShopImage("storefront-banners", shopId, file);
      setDraft((d) => ({ ...d, banner_url: url }));
      toast.success("Banner pronto — clique em Salvar.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro upload");
    }
  };

  return (
    <div className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-sm flex-col border-l border-rose/30 bg-cream shadow-2xl">
      <div className="flex items-center justify-between border-b border-rose/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-rose" />
          <h2 className="font-display text-lg italic text-mauve">Editar vitrine</h2>
        </div>
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-rose/30">
          <X className="h-4 w-4 text-mauve" />
        </button>
      </div>

      <div className="flex gap-1 border-b border-rose/20 px-3 py-2">
        {(["tema", "conteudo"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl px-3 py-1.5 text-xs font-medium ${tab === t ? "bg-mauve text-cream" : "text-mauve hover:bg-rose/20"}`}
          >
            {t === "tema" ? "Tema" : "Conteúdo"}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {tab === "tema" && (
          <>
            <div>
              <p className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-rose">
                <Palette className="h-3 w-3" /> Paleta
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(PRESETS) as ThemePresetKey[]).map((k) => {
                  const p = PRESETS[k];
                  const active = (theme.preset ?? "rose") === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setTheme({ ...theme, preset: k, primary: undefined, accent: undefined, background: undefined })}
                      className={`flex flex-col gap-1 rounded-2xl border p-2.5 text-left ${active ? "border-mauve bg-blush/30" : "border-border hover:border-rose/40"}`}
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

            <div>
              <p className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-rose">
                <Type className="h-3 w-3" /> Fonte de títulos
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(FONTS) as FontKey[]).map((k) => {
                  const f = FONTS[k];
                  const active = (theme.font ?? "playfair") === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setTheme({ ...theme, font: k })}
                      className={`rounded-2xl border p-2.5 text-left ${active ? "border-mauve bg-blush/30" : "border-border hover:border-rose/40"}`}
                      style={{ fontFamily: f.family }}
                    >
                      <p className="text-base italic text-mauve">Aa</p>
                      <p className="text-[10px] text-muted-foreground">{f.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {tab === "conteudo" && (
          <>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Título</label>
              <input
                value={draft.hero_title ?? ""}
                onChange={(e) => setDraft({ ...draft, hero_title: e.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-mauve focus:border-rose focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-rose">Subtítulo</label>
              <textarea
                value={draft.hero_subtitle ?? ""}
                onChange={(e) => setDraft({ ...draft, hero_subtitle: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-mauve focus:border-rose focus:outline-none"
              />
            </div>
            <div>
              <label className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-rose"><ImageIcon className="h-3 w-3" /> Banner</label>
              <div className="mt-1 overflow-hidden rounded-xl border border-border bg-blush/20">
                {draft.banner_url ? (
                  <img src={draft.banner_url} alt="" className="aspect-[3/1] w-full object-cover" />
                ) : (
                  <div className="grid aspect-[3/1] place-items-center text-muted-foreground"><ImageIcon className="h-7 w-7" strokeWidth={1.2} /></div>
                )}
              </div>
              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onBanner(f); }} className="mt-2 text-[11px] text-mauve" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-rose">Instagram</label>
              <input
                value={draft.social.instagram ?? ""}
                onChange={(e) => setDraft({ ...draft, social: { ...draft.social, instagram: e.target.value } })}
                placeholder="@minhadoceria"
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-mauve focus:border-rose focus:outline-none"
              />
              <label className="text-[10px] uppercase tracking-widest text-rose">Endereço</label>
              <input
                value={draft.social.address ?? ""}
                onChange={(e) => setDraft({ ...draft, social: { ...draft.social, address: e.target.value } })}
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-mauve focus:border-rose focus:outline-none"
              />
              <label className="text-[10px] uppercase tracking-widest text-rose">Horários</label>
              <input
                value={draft.social.hours ?? ""}
                onChange={(e) => setDraft({ ...draft, social: { ...draft.social, hours: e.target.value } })}
                placeholder="Seg-Sex 10h–18h"
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-mauve focus:border-rose focus:outline-none"
              />
            </div>
          </>
        )}
      </div>

      <div className="border-t border-rose/30 p-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-mauve py-3 text-sm font-semibold text-cream disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar vitrine
        </button>
      </div>
    </div>
  );
}
