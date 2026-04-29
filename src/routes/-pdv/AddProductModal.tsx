import { useEffect, useMemo, useState } from "react";
import { Cake, Plus, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadShopImage } from "@/lib/upload";
import { toast } from "sonner";
import type { Product, EventProduct } from "./types";
import { fmtBRL } from "./types";

type RecipeLite = {
  id: string;
  name: string;
  public_price: number | null;
  promo_price: number | null;
  image_url: string | null;
};

export function AddProductModal({
  shopId, mode, eventId, eventName, existingPdvCount, existingEventCount,
  onClose, onAddedShop, onAddedEvent,
}: {
  shopId: string;
  mode: "shop" | "event";
  eventId: string | null;
  eventName?: string;
  existingPdvCount: number;
  existingEventCount: number;
  onClose: () => void;
  onAddedShop: (p: Product) => void;
  onAddedEvent: (p: EventProduct) => void;
}) {
  const [tab, setTab] = useState<"recipe" | "custom">("recipe");
  const [recipes, setRecipes] = useState<RecipeLite[]>([]);
  const [search, setSearch] = useState("");
  const [loadingR, setLoadingR] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [planned, setPlanned] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);

  useEffect(() => {
    supabase.from("recipes").select("id, name, public_price, promo_price, image_url").eq("shop_id", shopId).order("name").then(({ data }) => {
      setRecipes((data ?? []) as RecipeLite[]);
      setLoadingR(false);
    });
  }, [shopId]);

  const filtered = useMemo(
    () => recipes.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [recipes, search],
  );

  const addFromRecipe = async (r: RecipeLite) => {
    const basePrice = Number(r.promo_price ?? r.public_price ?? 0);
    if (!basePrice) return toast.error(`Defina o preço de "${r.name}" no catálogo primeiro.`);
    setSavingId(r.id);
    try {
      if (mode === "event" && eventId) {
        const { data, error } = await supabase.from("event_products")
          .insert({
            event_id: eventId, name: r.name, unit_price: basePrice,
            recipe_id: r.id, image_url: r.image_url, position: existingEventCount,
          })
          .select("*").single();
        if (error) throw error;
        onAddedEvent(data as EventProduct);
        toast.success(`${r.name} adicionado ao evento`);
      } else {
        const { data, error } = await supabase.from("pdv_products")
          .insert({
            shop_id: shopId, label: r.name, price: basePrice,
            icon: "cake", tone: "rose", image_url: r.image_url, position: existingPdvCount,
          })
          .select("*").single();
        if (error) throw error;
        onAddedShop(data as Product);
        toast.success(`${r.name} adicionado à loja`);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao adicionar");
    } finally {
      setSavingId(null);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadShopImage("product-images", shopId, file);
      setImageUrl(url);
    } catch (e: any) {
      toast.error(e.message ?? "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const saveCustom = async () => {
    if (!name.trim() || !price) return toast.error("Preencha nome e preço");
    setSavingCustom(true);
    try {
      if (mode === "event" && eventId) {
        const { data, error } = await supabase.from("event_products")
          .insert({
            event_id: eventId, name: name.trim(), unit_price: Number(price),
            planned_qty: Number(planned) || 0, image_url: imageUrl, position: existingEventCount,
          })
          .select("*").single();
        if (error) throw error;
        onAddedEvent(data as EventProduct);
        toast.success("Produto adicionado ao evento");
      } else {
        const { data, error } = await supabase.from("pdv_products")
          .insert({
            shop_id: shopId, label: name.trim(), price: Number(price),
            icon: "cake", tone: "rose", image_url: imageUrl, position: existingPdvCount,
          })
          .select("*").single();
        if (error) throw error;
        onAddedShop(data as Product);
        toast.success("Produto adicionado à loja");
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSavingCustom(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-mauve/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-petal">
        <div className="flex items-center justify-between border-b border-border/60 bg-blush/20 px-5 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-rose">
              {mode === "event" ? "Adicionar ao evento" : "Adicionar à loja"}
            </p>
            <h2 className="font-display text-xl italic text-mauve">
              {mode === "event" ? eventName ?? "Evento" : "Loja (avulso)"}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-card"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex gap-1 border-b border-border/60 px-3 pt-2">
          {([
            { k: "recipe", l: "Da minha receita" },
            { k: "custom", l: "Criar do zero" },
          ] as const).map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`relative px-4 py-2 text-xs font-medium ${
                tab === t.k ? "text-mauve" : "text-muted-foreground hover:text-mauve"
              }`}>
              {t.l}
              {tab === t.k && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-rose" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "recipe" ? (
            <>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar receita..."
                className="input-base mb-3 w-full"
              />
              {loadingR ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Carregando receitas...</p>
              ) : recipes.length === 0 ? (
                <div className="rounded-xl bg-blush/20 p-6 text-center text-sm text-muted-foreground">
                  Você ainda não cadastrou receitas. Crie uma em <strong>Receitas</strong> para usar aqui.
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma receita encontrada.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {filtered.map((r) => {
                    const p = Number(r.promo_price ?? r.public_price ?? 0);
                    return (
                      <li key={r.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2 hover:border-rose/40">
                        {r.image_url ? (
                          <img src={r.image_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-blush/40">
                            <Cake className="h-5 w-5 text-mauve" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-mauve">{r.name}</p>
                          <p className="text-[11px] text-muted-foreground num">
                            {p > 0 ? fmtBRL(p) : "Sem preço"}
                          </p>
                        </div>
                        <button
                          onClick={() => addFromRecipe(r)}
                          disabled={savingId === r.id || p === 0}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-mauve px-3 py-1.5 text-xs text-cream hover:opacity-90 disabled:opacity-50"
                        >
                          {savingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                          Adicionar
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className={`grid h-20 w-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-blush/20 ${uploading ? "opacity-50" : "hover:bg-blush/40"}`}>
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-mauve" />
                  ) : imageUrl ? (
                    <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-mauve/60" />
                  )}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
                </label>
                <div className="flex-1 space-y-2">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do produto" className="input-base w-full" />
                  <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" step="0.01" placeholder="Preço (R$)" className="input-base w-full" />
                </div>
              </div>
              {mode === "event" && (
                <input value={planned} onChange={(e) => setPlanned(e.target.value)} type="number" placeholder="Quantidade planejada (opcional)" className="input-base w-full" />
              )}
              <button onClick={saveCustom} disabled={savingCustom || uploading}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-mauve px-4 py-2.5 text-sm text-cream hover:opacity-90 disabled:opacity-60">
                {savingCustom ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adicionar produto
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
