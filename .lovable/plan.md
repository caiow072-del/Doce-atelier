# Repaginação Global de UI

O problema-raiz é que o app usa `max-w-7xl` único para tudo (incluindo formulários e listas), os cards não têm teto de largura, e cada página foi ajustada isoladamente — por isso "arrumar uma quebra outra". Vou centralizar as regras no `AppShell` + `PageHeader` para que toda página herde o comportamento certo.

## 1. Sistema de larguras por contexto (causa-raiz do "esticado")

Substituir o `max-w-7xl` único por **3 containers semânticos** aplicáveis via prop no `PageHeader` e numa nova classe utilitária:

```text
narrow  → max-w-3xl  (~768px)  formulários, perfil, login, configs
default → max-w-5xl  (~1024px) listas, eventos, encomendas, clientes, insumos, receitas
wide    → max-w-7xl  (~1280px) dashboard, catálogo, PDV, vitrine
```

- `AppShell` deixa de impor `max-w-7xl` no `<main>` — apenas padding.
- Cada rota envolve seu conteúdo num `<PageContainer width="narrow|default|wide">` (componente novo).
- Resultado: receitas e insumos ficam em ~1024px com 2-3 colunas reais (não 4 esticadas); dashboard e catálogo continuam aproveitando tela.

## 2. Header sticky com título da página (mobile + PC)

Reformular `AppShell` + `PageHeader`:

- `AppShell` cria um **slot sticky** (`<div className="sticky top-0 z-30 ...">`) logo no topo do `<main>`, tanto no PC quanto no mobile (no mobile fica abaixo da topbar atual).
- `PageHeader` ganha props `actions?: ReactNode` e `sticky?: boolean` (default `true`).
- Renderiza: eyebrow + título à esquerda, ações (`+ Novo`, busca) à direita, alinhados na mesma linha em md+.
- Fundo `bg-card/85 backdrop-blur` com borda inferior suave; encolhe altura quando rolado (opcional, via classe).
- Todas as páginas migram seus botões "+ Novo X" para `actions` do `PageHeader`, removendo a barra de ação separada que está duplicando espaço vertical.

## 3. Cards: teto de largura + densidade controlada

Criar utilitário CSS em `styles.css`:

```css
.grid-cards-sm  { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
.grid-cards-md  { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
.grid-cards-lg  { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
```

Vantagem do `auto-fill` + `minmax`: o card **nunca estica além de ~320px** mesmo num monitor 4K, e em mobile cai naturalmente para 1 coluna. Isso resolve "cards grandes no PC" em insumos, receitas, eventos, catálogo e PDV de uma vez sem precisar definir breakpoints manuais por página.

## 4. Página por página

**Dashboard (`index.tsx`)**
- Container `wide`. Hero compactado (já está).
- Grid de métricas: muda de `lg:grid-cols-4` esticado para `grid-cards-sm` com `max-w` por card → cards param de inflar.
- Painel lateral (Estoque/Encomendas) com largura fixa ~280px no PC.

**Insumos (`insumos.tsx`)**
- Container `default` (~1024px).
- Trocar grid de cards por **tabela densa no PC** (≥md) com colunas: nome / unidade / estoque / preço pago / ações. Em mobile mantém cards mas com altura fixa, padding reduzido (`p-3`), texto base `text-sm`, sem truncar dados críticos (mostrar 2 linhas).
- Botão "+ Novo insumo" sobe para `PageHeader.actions`.

**Receitas (`receitas.tsx`)**
- Container `default`.
- Cards usam `grid-cards-md` (max ~280px), padding reduzido, valores em coluna sem `font-display italic` exagerado, fonte `tabular-nums` para alinhar.
- **Modal "Nova/Editar receita"**:
  - Largura `max-w-3xl` no PC (`sm:max-w-3xl`).
  - Conteúdo em **grid 2 colunas no md+**: Nome | Servings, Peso total | Rende quantas, Mão-de-obra | Embalagem.
  - Mobile mantém 1 coluna mas usa `grid grid-cols-2 gap-3` para os pares numéricos curtos (peso/rende, produção/embalagem) com labels acima — alinhamento consistente.
