import { createFileRoute } from "@tanstack/react-router";
import { Package, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/insumos")({
  head: () => ({
    meta: [
      { title: "Insumos — Cakes Manager" },
      { name: "description", content: "Gerencie os insumos da sua confeitaria." },
    ],
  }),
  component: InsumosPage,
});

function InsumosPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Estoque"
        title="Insumos da confeitaria"
        subtitle="Cadastre seus ingredientes e o sistema calcula o custo de cada receita."
      />
      <div className="grid place-items-center rounded-3xl border-2 border-dashed border-border bg-card/40 p-16 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-blush/60">
          <Package className="h-7 w-7 text-mauve" strokeWidth={1.4} />
        </div>
        <h2 className="mt-4 font-display text-2xl italic text-mauve">CRUD completo na próxima entrega</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Cadastro, edição, exclusão e cálculo dinâmico de custo serão liberados na Fase 1.5
          junto com a migração de Receitas para o banco real.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-blush/40 px-3 py-1.5 text-[11px] uppercase tracking-widest text-mauve">
          <Sparkles className="h-3 w-3" /> Em construção
        </div>
      </div>
    </div>
  );
}
