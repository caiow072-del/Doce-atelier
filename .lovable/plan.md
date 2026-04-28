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

### Onda C — Eventos: recorrência única + ocorrências ✅
- [x] UI de recorrência: dropdown semanal/mensal + dia da semana + "até quando"
- [x] Não duplica mais eventos no banco — uma única linha com weekday/day_of_month/recurrence_until
- [x] Calendário consome `getOccurrences()` para expandir recorrentes em runtime
- [x] PDV inclui eventos recorrentes com ocorrência nos próximos 7 dias
- [x] Card da lista mostra "próx: dd/mm" para recorrentes
- [ ] (futuro) Script de migração para colapsar eventos antigos duplicados (parent_event_id)
- [ ] (futuro) Fechamento de caixa por ocorrência em `event_occurrences`

### Onda D — Produtos do evento ligados à receita ✅
- [x] Modal "Adicionar produto" com busca de receita
- [x] Modo de venda inteiro/fatia (auto-calcula preço sugerido e qtd planejada)
- [x] Custo real, margem prevista colorida e alerta de insumos faltando
- [x] Quantidade em lotes da receita (com conversão automática)
- [x] Imagem puxa de `recipes.image_url` por padrão
- [x] Lista de produtos mostra custo/margem por linha

### Onda E — PDV polido ✅
- [x] FAB de carrinho flutuante com badge de itens e total
- [x] Trava de estoque: `addToCart` impede passar de `planned − sold − inCart`
- [x] Badge "Esgotado" no card quando acabar (e contador no canto quando há no carrinho)
- [x] Upload de imagem para `pdv_products` + edição completa em `ManageProductsSheet`
- [x] Mini animação de confirmação ao adicionar (badge anima e FAB salta)

### Onda F — Insumos densos ✅
- [x] Grid 3+ colunas com cards compactos (nome, embalagem · preço · custo/un, badge de estoque)
- [x] Toggle lista/grade com persistência em localStorage
- [x] Alerta visual em estoque ≤ 0 (badge destrutivo)

### Onda G+ — Catálogo & vitrine ✅
- [x] `/catalogo` com 2 abas: vitrine da loja | vitrines de eventos (com copiar link)
- [x] Reordenar receitas (catalog_position com botões ↑/↓ + persistência)
- [x] Categorias/tags em recipes (datalist + filtro pills na vitrine pública)
- [x] Seções arrastáveis na vitrine (já existia: ↑/↓ + visibilidade)
- [x] Promoções renderizadas com badge "PROMO" e preço de/por (match por nome)
- [x] Botão "compartilhar vitrine" com QR Code (qrcode.react) no editor

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
