## Antes da Parte 3 — 3 ajustes prioritários

Análise das imagens de referência (Maristella Tortas Finas): cardápio digital com **hero curvo de fotos**, **logo circular sobreposto**, **bloco de informações da loja** (cidade, horário, status "Aberto até..."), **bloco de retirada/entrega**, **seletor de categorias** + busca, **bottom-nav fixo** (Início / Promoções / Pedidos / Perfil) e **lista de produtos em cards horizontais** (texto à esquerda, foto quadrada à direita) agrupados por categoria.

---

### 1) Aba Eventos — corte na direita (mobile 390px)

**Causa provável:** itens internos forçam largura > viewport (badges/notas, sub-tabs, divisor `border-l` no card do evento).

**Ajustes em `src/routes/eventos.tsx`:**
- Card do evento (l. 484): garantir `min-w-0` no wrapper externo do flex e reduzir o divisor `border-l pl-2` para `pl-1` no mobile.
- Sub-tabs (l. 538-542): adicionar `overflow-hidden` no contêiner pai para conter qualquer tab que estique.
- Trocar qualquer `whitespace-nowrap` em badges (`Badge` componente, l. 765) por permitir quebra (`whitespace-normal` + `text-left`), já que badges grandes (ex.: "Fechado · 28/04/2026") empurram o layout.
- `NotesInline` (notas longas): forçar `break-words` + `min-w-0`.
- Padronizar paddings horizontais para `px-3 sm:px-4` em todos os blocos internos (alguns ainda usam `px-4` no mobile, somando com o `px-4` do `<main>` = 32px efetivo, mas o problema real é overflow interno, não padding).

### 2) PDV — produtos muito grandes no mobile

**Causa:** `grid-cards-sm` usa `minmax(200px, 1fr)` → em 390px - 32px de padding = ~358px disponíveis → cabe só **1 coluna gigante**.

**Ajustes:**
- Em `src/styles.css` (l. 207), criar variante específica ou ajustar `grid-cards-sm` para `minmax(140px, 1fr)` no mobile com media query, mantendo `200px` em `sm:`.
  ```css
  .grid-cards-sm { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.5rem; }
  @media (min-width: 640px) { .grid-cards-sm { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; } }
  ```
  → Resultado: **2 colunas** no mobile (390px), 3+ no desktop.
- Reduzir `aspect-[4/3]` para `aspect-square` no PDV mobile (cards ficam mais compactos verticalmente).
- Reduzir tamanho do título `text-xs` → ok, mas garantir `line-clamp-2` e padding `px-2 py-1.5`.

### 3) Vitrine — redesign inspirado no cardápio de referência

Reformular `src/routes/loja.$slug.tsx` + criar componentes auxiliares para chegar próximo da referência, **adaptando ao DNA do app** (cores/temas existentes, tipografia configurável da confeiteira).

#### 3.1 Novo Hero "cardápio digital" (substitui/complementa o hero atual)
Criar `src/routes/-loja/HeroCardapio.tsx`:
- Faixa superior com **mosaico de 3-4 fotos** dos produtos em destaque (ou banner único se só houver 1) com bordas curvas inferiores.
- **Logo circular** sobreposto centralizado (negative margin), com sombra suave.
- **Nome da loja** grande, abaixo: linha com `📍 Cidade - UF • Mais informações` (link expande modal com endereço/contato/horários).
- **Status "Aberto até às HH:mm"** em verde (ou "Fechado · abre HH:mm") calculado a partir do `business_hours` da loja (criar campo no `shop_storefront` se não existir).

#### 3.2 Bloco "Retirada / Entrega" (novo)
- Card com ícone (🚶 retirar / 🛵 entregar), endereço, seta `>` que abre modal com mais opções.
- Toggle entre modos se a loja tiver os dois habilitados (campo `delivery_modes` no `shop_storefront`).