- Repassar tipografia: títulos `text-base font-semibold`, valores `text-sm tabular-nums`.

**Eventos (`eventos.tsx`)**
- Container `default`.
- Cards de evento e histórico com `grid-cards-md` + altura mínima fixa, removendo `lg:col-span-2` e similares que esticam.
- **Histórico**: passa a ser tabela compacta no PC (data / nome / receita / lucro / ações) com **scroll interno máximo `max-h-[60vh]`** + paginação simples ("Ver mais"); em mobile, cards compactos colapsáveis.
- Painel "Evento selecionado": dividido em sub-cards de largura `max-w-sm` cada (Produtos, Tarefas, Caixa) num `flex flex-wrap` em vez de full-width esticados.

**PDV (`pdv.tsx`)** — refatoração maior
- Container `wide`, **layout 2 colunas no PC**: produtos à esquerda (`flex-1`), carrinho fixo à direita (`w-80 sticky top-[header]`).
- Produtos em `grid-cards-sm` (cards ~220px max), foto menor, nome + preço + stepper +/- compacto.
- Carrinho lateral: lista densa, total fixo no rodapé do painel, botão "Finalizar venda".
- Mobile: carrinho vira **drawer/sheet** acionado por botão flutuante mostrando contador (já tem padrão Sheet no projeto). Grid de produtos em 2 colunas com cards menores, sem corte horizontal.

**Catálogo, Clientes, Encomendas, Calendário, Vitrine**
- Aplicar mesma migração: `PageContainer` certo + `PageHeader` com `actions` + grid `auto-fill`.

## 5. Garantias contra "arrumar um e quebrar outro"

- Toda mudança de largura/grid acontece em **2 lugares só**: `AppShell` (stripped do max-w) + utilitários CSS no `styles.css`.
- Páginas declaram apenas seu `width` e usam classes utilitárias — nada de breakpoints inline customizados.
- Mobile e PC ficam isolados: mobile usa `grid-cols-1/2` explícito + sheets; PC usa `auto-fill`. Mexer em um não afeta o outro.

## Detalhes técnicos

**Arquivos a criar:**
- `src/components/PageContainer.tsx` — wrapper com prop `width: "narrow" | "default" | "wide"`.

**Arquivos a editar:**
- `src/components/AppShell.tsx` — remover `max-w-7xl` do `<main>`, manter só padding; adicionar slot sticky.
- `src/components/PageHeader.tsx` — adicionar `actions?`, `sticky?` (default true), layout flex com título à esquerda e ações à direita em md+.
- `src/styles.css` — adicionar utilitários `.grid-cards-sm/md/lg`, `.page-narrow/default/wide`, regra `tabular-nums` em valores de moeda.
- `src/routes/index.tsx` — width=wide, grid de métricas com auto-fill.
- `src/routes/insumos.tsx` — width=default, tabela no PC + cards compactos no mobile, ação no header.
- `src/routes/receitas.tsx` — width=default, grid auto-fill, modal em grid 2-col no PC, alinhamento mobile.
- `src/routes/eventos.tsx` — width=default, histórico em tabela paginada, sub-cards do evento selecionado em flex-wrap.
- `src/routes/pdv.tsx` — width=wide, split products/cart, sheet no mobile.
- `src/routes/catalogo.tsx`, `clientes.tsx`, `encomendas.tsx`, `calendario.tsx`, `vitrine.tsx` — adotar PageContainer + PageHeader.actions + grid utilitário.

**Sem mudanças em:** lógica de banco, paleta de cores, autenticação, supabase types, vitrine pública (`loja.$slug.tsx`) — só o app interno.

Após implementar, rodo verificação visual nas páginas em viewports 375px (mobile), 947px (atual) e 1440px (PC) para confirmar que nenhuma quebrou.