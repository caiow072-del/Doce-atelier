// Seletor de categoria compacto (estilo dropdown) + ícone de busca à direita.

import { useState } from "react";
import { ChevronDown, Search, X, Check } from "lucide-react";

export function CategoryPicker({
  categories, activeCategory, onChange,
  search, onSearch,
}: {
  categories: string[];
  activeCategory: string; // "all" ou categoria
  onChange: (c: string) => void;
  search: string;
  onSearch: (s: string) => void;
}) {
  const [openList, setOpenList] = useState(false);
  const [openSearch, setOpenSearch] = useState(!!search);

  const label = activeCategory === "all" ? "Lista de categorias" : activeCategory;

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpenList((v) => !v)}
          className="inline-flex flex-1 items-center justify-between gap-2 rounded-2xl border border-rose/30 bg-white px-4 py-2.5 text-sm text-mauve shadow-sm hover:border-rose"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${openList ? "rotate-180" : ""}`} />
        </button>
        <button
          onClick={() => setOpenSearch((v) => !v)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-rose/30 bg-white text-mauve shadow-sm hover:border-rose"
          aria-label="Buscar"
        >
          {openSearch ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </button>
      </div>

      {openSearch && (
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mauve/50" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar produto..."
            autoFocus
            className="w-full rounded-2xl border border-rose/30 bg-white py-2.5 pl-10 pr-4 text-sm text-mauve placeholder:text-mauve/40 focus:border-rose focus:outline-none"
          />
        </div>
      )}

      {openList && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-rose/20 bg-white shadow-sm">
          {(["all", ...categories] as const).map((c) => {
            const active = activeCategory === c;
            return (
              <button
                key={c}
                onClick={() => { onChange(c); setOpenList(false); }}
                className={`flex w-full items-center justify-between gap-2 border-b border-rose/10 px-4 py-2.5 text-left text-sm last:border-b-0 ${active ? "bg-blush/40 text-mauve" : "text-mauve/80 hover:bg-blush/20"}`}
              >
                <span className="truncate">{c === "all" ? "Todos os produtos" : c}</span>
                {active && <Check className="h-4 w-4 text-mauve" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
