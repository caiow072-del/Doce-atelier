# Cakes Manager — Plano e Checklist

> Atualizado em 28/04/2026 — pós editor de vitrine ao vivo.

---

## ✅ Já feito

### Onda A — Fundação & Branding
- [x] Migrações: `shops.theme`, `shops.target_margin`, `shop_storefront`, `recipes.category/catalog_position/image_url`, `events.weekday/day_of_month`, `event_occurrences`, `pdv_products.image_url`
- [x] Buckets de storage públicos: `recipe-images`, `product-images`, `storefront-banners` (com RLS por shop)
- [x] `ThemeProvider` em `__root.tsx` aplicando variáveis CSS do shop atual
- [x] 6 presets de cor + 4 fontes display com Google Fonts dinâmico
- [x] Helpers: `costs.ts` (custo real de receita), `recurrence.ts` (ocorrências em runtime), `upload.ts`

### Onda G (parcial) — Vitrine personalizável
- [x] Tabela `shop_storefront` com hero, banner, social, promoções
- [x] Vitrine pública `/loja/{slug}` aplicando tema da loja
- [x] Vitrine de evento `/loja/{slug}/e/{event_id}`
- [x] **Editor `/vitrine` com preview ao vivo embutido** (iframe + postMessage, toggle desktop/mobile, publicar único)
- [x] Upload de banner direto no editor
- [x] Aba de promoções no editor
- [x] Lista de vitrines de eventos com link "copiar/abrir"

---

## 🔜 Próximas ondas (em ordem de prioridade)

### Onda B — Dashboard com lucros reais ✅
- [x] Custo real via `recipeCost()` cruzando `sales.item → recipes` (match por nome) + `recipe_ingredients` + `ingredients`
- [x] Margem real comparada com `shops.target_margin` (cor verde/amarelo/vermelho)
- [x] Cards "Mais lucrativos" e "Dando prejuízo" no dashboard
- [x] Indicador "% estimado" quando venda não bate com receita
- [ ] (futuro Onda D) Substituir match por nome → `pdv_products.recipe_id` direto

### Onda C — Eventos: recorrência única + ocorrências
- [ ] UI de recorrência: dropdown semanal/mensal + dia da semana + "até quando"
- [ ] Parar de duplicar eventos no banco — gerar via `getOccurrences()` em runtime
- [ ] Calendário, dashboard e PDV consumindo ocorrências calculadas
- [ ] Fechamento de caixa grava em `event_occurrences` (uma linha por data)
- [ ] Migrar eventos antigos duplicados para o novo modelo (script seguro)

### Onda D — Produtos do evento ligados à receita
- [ ] Modal "Adicionar produto" com seletor de receita (autocomplete)
- [ ] Modo de venda: inteiro / fatia (puxa `servings` e calcula preço/fatia automaticamente)
- [ ] Mostra custo real, margem prevista, alerta de insumos faltando
- [ ] Quantidade em **lotes da receita** (com conversão para unidades)
- [ ] Imagem puxa de `recipes.image_url` por padrão

### Onda E — PDV polido
- [ ] FAB de carrinho flutuante com badge de itens e total
- [ ] Trava de estoque: `addToCart` impede passar de `planned − sold − inCart`
- [ ] Botão "Esgotado" no card quando acabar
- [ ] Upload de imagem para `pdv_products` + modal de edição completo
- [ ] Mini animação de confirmação ao adicionar

### Onda F — Insumos densos
- [ ] Grid 3 colunas com cards compactos (nome, embalagem · preço · custo/un, badge de estoque)
- [ ] Toggle lista/grade
- [ ] Alerta visual em estoque ≤ 0

### Onda G+ — Catálogo & vitrine (completar)
- [ ] `/catalogo` com 2 abas: vitrine da loja | vitrines de eventos
- [ ] Drag-and-drop de receitas (`recipes.catalog_position`)
- [ ] Categorias/tags (`recipes.category`) com filtro na vitrine pública
- [ ] Seções arrastáveis na vitrine (`shop_storefront.sections`): destaques, depoimentos, sobre, contato
- [ ] Renderizar promoções na vitrine pública com badge "promo" e preço de/por
- [ ] Botão "compartilhar vitrine" com QR Code

### Onda H — Qualidade, segurança, performance
- [ ] Rodar `supabase--linter` e zerar warnings de RLS
- [ ] Lazy-load de rotas pesadas (`/eventos`, `/pdv`, `/loja.$slug`)
- [ ] Imagens com `loading="lazy"` e `srcset`
- [ ] SEO por rota: og:image dinâmico em `/loja/{slug}` (banner)
- [ ] Service worker / offline básico para PDV
- [ ] Auditoria de inputs públicos (orders/customers via storefront) com Zod no servidor
- [ ] Rate-limit por IP nas rotas públicas (edge function)

---

## Notas de arquitetura
- **Preview ao vivo**: `/vitrine` carrega `/loja/{slug}?preview=1` num iframe. A loja escuta `postMessage` para aplicar tema/draft sem salvar. "Publicar" persiste tudo de uma vez.
- **Sem duplicar UI**: o editor não recria a página da loja — usa a real, garantindo que o que o cliente vê = o que a confeiteira edita.
- **Tema escopado**: `applyTheme()` injeta variáveis CSS no `:root`. Ao publicar, o dashboard da própria dona também atualiza.
