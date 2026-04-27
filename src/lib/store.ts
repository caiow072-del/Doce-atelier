// Helpers utilitários (legacy store removido — dados agora vêm do Supabase).

export function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
