import { useState } from "react";
import { Cake, Settings2, Plus, Trash2, X, Image as ImageIcon, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadShopImage } from "@/lib/upload";
import { toast } from "sonner";
import type { Product } from "./types";
import { fmtBRL } from "./types";

export function ManageProductsSheet({
  shopId, products, onClose, onChange,
}: {
  shopId: string;
  products: Product[];
  onClose: () => void;
  onChange: (p: Product[]) => void;
}) {
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [icon, setIcon] = useState("cake");
  const [tone, setTone] = useState("rose");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setLabel(p.label);
    setPrice(String(p.price));
    setIcon(p.icon);
    setTone(p.tone);
    setImageUrl(p.image_url);
  };

  const reset = () => {
    setEditingId(null); setLabel(""); setPrice(""); setIcon("cake"); setTone("rose"); setImageUrl(null);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadShopImage("product-images", shopId, file);
      setImageUrl(url);
      toast.success("Imagem enviada");
    } catch (e: any) {
      toast.error(e.message ?? "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!label.trim() || !price) return toast.error("Preencha rótulo e preço");
    if (editingId) {
      const { data, error } = await supabase.from("pdv_products")
        .update({ label: label.trim(), price: Number(price), icon, tone, image_url: imageUrl })
        .eq("id", editingId).select("*").single();
      if (error) return toast.error("Erro ao salvar");
      onChange(products.map((p) => p.id === editingId ? (data as Product) : p));
      toast.success("Produto atualizado");
    } else {
      const { data, error } = await supabase.from("pdv_products")
        .insert({ shop_id: shopId, label: label.trim(), price: Number(price), icon, tone, image_url: imageUrl, position: products.length })
        .select("*").single();
      if (error) return toast.error("Erro ao criar");
      onChange([...products, data as Product]);
      toast.success("Produto adicionado");
    }
    reset();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("pdv_products").update({ active: false }).eq("id", id);
    if (error) return toast.error("Erro");
    onChange(products.filter((p) => p.id !== id));
    if (editingId === id) reset();
  };

  return (
    <div className="fixed inset-0 z-50 bg-mauve/40 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-card p-6 shadow-petal">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl italic text-mauve">Produtos do PDV</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>
        <ul className="mt-4 divide-y divide-border/60 rounded-xl border border-border">
          {products.length === 0 ? (
            <li className="p-4 text-center text-sm text-muted-foreground">Nenhum produto.</li>
          ) : products.map((p) => (
            <li key={p.id} className={`flex items-center gap-2 px-3 py-2 ${editingId === p.id ? "bg-blush/30" : ""}`}>
              {p.image_url ? (
                <img src={p.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blush/40">
                  <Cake className="h-4 w-4 text-mauve" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-mauve">{p.label}</p>
                <p className="text-[11px] text-muted-foreground">{fmtBRL(Number(p.price))}</p>
              </div>
              <button onClick={() => startEdit(p)} className="rounded-lg p-1.5 text-mauve hover:bg-blush/50" aria-label="Editar"><Settings2 className="h-4 w-4" /></button>
              <button onClick={() => remove(p.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-2 rounded-xl border border-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-rose">{editingId ? "Editando produto" : "Novo produto"}</p>
            {editingId && (
              <button onClick={reset} className="text-[11px] text-muted-foreground hover:text-mauve">Cancelar edição</button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className={`grid h-16 w-16 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-blush/20 ${uploading ? "opacity-50" : "hover:bg-blush/40"}`}>
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-mauve" />
              ) : imageUrl ? (
                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-5 w-5 text-mauve/60" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="flex-1 space-y-1.5">
              {imageUrl && (
                <button onClick={() => setImageUrl(null)} className="text-[11px] text-destructive hover:underline">Remover imagem</button>
              )}
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Rótulo" className="input-base w-full" />
            </div>
          </div>
          <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="Preço" className="input-base" />
          <div className="grid grid-cols-2 gap-2">
            <select value={icon} onChange={(e) => setIcon(e.target.value)} className="input-base">
              <option value="cake">Bolo</option><option value="utensils">Salgado</option><option value="sparkles">Especial</option>
            </select>
            <select value={tone} onChange={(e) => setTone(e.target.value)} className="input-base">
              <option value="rose">Rosa</option><option value="blush">Blush</option><option value="sage">Verde</option>
            </select>
          </div>
          <button onClick={save} disabled={uploading} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-mauve px-4 py-2 text-sm text-cream hover:opacity-90 disabled:opacity-60">
            {editingId ? <><Check className="h-4 w-4" /> Salvar</> : <><Plus className="h-4 w-4" /> Adicionar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
