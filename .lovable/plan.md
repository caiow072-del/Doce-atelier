## O que ainda falta (a duplicação já foi resolvida antes)

Você está certo: o `EventHeader` separado já foi unificado no card seletor do topo. Os problemas reais que sobraram:

1. **Editar evento** ainda abre como bloco inline empurrando a página — deve ser **modal**.
2. **Layout no PC continua "tira estreita"** — `PageContainer width="narrow"` (max-w-3xl) faz tudo virar uma coluna magra. Cards de Produtos / Tarefas / Caixa ficam esticados verticalmente, listas com 2 dados ocupam linha inteira.
3. **Tipografia decorativa demais no desktop** — dias da aba Tarefas (`font-display italic`) e valor do caixa (`font-display text-4xl italic`) ficam fora do tom de painel profissional.

## Plano

### A. Editar evento → Modal
- Substituir o bloco inline `EditMeta` (linhas 558–571) por um `Dialog` do shadcn (`@/components/ui/dialog`, já existe).
- Ao clicar no lápis: abre modal centralizado, `max-w-2xl` no PC, full-width no mobile, com scroll interno e botões "Salvar / Cancelar" no rodapé.

### B. Layout PC profissional (mobile intocado)
- Trocar `PageContainer width="narrow"` → `width="default"` para liberar largura (max-w-5xl/6xl, padrão das outras páginas).
- Conteúdo do evento vira **grid 12 colunas no desktop** (`lg:grid-cols-12`):
  - Esquerda (`lg:col-span-4`): card seletor do evento + tabs verticais (Produtos / Tarefas / Caixa) empilhados como menu lateral.
  - Direita (`lg:col-span-8`): conteúdo da aba ativa.
- Mobile (sem `lg:`): tudo continua empilhado igual hoje (seletor em cima, tabs em grid de 3, conteúdo abaixo).

### C. Refinamento dos cards internos no desktop

**Aba Produtos**
- Lista de produtos vira `md:grid-cols-2` no desktop (mobile permanece 1 coluna).
- "Lista de compras" (insumos) também `md:grid-cols-2` quando expandida.
- Padding dos cabeçalhos `px-5 py-3` → `md:px-4 md:py-2.5`.

**Aba Tarefas**
- Botões de dia: trocar `font-display italic text-base` por `text-sm font-medium` no desktop (mantém limpo).
- Lista de tarefas: `md:grid-cols-2` quando há muitas, padding `md:px-4`.

**Aba Caixa**
- Valor total: `font-display text-4xl italic` → `text-3xl font-semibold` (sem itálico, sem font display).
- "Previsto vs vendido" e "Vendas registradas" lado a lado em `lg:grid-cols-2`.
- Paddings reduzidos no desktop (`md:px-4 md:py-2.5`).

## Arquivo

- `src/routes/eventos.tsx` — única edição.

Confirma para eu aplicar?
