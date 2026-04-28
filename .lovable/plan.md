
# Resposta direta às suas 6 dúvidas + plano de execução

## 1. De onde vêm os dados do Dashboard hoje

Olhei `src/routes/index.tsx` (linhas 49–81). A verdade nua:

- **Faturamento** = soma de `sales.price` do mês atual (real, vindo do PDV). ✅ ok
- **Custos** = `salesCount * 7.5` — **um chute fixo de R$ 7,50 por venda**. ❌ inventado
- **Lucro líquido** = faturamento − custos chutados. ❌ derivado do chute
- **Margem** = lucro / faturamento × 100. ❌ derivado do chute
- **Meta 30%** = string fixa no código, não é meta configurável. ❌ hard-coded

**Vou consertar:** custos passam a ser calculados pelo custo real das receitas (ingredientes × quantidades + labor + packaging) das vendas do mês. A meta de margem vira um campo na loja (`shops.target_margin`) editável.

---

## 2. Recorrência de eventos cria várias cópias (errado)

Confirmado em `src/routes/eventos.tsx` linhas 1198–1244: a lógica gera N eventos físicos no banco, um por semana. Isso polui o histórico e sincronizar mudanças vira pesadelo.

**Vai virar:** **um único evento** com:
- `recurrence` = `weekly` / `monthly`
- `weekday` = dia da semana (0–6) ou `day_of_month`
- `recurrence_until` = data limite opcional
- As ocorrências futuras são **calculadas em runtime** (no calendário, no dashboard, no PDV) — não duplicadas no banco.
- Produtos, tarefas e checklist ficam atrelados ao evento-mãe e são reutilizados a cada ocorrência. O **caixa fechado** vira histórico por ocorrência (nova tabela `event_occurrences` com `occurrence_date` + snapshot).

---

## 3. Produtos do evento bagunçados

Hoje você digita nome, preço e quantidade na mão, sem ligação real com receita. Vou refazer o seletor:

1. Botão **"Adicionar produto"** abre um modal:
   - Escolhe a **receita** (autocomplete).
   - Escolhe o **modo de venda**: `inteiro` ou `fatia`.
   - Se for fatia: puxa `recipes.servings` e calcula automaticamente preço/fatia sugerido a partir de `public_price` ou custo + margem da loja.
   - Mostra **custo real** da unidade (ingredientes × qty), **margem** prevista e **alerta de insumos faltando** (cruzando `recipe_ingredients` × `ingredients.stock_qty`).
2. Quantidade planejada vira **lotes da receita** (mais intuitivo) com conversão automática para fatias.
3. Imagem do produto puxa de `recipes.image_url` automaticamente (com opção de override).

Resultado visual: card limpo com foto, nome, preço unitário, **custo unit / margem**, planejado/vendido/restante. Sem campos soltos.

---

## 4. PDV: carrinho flutuante, estoque, edição de produto, imagens

Problemas confirmados em `src/routes/pdv.tsx`:
- Carrinho não tem indicador flutuante visível (só um card lá em cima).
- `addToCart` **não respeita** `planned_qty − sold_qty` (deixa adicionar infinito).
- Não dá pra editar produto avulso (só criar) e não tem upload de imagem.

**Vou implementar:**
- **FAB de carrinho** flutuante no canto inferior direito, sempre visível com badge de itens e total. Toque abre o drawer.
- **Trava de estoque**: `addToCart` impede passar de `left = planned_qty - sold_qty - inCart`. Botão fica disabled e mostra "Esgotado" no card.
- **Upload de imagem** para `pdv_products` via Supabase Storage (bucket novo `product-images`, público).
- Modal de edição completo do produto avulso (label, preço, ícone, tom, imagem).

---

## 5a. Sistema de temas por loja (multi-cliente)

Hoje as cores estão hard-coded em `src/styles.css` (`--rose`, `--blush`, `--mauve`...). Pra cada confeiteira ter seu estilo:

- Adicionar à tabela `shops` um campo `theme` JSONB com `{ primary, accent, background, font, preset }`.
- Criar um `<ThemeProvider>` no `__root.tsx` que injeta variáveis CSS dinamicamente a partir de `currentShop.theme` (sobrescrevendo `--primary`, `--rose`, `--blush`, etc.).
- Criar uma página **Configurações → Marca** com:
  - 6 presets prontos (Rosé, Lavanda, Menta, Caramelo, Chocolate, Monocromático).
  - Color picker para personalizar.
  - Seleção de fonte display (Playfair, Cormorant, DM Serif, Fraunces).
  - Upload de logo.
  - Preview ao vivo.

A vitrine pública aplica o mesmo tema automaticamente.

---

## 5b. Lista de insumos densa (3 por linha)

Hoje é uma linha por insumo (largura desperdiçada). Vou converter para **grid de cards micro** (3 colunas em desktop, 2 em tablet, 1 em mobile estreito) com:
- Nome (negrito) + ícone de alerta se estoque ≤ 0
- Embalagem · preço · custo/unidade em uma linha discreta
- Badge de estoque colorido
- Hover revela ações de editar/excluir

Mantém a tabela como modo alternativo via toggle "lista / grade".

---

## 6. Catálogo + Vitrines personalizáveis

