// Lista de produtos no estilo cardápio digital: card horizontal com texto à
// esquerda e foto quadrada à direita, agrupados por categoria.

import { Cake, Plus } from "lucide-react";

export type CardapioProduct = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  public_price: number | null;
  promo_price: number | null;
  is_featured: boolean;
  category: string | null;
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ProductListHorizontal({
  products, onAdd, disabled,
}: {
  products: CardapioProduct[];
  onAdd: (p: CardapioProduct) => void;
  disabled?: boolean;
}) {
  // Agrupa por categoria preservando a ordem
  const groups: { category: string; items: CardapioProduct[] }[] = [];
  const map = new Map<string, CardapioProduct[]>();
  for (const p of products) {
    const cat = p.category?.trim() || "Outros";
    if (!map.has(cat)) {
      map.set(cat, []);
      groups.push({ category: cat, items: map.get(cat)! });
    }
    map.get(cat)!.push(p);
  }

  if (products.length === 0) {
    return (
      <div className="card-soft p-10 text-center text-mauve/70">
        <Cake className="mx-auto mb-3 h-10 w-10 text-mauve/30" strokeWidth={1.2} />
        <p>Nenhum produto disponível.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.category}>
          <h3 className="mb-2 px-1 text-base font-bold uppercase tracking-wide text-mauve">
            {g.category}
          </h3>
          {/* mobile: lista vertical de cards horizontais; desktop: grid */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {g.items.map((r) => {
              const hasPromo = r.promo_price != null && r.public_price != null && r.promo_price < r.public_price;
              const finalPrice = hasPromo ? r.promo_price! : r.public_price;
              return (
                <article
                  key={r.id}
                  className={`flex items-stretch overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow ${r.is_featured ? "border-rose" : "border-rose/20"}`}
                >
                  <div className="flex flex-1 flex-col gap-1.5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold text-mauve">{r.name}</h4>
                      {hasPromo && (
                        <span className="rounded-full bg-rose px-2 py-0.5 text-[9px] font-semibold text-mauve">PROMO</span>
                      )}
                    </div>
                    {r.description && (
                      <p className="line-clamp-2 text-xs text-mauve/60">{r.description}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-baseline gap-1.5">
                        {hasPromo && (
                          <span className="text-[11px] text-mauve/40 line-through">{brl(r.public_price!)}</span>
                        )}
                        <span className="text-base font-bold text-rose">
                          {finalPrice != null ? brl(finalPrice) : "Sob consulta"}
                        </span>
                      </div>
                      <button
                        onClick={() => onAdd(r)}
                        disabled={disabled}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mauve text-cream hover:opacity-90 disabled:opacity-50"
                        aria-label={`Adicionar ${r.name}`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="aspect-square w-24 shrink-0 bg-blush sm:w-28">
                    {r.image_url ? (
                      <img
                        src={r.image_url}
                        alt={r.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center">
                        <Cake className="h-7 w-7 text-mauve/40" />
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