#### 3.3 Seletor de categorias compacto + busca
- Substituir o filtro de categorias atual por um **dropdown "Lista de categorias ▾"** (compacto, ocupa pouco espaço) + ícone de busca à direita.
- Ao tocar, abre painel/sheet com todas as categorias e contagem de produtos.

#### 3.4 Lista de produtos — layout horizontal por categoria
- Reformatar a seção `catalog`: produtos em **cards horizontais** (foto quadrada 80x80 à direita, texto à esquerda: nome em negrito, descrição em 2 linhas, preço destacado em rosé/primário).
- Agrupados por categoria com **título maiúsculo** ("DOCES GOURMET", "TRUFAS") e subtítulo opcional ("Mínimo de 10 unidades por sabor").
- Manter grid 2-3 colunas no desktop (`md:grid-cols-2 lg:grid-cols-3`), só horizontal no mobile.

#### 3.5 Bottom-nav público (somente vitrine, não logado)
- Criar `src/routes/-loja/BottomNav.tsx` fixo no rodapé mobile com 4 itens: **Início**, **Promoções**, **Pedidos**, **Perfil**.
- Promoções → scrolla até seção de promoções (ou esconde se vazia).
- Pedidos → abre login/cadastro de cliente para ver pedidos (futuro — por ora link "em breve" ou já liga em encomendas se houver sessão de cliente).
- Perfil → mesmo: login/cadastro de cliente.
- Esconder em desktop (`md:hidden`).

#### 3.6 Personalização da vitrine (editor)
Expandir o editor lateral atual (`/vitrine` → `/loja/$slug?edit=1`) para incluir os novos campos:
- **Aba "Hero"** nova: upload do mosaico (até 4 imagens), texto do status, horários de funcionamento (segunda a domingo).
- **Aba "Entrega"**: ativar retirada/entrega, endereço, taxa, raio.
- **Aba "Bottom-nav"**: ativar/desativar (default ligado no mobile).
- Manter abas existentes (Template, Seções, Design).

#### 3.7 Migração de banco
Adicionar ao `shop_storefront` (nova migration):
- `business_hours JSONB` (ex.: `{ mon: ["09:00","17:00"], tue: [...], ... }`)
- `pickup_enabled BOOL DEFAULT true`, `delivery_enabled BOOL`, `delivery_address TEXT`, `delivery_fee NUMERIC`, `delivery_radius_km NUMERIC`
- `hero_images JSONB` (array de URLs até 4)
- `bottom_nav_enabled BOOL DEFAULT true`

---

## Detalhes técnicos

- Stack: TanStack Start + Tailwind v4 + Supabase (Lovable Cloud).
- Sem breaking changes: campos novos com default; layout antigo continua funcionando se hero_images vazio (fallback para banner_url atual).
- Bottom-nav usa `position: fixed` + `pb-20` no conteúdo da vitrine para não cobrir produtos.
- Status "aberto até" calcula no client a partir do horário do navegador (timezone local).

---

## Estrutura de arquivos

```text
src/routes/loja.$slug.tsx          (refatorar — usar componentes abaixo)
src/routes/-loja/
  HeroCardapio.tsx                 (novo)
  PickupDeliveryCard.tsx           (novo)
  CategoryPicker.tsx               (novo — dropdown + busca)
  ProductListHorizontal.tsx        (novo — cards horizontais agrupados)
  BottomNav.tsx                    (novo)
  HoursEditor.tsx                  (novo — usado no editor)
src/lib/business-hours.ts          (novo — calcula "aberto até")
src/styles.css                     (ajustar grid-cards-sm)
src/routes/eventos.tsx             (fix overflow direita)
supabase/migrations/...            (novos campos shop_storefront)
```

---

## Entregável

1. Eventos sem corte horizontal no mobile.
2. PDV com **2 colunas** de produtos no mobile (cards menores).
3. Vitrine com novo hero estilo cardápio digital + bloco de retirada/entrega + categorias compactas + cards horizontais por categoria + bottom-nav, e editor expandido com novos campos.

Após sua aprovação, implemento na sequência (1 → 2 → 3) e seguimos para a Parte 3 original.