### Catálogo interno (`/catalogo`)
Hoje é uma lista chata com toggle de visibilidade e preço. Vou refazer como:
- **Duas abas no topo**: `Vitrine da loja` | `Vitrines de eventos`
- Cards com **imagem** (upload via Supabase Storage), descrição, preço, badge de visibilidade.
- Drag-and-drop pra reordenar (`recipes.catalog_position`).
- Categorias/tags opcionais (`recipes.category`).
- Para "Vitrines de eventos": lista os eventos e cada um abre sua própria vitrine pública (`/loja/{slug}/evento/{event_slug}`) que mostra só os produtos daquele evento.

### Vitrine pública (`/loja/{slug}` e nova `/loja/{slug}/e/{event_slug}`)
Adicionar tabela `shop_storefront` (1-1 com shops) com:
- `hero_title`, `hero_subtitle`, `banner_url`
- `theme_overrides` (cores específicas da vitrine, separadas do app)
- `sections` JSONB: lista ordenada de blocos (banner, destaques, categorias, depoimentos, sobre, contato)
- `promotions` JSONB: lista de promoções ativas
- `social` JSONB: instagram, whatsapp, endereço, horários

Página nova **"Minha vitrine"** no painel com **editor visual**:
- Lista de seções arrastáveis com toggle on/off
- Edição inline de cada bloco (banner com upload, título, texto)
- Cadastro de promoções com preço de/por e validade
- Preview ao vivo lado a lado em modo desktop/mobile
- Botão "copiar link" da vitrine geral e de cada vitrine de evento

---

## Plano técnico de execução (ordem)

```text
ONDA A — Fundação
  1. Migração: shops.theme, shops.target_margin, shop_storefront, recipes.category/catalog_position/image_url
  2. Migração: events.weekday/day_of_month, event_occurrences (snapshot por ocorrência)
  3. Bucket Storage product-images + recipe-images + storefront-banners (público, RLS por shop)
  4. ThemeProvider em __root.tsx aplicando variáveis CSS do shop atual

ONDA B — Dashboard de verdade
  5. Função SQL ou util TS calc_real_costs(shop_id, period) usando recipe_ingredients
  6. Refazer cards do dashboard: faturamento (já ok), custos reais, lucro real, margem real, meta editável

ONDA C — Eventos consertados
  7. UI de recorrência: dropdown semanal/mensal + dia da semana + até quando
  8. Geração de ocorrências futuras em runtime (helper getOccurrences)
  9. Fechamento de caixa grava em event_occurrences (não no evento-mãe)
  10. Calendário e dashboard mostram ocorrências calculadas

ONDA D — Produtos de evento conectados à receita
  11. Modal "Adicionar produto" com seletor de receita + modo (inteiro/fatia) + cálculo automático
  12. Card de produto mostrando custo real, margem, faltando insumos
  13. Quantidade em lotes ↔ unidades

ONDA E — PDV polido
  14. FAB de carrinho flutuante persistente
  15. Trava de estoque com left = planned - sold - inCart
  16. Upload de imagem em pdv_products + edição completa
  17. Confirmação visual de adicionar (mini animação no FAB)

ONDA F — Insumos densos
  18. Grid 3 colunas com cards compactos + toggle lista/grade

ONDA G — Catálogo + Vitrines
  19. /catalogo refeito com 2 abas, upload de imagem nas receitas, drag-and-drop, categorias
  20. /loja/{slug}/e/{event_slug} — vitrine de evento
  21. Nova página /vitrine — editor visual de seções, promoções, branding
  22. Aplicar shop_storefront.theme_overrides nas duas vitrines
  23. Botões de "copiar link" e "abrir vitrine" em ambos os contextos
```

---

## Mudanças no banco (resumo)

```sql
-- shops
ALTER TABLE shops
  ADD COLUMN theme JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN target_margin NUMERIC DEFAULT 0.30;

-- recipes
ALTER TABLE recipes
  ADD COLUMN category TEXT,
  ADD COLUMN catalog_position INT DEFAULT 0;

-- events: trocar parent_event_id por modelo de instância única
ALTER TABLE events
  ADD COLUMN weekday INT,            -- 0..6
  ADD COLUMN day_of_month INT;       -- 1..31

CREATE TABLE event_occurrences (
  id UUID PK,
  event_id UUID REFERENCES events ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  closed_at TIMESTAMPTZ,
  payment_summary JSONB,
  UNIQUE (event_id, occurrence_date)
);

CREATE TABLE shop_storefront (
  shop_id UUID PK REFERENCES shops,
  hero_title TEXT,
  hero_subtitle TEXT,
  banner_url TEXT,
  theme_overrides JSONB DEFAULT '{}'::jsonb,
  sections JSONB DEFAULT '[]'::jsonb,
  promotions JSONB DEFAULT '[]'::jsonb,
  social JSONB DEFAULT '{}'::jsonb
);

-- pdv_products: imagem
ALTER TABLE pdv_products ADD COLUMN image_url TEXT;
```

Tudo com RLS espelhando os padrões já existentes (`is_shop_member` / `has_shop_role`); leitura pública anônima apenas em `shop_storefront` e nas listas que ela referencia.

---

## Notas

- Trabalho longo: vou fazer em ondas A→G, validando build e comportamento entre cada uma. Você só recebe a checklist final no fim, como você pediu.
- Nada de remover funcionalidades existentes — só evoluir.
- Vou preservar a paleta atual como **preset "Rosé"** padrão para sua loja não mudar visualmente.

Aprova pra eu sair fazendo?
