import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import type { EventType, EventKind } from "./types";
import { KIND_META } from "./constants";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmDialog, type ConfirmConfig } from "@/components/ConfirmDialog";
import { toast } from "sonner";

export function TypesSheet({
  shopId, types, onClose, onChange,
}: { shopId: string; types: EventType[]; onClose: () => void; onChange: (t: EventType[]) => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<EventKind>("generic");
  const [tsConfirmCfg, setTsConfirmCfg] = useState<ConfirmConfig | null>(null);

  const add = async () => {
    if (!name.trim()) return;
    const { data, error } = await supabase
      .from("event_types")
      .insert({ shop_id: shopId, name: name.trim(), color: "rose", icon: "sparkles", kind })
      .select("*")
      .single();
    if (error) return toast.error(error.message.includes("duplicate") ? "Tipo já existe" : "Erro");
    onChange([...types, data as EventType]);
    setName(""); setKind("generic");
  };

  const remove = (id: string) => {
    setTsConfirmCfg({
      title: "Excluir este tipo?",
      description: "Eventos existentes deste tipo não serão afetados.",
      confirmLabel: "Excluir",
      variant: "destructive",
      action: async () => {
        const { error } = await supabase.from("event_types").delete().eq("id", id);
        if (error) return toast.error("Erro");
        onChange(types.filter((t) => t.id !== id));
      },
    });
  };

  const updateKind = async (id: string, k: EventKind) => {
    onChange(types.map((t) => (t.id === id ? { ...t, kind: k } : t)));
    await supabase.from("event_types").update({ kind: k }).eq("id", id);
  };

  return (
    <>
    <div className="fixed inset-0 z-50 bg-mauve/40 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-card p-6 shadow-petal">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl italic text-mauve">Tipos de evento</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>
        <ul className="mt-4 space-y-2">
          {types.length === 0 ? (
            <li className="rounded-xl border border-border p-4 text-center text-sm text-muted-foreground">Nenhum tipo cadastrado.</li>
          ) : types.map((t) => (
            <li key={t.id} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <span className="flex-1 text-sm text-mauve">{t.name}</span>
              <select value={t.kind} onChange={(e) => updateKind(t.id, e.target.value as EventKind)} className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-mauve">
                {(Object.keys(KIND_META) as EventKind[]).map((k) => <option key={k} value={k}>{KIND_META[k].label}</option>)}
              </select>
              <button onClick={() => remove(t.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="mt-4 space-y-2 rounded-xl bg-blush/30 p-3">
          <p className="text-[10px] uppercase tracking-widest text-rose">Adicionar tipo</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Chá de bebê" className="input-base" />
          <select value={kind} onChange={(e) => setKind(e.target.value as EventKind)} className="input-base">
            {(Object.keys(KIND_META) as EventKind[]).map((k) => <option key={k} value={k}>Template: {KIND_META[k].label}</option>)}
          </select>
          <button type="submit" className="w-full rounded-xl bg-mauve px-4 py-2 text-sm text-cream hover:opacity-90">
            <Plus className="mr-1 inline h-4 w-4" /> Adicionar
          </button>
        </form>
      </div>
    </div>
    <ConfirmDialog config={tsConfirmCfg} onClose={() => setTsConfirmCfg(null)} />
    </>
  );
}
