# 00 — Análise do Dália Concept

> Documento de referência arquitetural para o projeto **Caqui Trekking**.
> Tarefa de leitura e análise. Nenhuma linha de código foi escrita, alterada ou executada.

---

## Nota de método

Esta análise foi produzida por 14 agentes em paralelo sobre a cópia local do Dália Concept
(`client - cópia/` e `server - cópia/`), com 608 leituras de arquivo. A divisão:

- **8 leitores**, um por dimensão do briefing (stack, estrutura, modelagem, carrinho, auth, API, imagens, SEO);
- **2 críticos adversariais**, um com lente de segurança e outro de corretude/manutenibilidade, instruídos a caçar problemas e não a fazer turismo pelo código;
- **3 verificadores céticos**, que receberam as acusações dos críticos e tentaram **refutá-las** abrindo o código, com ordem explícita de marcar REFUTADO em caso de dúvida;
- **1 crítico de completude**, que auditou o que ficou de fora e preencheu as lacunas.

**Resultado da verificação: 36 achados brutos → 30 acusações submetidas → 20 CONFIRMADAS, 10 PARCIAIS, 0 REFUTADAS.**

Duas ressalvas honestas sobre esse número:

1. **Zero refutação é um sinal ambíguo.** Pode significar críticos disciplinados (todos citaram `arquivo:linha` e os verificadores conferiram), mas também pode significar verificadores menos hostis do que o pedido. As 10 PARCIAIS mostram que houve contestação real — em todas elas o verificador **reduziu o impacto alegado**, e essas correções estão registradas em linha ao longo do documento, marcadas como _(o verificador corrigiu: …)_.
2. **Os dois críticos convergiram sozinhos nos mesmos quatro problemas de topo** (segredo JWT, rate limit falso, custo exposto, carrinho sem revalidação), trabalhando sem ver o resultado um do outro. Achado duplicado por lentes independentes é o sinal mais forte que este método produz — esses quatro são os mais confiáveis do documento.

Restrições respeitadas: `node_modules/` e `dist/` fora do escopo; **os valores do `.env` nunca foram lidos** (só os nomes das variáveis).

---

## Correção de premissa: **não existe Prisma neste projeto**

O briefing pede, no item 3, "como o schema do Prisma está organizado". O Dália **não usa Prisma, não usa SQL e não tem migration**. Usa **Mongoose 8.18.0 sobre MongoDB**, com 11 schemas declarados em JavaScript puro, sem geração de tipos e sem versionamento de schema.

Isso não é um detalhe de vocabulário. É a primeira decisão real que a Caqui precisa tomar, e ela está tratada na seção final. O item 3 foi respondido integralmente — naming, enums, índices, soft delete, timestamps, dinheiro — no equivalente Mongoose.

---

# 1. Stack completa, com versões

## Frontend — `client/`

| Camada     | Escolha                                           | Versão                                               |
| ---------- | ------------------------------------------------- | ---------------------------------------------------- |
| UI         | React                                             | 19.1.1                                               |
| Build      | Vite                                              | 7.1.5 (`@vitejs/plugin-react` 5.0.2, variante Babel) |
| Roteamento | react-router-dom                                  | 7.8.2 (data router, `createBrowserRouter`)           |
| Estilo     | Tailwind CSS + `@tailwindcss/vite`                | 4.1.13                                               |
| HTTP       | axios                                             | 1.12.1 (33 arquivos)                                 |
| Animação   | framer-motion                                     | 12.23.12 (34 arquivos)                               |
| Deploy     | Vercel (SPA + 2 funções serverless)               | —                                                    |
| Node       | 22 via `.nvmrc` (só no front)                     | —                                                    |
| Linguagem  | **JavaScript puro** — zero `.ts`, zero `tsconfig` | —                                                    |

A configuração do Vite tem **8 linhas** e nenhuma decisão dentro dela: sem `manualChunks`, sem `alias`, sem `server.proxy`. Consequência medida: o build é **um único chunk de 811.214 bytes** ([client/dist/assets/index-By0O7esI.js](client%20-%20cópia/dist/assets/index-By0O7esI.js)).

Tailwind 4 usa configuração **CSS-first**: não existe `tailwind.config.js` em lugar nenhum. O tema vive no bloco `@theme` de [src/index.css:6-22](client%20-%20cópia/src/index.css) — paleta, quatro famílias tipográficas e um breakpoint extra `--breakpoint-xs: 375px`.

### Bootstrap não estiliza nada — confirmado

Você pediu confirmação explícita e ela é categórica. `bootstrap@5.3.8` e `react-bootstrap@2.10.10` estão declarados em [package.json:17,22](client%20-%20cópia/package.json) e têm **zero imports em todo o código-fonte** e **zero bytes no bundle gerado** (grep em `src/` e em `dist/`: nada). Tailwind 4 é o único sistema de estilo real.

Não é caso isolado: **6 das 14 dependências de produção do front (43%) nunca são importadas** — `bootstrap`, `react-bootstrap`, `@heroui/spinner`, `lenis`, `canvas-toBlob` e `tailwind-scrollbar-hide`. Ironia dupla: `tailwind-scrollbar-hide` está instalado, nunca é registrado como plugin, e a funcionalidade dele foi reescrita à mão em [index.css:46-48](client%20-%20cópia/src/index.css).

Sobra também um `"proxy": "http://localhost:3000"` em [package.json:6](client%20-%20cópia/package.json) — sintaxe do Create React App, que **o Vite ignora completamente**. Lixo herdado que nunca fez nada.

## Backend — `server/`

| Camada      | Escolha                            | Versão                          |
| ----------- | ---------------------------------- | ------------------------------- |
| Runtime     | Node ESM (`"type": "module"`)      | sem `.nvmrc`, sem `engines`     |
| Framework   | Express                            | 5.1.0                           |
| ODM / Banco | Mongoose / MongoDB Atlas           | 8.18.0                          |
| Auth        | jsonwebtoken                       | 9.0.2                           |
| Validação   | Joi                                | 18.0.1                          |
| Upload      | multer + multer-storage-cloudinary | 2.0.2 / 4.0.0                   |
| Storage     | Cloudinary                         | **1.41.3 (uma major atrasada)** |
| Deploy      | **Render, plano grátis — hiberna** | —                               |

`cloudinary@1.x` está preso por `multer-storage-cloudinary@4.0.0`, que declara `peerDependency: cloudinary ^1.21.0`. `bcrypt@6.0.0` está declarado e **nunca é importado em nenhuma linha do `v1/`** — um módulo nativo que compila em todo deploy da Render sem servir a nada.

### Arquitetura de deploy e o preço do plano grátis

O projeto está em **duas plataformas**: Vercel (SPA + `api/prerender.js` + `api/sitemap.js`) e Render (API Express). A escolha do plano grátis **vazou para dentro do código de aplicação**: [src/api/axios.js:10](client%20-%20cópia/src/api/axios.js) declara timeout de **90 segundos** e o interceptor faz **5 retries**, com uma segunda implementação de retry duplicada em [api/_lib.js:71-114](client%20-%20cópia/api/_lib.js). Na pior hipótese, a primeira visitante depois da hibernação espera 90 segundos olhando skeleton.

### Testes, CI e lint

**Zero testes.** Nenhum runner instalado, nenhum arquivo `.test`/`.spec`/`__tests__`/`.cy`, nenhum script `test`, nos dois lados.

**Zero CI.** Sem `.github/`, sem `.yml`, sem husky, sem pre-commit. O único gate entre um commit e a produção é o Vite compilar.

**Lint pela metade.** Existe `eslint.config.js` só no front, roda só na mão via `npm run lint`. O backend **não tem sequer um arquivo de config de ESLint** — 67 arquivos sem lint, incluindo os controllers que mexem em dinheiro e estoque.

**Sem lockfile no front.** Não há `package-lock.json`, `yarn.lock` nem `pnpm-lock.yaml` no `client/`. Cada build da Vercel re-resolve 24 ranges `^` contra o registry: um minor com regressão em `framer-motion` ou `tailwind` entra em produção sozinho, num deploy que não mudou uma linha, e não há um único teste para pegar. O `server/` tem lockfile e está consistente.

### Variáveis de ambiente (só os nomes)

`MONGODB_URI` · `PORT` · `JWT_SECRET` · `JWT_EXPIRES_IN` · `ADMINLOGIN` · `ADMINPASSWORD` · `CLOUDINARY_CLOUD_NAME` · `CLOUDINARY_API_KEY` · `CLOUDINARY_API_SECRET` · `GEMINI_API_KEY` · `TRYON_PROVIDER`

Duas observações:

1. **`GEMINI_API_KEY` e `TRYON_PROVIDER` não são referenciados por nenhuma linha do projeto** — credenciais órfãs de uma feature de provador virtual abandonada, que continuam válidas e expostas.
2. **O front tem ZERO variáveis `VITE_*`.** A URL da API está hardcoded em [src/api/axios.js:4-6](client%20-%20cópia/src/api/axios.js), [api/_lib.js:8](client%20-%20cópia/api/_lib.js) e [vercel.json:9](client%20-%20cópia/vercel.json); o domínio da loja, em [src/config/site.js:8](client%20-%20cópia/src/config/site.js) e [feed-controller.js:10](server%20-%20cópia/v1/controllers/feed-controller.js). **Não existe ambiente de homologação possível** — qualquer build de produção fala com o banco de produção.

---

# 2. Estrutura de pastas e a convenção por trás dela

## Backend — a convenção é real, e é o melhor ativo dos dois repositórios

```
server/v1/
  routes/       10 arquivos  *-routes.js
  controllers/  10 arquivos  *-controller.js
  services/      9 arquivos  *-services.js
  models/       11 arquivos  *-model.js
  validation/    7 arquivos  *-schema.js
  middlewares/   auth-middleware.js · multer-upload.js
  utils/         api-response.js · mongodb-connection.js · numeric.js
  errors/        errors.js
  config/        cloudinary.js
```

Fluxo: `route → controller → service → model`, com Joi rodando **dentro do service**, não como middleware de rota.

**Pergunta central — a camada de service é respeitada, ou é pasta decorativa? Resposta: é real. 9 de 10 controllers passam pelo service.** O único desvio é [settings-controller.js:1](server%20-%20cópia/v1/controllers/settings-controller.js), que importa o Model direto. Isso é arquitetura em camadas de verdade e o pedaço mais reaproveitável do projeto inteiro.

Onde a convenção vaza: **lógica de domínio dentro do controller**. [product-controller.js:28-33](server%20-%20cópia/v1/controllers/product-controller.js) gera o `dalia_id` com `Math.random()`; as linhas 67-89 têm 23 linhas de ordenação de imagem; [feed-controller.js](server%20-%20cópia/v1/controllers/feed-controller.js) tem 144 linhas das quais só ~35 são HTTP — taxonomia do Google, material e gênero estão todos ali.

`v1/errors/` exporta 7 classes, das quais **3 têm zero uso** (`UnauthorizedError`, `ForbiddenError`, `SendEmailError`). E `errors.js:1-6` carrega apenas `message` e um `name` que ninguém lê — sem `statusCode`, sem `code` estável, o que obriga cada `catch` a reescrever o mapeamento para HTTP.

**Não existe error handler global.** `grep 'err, req, res, next'` no backend inteiro retorna vazio. O resultado são ~54 métodos de controller com o mesmo try/catch e **52 chamadas de `ApiResponse.ERROR` copiadas**.

## Frontend — o critério de divisão não se sustenta

```
client/src/
  pages/        17 arquivos — loja pública E painel admin, misturados
  components/   layout · modules · navigation · seo · skeletons · ui
  context/      CartContext · FavoritesContext
  hooks/        10 hooks — só LEITURA
  config/       site · nav · categories · seo-copy
  content/      institucional · policies
  utils/ api/
```

A divisão de `components/` é por **forma visual** (primitivo / bloco / chrome), não por domínio. Nada na árvore diz se um arquivo é da loja ou do CRM — e o critério quebra na prática: `ui/Charts.jsx` são 163 linhas de gráfico usadas só por `Relatorios.jsx`; `layout/` guarda `Header` da loja e `AdminHeader` do painel lado a lado; `modules/` tem 6.413 linhas, das quais **5.454 (85%) são CRM**.

`pages/` despeja as 10 telas do painel junto com as 7 da loja. Somando páginas e módulos exclusivos do admin: **~10.294 de 16.952 linhas do `src/` são CRM (61%)**, e todas vão no mesmo bundle que a visitante da loja baixa — porque não existe **uma única ocorrência** de `React.lazy` ou `Suspense` em todo o `src/`.

Essa mistura não é estética. Ela produziu bugs reais em produção, documentados na seção 5.

`hooks/` cobre **só leitura**: não há um único `api.post/put/patch/delete` na pasta. As 24 escritas estão espalhadas por 15 modais, 7 páginas e 2 contexts. **Nenhum lugar único sabe qual é o payload de criar uma venda.**

Duplicação sistemática — o sintoma mais objetivo da fronteira ausente:

| Função               | Cópias                  | Onde                                                                                                                                         |
| -------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `formatBRL`          | **10**                  | `utils/format.js` + 8 componentes + `api/_lib.js` (uma delas, em `ShoppingCart.jsx:20`, formata diferente do resto: sem separador de milhar) |
| `slugify`            | **3**                   | `src/utils/slug.js` · `api/_lib.js` · `feed-controller.js`                                                                                   |
| `escapeXml`          | 2                       | `api/_lib.js` · `sitemap.js`                                                                                                                 |
| Telefone do WhatsApp | **5 linhas / 3 fontes** | `generateWhatsappLink.js:4` · `FloatingActions.jsx:8` · `Footer.jsx:160` e `:183` · `site.js:27` (que 4 dos 5 consumidores ignoram)          |
| JSON-LD de Product   | 2                       | `prerender.js` · `Seo.jsx`                                                                                                                   |

A constante `BRAND` **já divergiu**: `Dália Concept` no site e no prerender, `Dália` no feed do Google ([feed-controller.js:11](server%20-%20cópia/v1/controllers/feed-controller.js)).

Código morto no front: `Searchbar.jsx` (324 linhas), `Carousel.jsx` (89), `Banner.jsx` (28), `ImageCard.jsx` (28), `Button.jsx` — ninguém importa. `Searchbar.jsx` e `SearchBox.jsx` diferem por **uma letra maiúscula** e só o segundo está vivo.

Páginas gigantes absorvendo componentes: `Dashboard.jsx` tem 1.015 linhas, `Catalog.jsx` 992, com sub-componentes definidos inline.

### Armadilha de ordem de módulos ESM

[v1/app.js:8](server%20-%20cópia/v1/app.js) chama `configDotenv()` no corpo do módulo. Como imports ESM são içados, **todos os módulos importados são avaliados antes**, incluindo `jwt-services.js`, que lê `process.env.JWT_SECRET` no topo do arquivo. Hoje isso só não quebra porque o script `dev` usa `--env-file` — e o script `start` **não usa** ([package.json:4-5](server%20-%20cópia/package.json)). Ver o achado D3 na seção 8.

---

# 3. Modelagem de dados (Mongoose) — o item que o briefing chamou de "schema do Prisma"

11 schemas: `product` · `sale` · `client` · `fornecedor` · `compra-fornecedor` · `item-compra` · `saida` · `stock-movement` · `favorite` · `settings` · `counter`.

## 3.1 Naming — três convenções dentro do mesmo documento

`product-model.js` tem, em 30 linhas: `name`, `price`, `stock` (inglês) ao lado de `custo`, `custoEmbalagem`, `hipoalergenico` (português) e `dalia_id` (snake_case, num arquivo onde todo o resto é camelCase). Isso se repete em outros models e é a fratura mais visível do projeto.

## 3.2 Enums — três onde há, seis onde deveria haver

`enum: [...]` existe em `stock-movement.type`, `saida.tipo` e `sale` (canal). **Não existe** em `Product.category` — que é `String` livre ([product-model.js:16](server%20-%20cópia/v1/models/product-model.js)) — nem em `Product.material`, `colorGroup`, `colorName`.

O custo disso está documentado pelo próprio autor. A lista real de 12 categorias vive num array do bundle do front, [src/config/categories.js:7-20](client%20-%20cópia/src/config/categories.js), e o comentário nas linhas 2-5 descreve o modo de falha textualmente: **se uma categoria sai da lista, o `<select required>` não acha a opção e o produto trava no save**. Um produto salvo com categoria fora da lista fica editável só via banco. O relatório por categoria agrupa por string bruta — `anéis` e `aneis` viram duas linhas do gráfico. Já foi preciso um script de limpeza em massa (`scripts/merge-colares.js`) e há heurística de substring no navegador para compensar (`Catalog.jsx:463`: `m.includes('dourad')`).

O contraexemplo bom está no mesmo repositório: [saida-model.js:3-18](server%20-%20cópia/v1/models/saida-model.js) exporta `TIPOS_SAIDA` e aplica `enum: TIPOS_SAIDA` no schema. Mas os rótulos legíveis foram **redigitados à mão no front** (`useSaidas.jsx:32-41`), sem vínculo com o servidor: adicionar um tipo no backend faz a UI exibir a chave crua.

## 3.3 Índices — dois redundantes, cinco faltando

O único conjunto exemplar é [saida-model.js:33-34](server%20-%20cópia/v1/models/saida-model.js): `{data:-1}` e `{tipo:1, data:-1}`, que casam exatamente com o filtro e o sort do serviço. `stock-movement` também acerta com `{productId, createdAt:-1}`.

Redundantes: `index: true` em campo que já é prefixo de um composto (`favorite-model.js:8`, `stock-movement-model.js:12`).

Faltando: nada em `Sale.items` (e o `$unwind` do "mais vendidos" varre a coleção inteira — ver D18); regra de unicidade de cliente implementada só na aplicação, sem unique index no banco, com um `catch` de erro 11000 que é **código morto** (`client-services.js:18`).

## 3.4 Soft delete — não existe em nenhum dos 11 models

Todo delete é físico. O caso mais caro: [client-services.js:51-53](server%20-%20cópia/v1/services/client-services.js) faz `Client.findByIdAndDelete(id)` seguido de `Sale.deleteMany({ clientId: id })` — **apagar um cliente apaga o faturamento histórico dele**, sem transação e sem log. Apagar um `Product` deixa `StockMovement` e `Favorite` órfãos.

_(O verificador corrigiu: existe sim um `confirm()` avisando que o histórico será removido, em `ClientDetail.jsx:104-108`. O que não existe é soft delete, transação, dimensionamento do estrago — "isto apagará 14 vendas, R$ X" — nem trilha de auditoria. A severidade cai de alta para média.)_

## 3.5 Timestamps — dois vocabulários e um schema órfão

`createdAt`/`updatedAt` em 6 models; `criadoEm`/`atualizadoEm` em 4. E `counter-model.js` não tem timestamp nenhum — justamente o mais opaco de diagnosticar quando a numeração de SKU dá problema.

## 3.6 Dinheiro — **CRÍTICO: float IEEE-754 em tudo**

Todo valor monetário é `Number` (double): [product-model.js:11](server%20-%20cópia/v1/models/product-model.js), `sale-model.js:12` e `:23`, `compra-fornecedor`, `item-compra`.

Consequências medidas pelos agentes:

- `1000 × R$ 29,90` = `29900.000000000517`.
- O helper `round2` de `utils/numeric.js`, escrito justamente para compensar isso, **erra sistematicamente acima de R$ 8.192,00** — 11.470 falhas em 199.999 casos testados; `round2(8362.505)` devolve `8362.50`.
- Existem **6 virtuals defensivos** em `item-compra-model.js:42-74` só para lidar com as consequências.

Todo esse subsistema — `numeric.js` mais os virtuals — existe unicamente para compensar a escolha do tipo. Com Int de centavos ele desaparece inteiro.

Pior que a precisão: **o total da venda é calculado no navegador e aceito pelo servidor sem recomputação** (D9).

## 3.7 O contador atômico de SKU — genuinamente correto

[sku-service.js:40-47](server%20-%20cópia/v1/services/sku-service.js) usa `Counter.findOneAndUpdate({_id: prefixo}, {$inc:{seq:1}}, {new:true, upsert:true})` — uma única operação atômica no servidor do Mongo, sem read-modify-write. O campo no produto é `sku: { unique: true, sparse: true, immutable: true }`, e o serviço ignora qualquer SKU vindo do cliente. **`$inc` atômico + `unique` + `immutable` cobre os três modos de falha de um identificador sequencial**: corrida, duplicado e adulteração posterior.

Dois furos, respondendo à pergunta que você fez:

1. **O número é consumido ANTES do save** (`product-services.js:31` vs `:34`). Se o save falhar depois, o número já foi queimado e a série fica com buraco permanente.
2. **O prefixo vem de um campo mutável** (`category`, string livre) enquanto o `sku` é imutável. O `merge-colares.js` já produziu produtos com `category: 'colares'` e SKU `CR-xxxx`.

## 3.8 O estoque como ledger — a resposta é: **os dois, e sem transação**

Existe saldo materializado (`Product.stock`) **e** histórico (`StockMovement`). Eles podem divergir, e não há reconciliação.

`adjustStock` ([product-services.js:88-125](server%20-%20cópia/v1/services/product-services.js)) lê o produto, calcula `novo = atual + qty` **em memória**, grava com `product.save()` e **só então** cria o `StockMovement` — três idas ao banco sem `session`, sem transação, sem update atômico.

**Não existe uma única transação MongoDB em todo o repositório** (`grep session/withTransaction`: zero).

Cenário concreto de divergência: `product.save()` funciona, `StockMovement.create` falha por queda de rede — o número muda sem nenhum rastro, exatamente o que o comentário das linhas 64-65 promete impedir.

O que **está certo** e vale copiar: [product-services.js:66](server%20-%20cópia/v1/services/product-services.js) desestrutura e **descarta o `stock`** do payload do PUT genérico, com comentário explicando que toda alteração precisa passar pelo endpoint dedicado. Fechar a porta lateral é o que faz o ledger valer alguma coisa.

## 3.9 A decisão de disponibilidade manual — o Dália já testou isso

Achado do crítico de completude, e é o mais relevante para a Caqui de toda a modelagem:

**Registrar uma venda NÃO baixa estoque no Dália.** `sale-services.js` não contém a palavra `stock` em nenhuma linha. A decisão é explícita e documentada em três lugares, incluindo `product-services.js:15-18`:

```js
static BAIXAR_ESTOQUE_NA_VENDA = false;  // DESLIGADO de propósito: o controle de estoque é manual
```

E existe um método `baixarEstoqueDaVenda(sale)` **completo, escrito, e desligado** (`product-services.js:148-171`), que aborta na primeira linha por causa da flag e nunca é chamado. O único `type` do enum de movimento que descreveria o fluxo principal do negócio é o único que nunca é gravado.

Isso valida a decisão da Caqui de ter disponibilidade manual. E ensina duas coisas: **código dormente é pior que ausência de código** (o método desligado faz read-modify-write sem transação — no dia em que alguém virar a flag, entra em produção uma corrida nunca executada), e **flag de comportamento não pode ser constante de código**, porque virar exige deploy.

---

# 4. Carrinho — onde vive o estado, como persiste, como vira mensagem

Esta é a dimensão mais diretamente reaproveitável pela Caqui, e a que exige mais correção.

## 4.1 O estado

`useState` dentro de um Context, 70 linhas ([CartContext.jsx](client%20-%20cópia/src/context/CartContext.jsx)), montado acima do router. Sem reducer.

Forma do item — **totalmente desnormalizado**:

```js
{
  ;(id, productId, name, material, price, stock, image, qty, subtotal)
}
```

`price`, `stock` e `subtotal` são **congelados no momento em que o item foi adicionado**.

## 4.2 Persistência

Chave `"cart"` — nua, sem namespace, sem versão. Hidratação direta com `JSON.parse(localStorage.getItem('cart'))`, **sem `try/catch`** e sem validação de shape. JSON corrompido, modo privado ou storage bloqueado = **tela branca permanente no site inteiro**, porque não existe nenhum `ErrorBoundary` no projeto (grep: zero).

O arquivo vizinho, `FavoritesContext.jsx:22`, **faz certo** — try/catch, id de visitante namespaced, atualização otimista com reversão. Tudo certo lá e tudo errado no carrinho, no mesmo repositório.

Sem versionamento de formato: quando o shape do item mudar num deploy futuro, todo visitante com carrinho antigo no navegador quebra.

## 4.3 Revalidação com o servidor: **não existe. Nenhuma. Em lugar nenhum.**

Não há uma única chamada de API para reconferir preço ou disponibilidade antes de gerar o link do WhatsApp. A única chamada do drawer é `/sales/comprados-juntos`, para sugestões.

Dois custos concretos:

- **Sem má-fé:** a cliente adiciona um colar por R$ 89,90, volta duas semanas depois — o preço subiu para R$ 109,90 e a peça acabou, mas o carrinho e a mensagem mostram R$ 89,90 e "em estoque". A conversa começa com a loja desdizendo o próprio site.
- **Com má-fé:** `localStorage.setItem('cart', JSON.stringify([{name:'colar', price:1, qty:1, subtotal:1}]))` gera uma mensagem oficial do site dizendo "colar = R$ 1,00". A atendente, vendo a mensagem no formato do site, tende a acreditar.

## 4.4 A mensagem do WhatsApp

100% hardcoded em [generateWhatsappLink.js](client%20-%20cópia/src/utils/generateWhatsappLink.js). Telefone escrito na mão na linha 4. **Nenhum SKU ou id** vai na mensagem, e o nome do produto é forçado para minúsculo (`p.name.toLowerCase()`, linha 14) — o laço carrinho → CRM é 100% re-digitação manual.

**O que está certo:** `encodeURIComponent` aplicado **uma vez, sobre a mensagem inteira, no fim** (linha 41). Quebra de linha, acento, emoji e `&`/`=` no nome do produto sobrevivem todos. É a única linha do arquivo totalmente correta, e deve ser copiada exatamente assim.

**Plano B para desktop: não existe.** Li o rodapé inteiro do carrinho (`ShoppingCart.jsx:469-493`): dois botões e um aviso de frete. Nenhum "copiar mensagem", nenhum número visível em texto, nenhuma mensagem montada na tela. Todo visitante de desktop sem WhatsApp Web logado morre ali **sem gerar sinal nenhum**.

Pior: o CTA de finalizar usa `window.location.href` (`ShoppingCart.jsx:472`), que joga o visitante para fora do site e mata o ctrl+clique. O próprio projeto **já faz certo** em `FloatingActions.jsx:46` com `<a target="_blank">` — o caminho mais importante do funil recebeu o pior dos três tratamentos.

Detalhe: `clearCart` existe (`CartContext.jsx:61`) e **nunca é chamado**. O carrinho fica cheio para sempre depois de finalizar, e o `CartRecovery` cutuca o cliente sobre um pedido que ele já mandou.

## 4.5 Cupons — desconto auto-declarado

A tabela `COUPONS` está inteira num objeto literal do bundle ([coupons.js:3-6](client%20-%20cópia/src/utils/coupons.js)) e o cálculo roda no navegador. Qualquer visitante lê os códigos abrindo o JS da página. E como o "checkout" é uma URL de texto que o usuário controla por completo, **o desconto é literalmente auto-declarado**.

No Dália isso custa R$ 10-30 por incidente. Na Caqui, com ticket de R$ 300-1.500 e grupos de até 6 pessoas, um desconto forjado passa de R$ 600 numa única mensagem — lida por um monitor que não tem tabela nenhuma para conferir.

## 4.6 Datas e moeda

`grep timeZone` em todo o `src/`: **zero**. Toda formatação de data depende do fuso do navegador, e o hack `new Date(x + 'T12:00:00')` está replicado em quatro arquivos. Para o Dália é cosmético. **Para a Caqui, a data É o produto** — errar o dia da saída por fuso é erro fatal.

---

# 5. Proteção do admin/CRM e o botão fantasma

## 5.1 O login

```js
if (username === process.env.ADMINLOGIN && password === process.env.ADMINPASSWORD)
```

— [auth-controller.js:8](server%20-%20cópia/v1/controllers/auth-controller.js)

Sem hash, sem salt, sem comparação em tempo constante. **Sem modelo `User`**: o admin é um par de strings no `.env`. **Sem roles** — o payload do token é só `{ username }`. `bcrypt` está no `package.json` e nunca foi importado.

## 5.2 O token

JWT válido por **7 dias** (`JWT_EXPIRES_IN || '7d'`), guardado em `localStorage`. O "logout" é `localStorage.removeItem('jwtToken')` — **puramente local**. Não existe blocklist, não existe versão de sessão. O celular roubado com sessão aberta continua abrindo `/api/v1/clients` por até uma semana, e clicar em "Sair" noutro aparelho não muda nada. A única forma de invalidar é trocar o `JWT_SECRET` e derrubar todo mundo.

## 5.3 Cobertura do middleware — **a parte boa, e enumerada**

**44 de 55 rotas têm `authenticateToken`.** Todo o CRUD administrativo — produtos, clientes, vendas, fornecedores, compras, saídas, estoque, settings — está protegido, com o middleware declarado **rota a rota**, o que torna óbvio na leitura o que está aberto.

As rotas públicas são públicas de propósito e comentadas como tais (catálogo, mais-vendidos, comprados-juntos, feed, favoritos). As duas exceções que **não** deveriam estar assim:

- **Favoritos aceita escrita anônima** (`favorite-routes.js:9-10`): qualquer um cria, lê e apaga o dado de outra pessoa conhecendo só o `visitorId`, sem rate limit e sem verificar se o produto existe (D14).
- **O catálogo público vaza `custo` e `custoEmbalagem`** (D4).

Ordem de middleware **correta** nas rotas de upload: `authenticateToken` **antes** do multer (`product-routes.js:9`) — o inverso do erro comum. Uma requisição anônima com arquivo de 500 MB é rejeitada no header, sem queimar banda nem cota do Cloudinary.

## 5.4 O rate limit é ornamental

`MAX_ATTEMPTS = 3` e `LOCKOUT_MS = 10min` moram em `localStorage`, nas chaves `login_attempts` e `login_lockout_until` ([LoginPage.jsx:28-31](client%20-%20cópia/src/pages/LoginPage.jsx)). O incremento acontece **no `catch` do front**, depois de a requisição já ter ido e voltado.

No servidor: nenhum `express-rate-limit`, nenhum contador, nenhum bloqueio por IP. `app.js` registra apenas `cors()` e `express.json()`.

Um `curl` em loop nunca encontra o bloqueio — ele mora no navegador do atacante, que não usa navegador. Pela própria UI, `localStorage.clear()` no DevTools zera o contador. **A tela exibe "Bloqueado · tente em 9:47" sem oferecer proteção nenhuma, o que é pior do que não ter: ninguém volta para consertar o que parece resolvido.**

Regra que sai daqui: _se o controle pode ser apagado com `localStorage.clear()`, ele não é um controle._

## 5.5 O botão fantasma — **são 5 cliques no COPYRIGHT, não na logo**

Você pediu para verificar qual é a verdade no código. A descrição do PR e o briefing da Caqui divergem, e o código diz: **copyright do rodapé**.

Implementação em [Footer.jsx:27-38](client%20-%20cópia/src/components/layout/Footer.jsx) e `:215-222`: contador em `useState`, janela de 3s **entre toques**, e ao chegar em 5 faz `navigate('/login')`. Sem feedback visual em nenhum toque.

O modelo mental está **certo**: o gesto só revela a rota, e a proteção real é o `authenticateToken` aplicado rota a rota no backend.

Mas a execução se contradiz: o projeto gasta esforço escondendo o botão e depois **publica as rotas administrativas no `robots.txt`** — `/login`, `/dashboard`, `/clients`, `/admin/` estão listados em [public/robots.txt:6-13](client%20-%20cópia/public/robots.txt), legíveis por qualquer um. Mencionar é publicar.

## 5.6 CORS, headers e vazamento

- `cors()` **sem opções** ([app.js:12](server%20-%20cópia/v1/app.js)) = `Access-Control-Allow-Origin: *` em todas as rotas. _(O verificador corrigiu: o impacto real hoje é estreito — sem `credentials`, terceiros só leem o que já é público sem token. O que isso realmente expõe é o `custo` do catálogo, a partir de qualquer página de terceiros. As rotas do CRM continuam exigindo token.)_
- **Sem `helmet`**, **sem bloco `headers` no `vercel.json`**: nenhuma CSP, nenhum `X-Frame-Options`, nenhum `Referrer-Policy`, nenhum HSTS.
- **Todo erro 500 devolve `error.message` cru ao cliente** — o padrão `ApiResponse.ERROR(res, 'Erro ao criar cliente: ' + error.message)` se repete em todos os controllers, e o service concatena de novo antes, produzindo prefixo duplicado.

## 5.7 Bugs reais no fluxo de auth do front

Três, todos consequência direta de JS puro sem tipos:

1. **O token só é anexado dentro de um `.then()`.** `api.defaults.headers.common['Authorization']` é setado no callback de `GET /auth/validate-session` ([useAuth.jsx:20-25](client%20-%20cópia/src/hooks/useAuth.jsx)). Não existe request interceptor. Enquanto isso, os hooks de dados disparam no `useEffect` do mesmo mount, **imediatamente**. Em todo F5 numa página do CRM, `GET /compras-fornecedor/por-mes` sai sem header, leva 403, o interceptor não reenvia (ele só reenvia em 502/503/504), e a tela mostra "Erro ao carregar relatório". A dona recarrega até dar certo. As rotas públicas mascaram o problema, o que faz o bug parecer intermitente.

2. **`useAuth` retorna `{ isAuthenticated, loading }`**, mas `Dashboard.jsx:815`, `Vendas.jsx:24` e `CreateProduct.jsx:14` desestruturam `authLoading` e `logout` — **ambos `undefined`**. O botão "Sair" do Dashboard é `onClick={undefined}`: **um no-op silencioso**. _(O verificador corrigiu: o risco de sessão aberta é baixo, porque o `AdminHeader` renderizado na mesma tela tem um logout funcional e o usuário percebe que a tela não mudou. O valor real do achado é outro: JS puro engole erro de destructuring, e a mesma classe de bug já produz guardas de rota que só funcionam por acidente.)_

3. **Não existe componente de rota protegida.** O guard é o mesmo `useEffect` copiado em **11 páginas**, com duas variantes incompatíveis da mesma condição. A décima segunda página nasce desprotegida por esquecimento.

## 5.8 Higiene de segredos — ação imediata

O `server/` **não tem `.gitignore`**, e o `.env` com `ADMINPASSWORD`, `JWT_SECRET`, `MONGODB_URI` e `CLOUDINARY_API_SECRET` viajou dentro desta cópia de referência. Isso não é hipótese, já aconteceu.

**Recomendação operacional, fora do escopo da Caqui: rotacionar hoje os segredos de produção do Dália** — `JWT_SECRET`, `ADMINPASSWORD`, credenciais do Cloudinary e a string do Atlas. E revogar a `GEMINI_API_KEY` órfã, que nenhuma linha do projeto usa.

---

# 6. Validação, tratamento de erro e formato de resposta

## 6.1 O envelope — o acerto real desta dimensão

`ApiResponse` ([utils/api-response.js](server%20-%20cópia/v1/utils/api-response.js)) é usado em **100% dos controllers, com zero divergência de envelope**:

```js
{
  ;(success, message, data, timestamp)
}
```

Isso torna a troca de formato uma edição de um arquivo, e é o padrão que deve ser mantido.

## 6.2 Três erros duros de status HTTP

| Método           | Devolve                                                  | Deveria               |
| ---------------- | -------------------------------------------------------- | --------------------- |
| `UNAUTHORIZED`   | **403** (api-response.js:56)                             | 401                   |
| `DELETED`        | **204 com corpo JSON** (que o Express descarta)          | 204 sem corpo, ou 200 |
| `:id` malformado | **500** com mensagem do Mongoose                         | 400                   |
| Lista vazia      | **404** (`NotFoundError` quando `products.length === 0`) | `200 []`              |

O `UNAUTHORIZED` como 403 é o motivo pelo qual o Dália precisa de um `/auth/validate-session` a cada página montada — sem 401 correto, nenhum interceptor distingue "refaça login" de "sem permissão".

A lista vazia como 404 é pior do que parece: `Catalog.jsx:374` redireciona a **vitrine inteira** para `/error` quando não há produtos. Traduzido para a Caqui: **nenhuma expedição com vaga aberta → o site inteiro cai numa página de erro.**

## 6.3 Códigos de erro — não existem

Não há código legível em lugar nenhum: nem no `ApiResponse`, nem nas classes de erro, nem no cliente. O discriminador é uma **string em português concatenada à mão**. Os 34 call sites do front leem `err.response.data.message` e **nenhum ramifica por código**.

A distância até o `{ error: { code, message, details? } }` que a Caqui exige é total.

## 6.4 Joi — cobertura e os dois furos

**20 das 24 rotas de escrita com corpo têm schema.** Quatro ficaram de fora, e ninguém percebeu — porque a validação mora dentro do service, e é preciso abrir três arquivos para saber se uma rota valida algo.

Não há buraco de mass assignment hoje, **mas por acidente**: `Joi.object()` rejeita chaves desconhecidas por padrão. É proteção implícita, não documentada, sem teste, e ausente nas 4 rotas sem validação.

O furo real, e ele importa muito para a Caqui: **metade dos services descarta o `value` que o Joi devolve e persiste o corpo bruto** (`product`, `sale`, `client`); a outra metade usa (`saida`, `fornecedor`). O que passou pela validação **não é o que foi gravado**. Duas consequências verificadas:

- `Joi.number().precision(2)` arredonda `10.999` para `11.00` no `value`, e **`10.999` é o que vai para o banco**.
- `Joi.date()` parseia a data e o resultado é descartado, deixando o Mongoose reparsear a string. **Dois parsers de data sobre a mesma entrada**, num sistema que precisa gravar UTC e exibir America/Sao_Paulo.

`abortEarly` nunca é configurado, então 14 pontos do código fazem `error.details[0].message` e **jogam fora todos os erros menos o primeiro**.

## 6.5 Sem paginação, e um ReDoS público

Nenhuma rota tem paginação ou teto de página. `GET /products` devolve o catálogo inteiro, sem projeção, sem limite; a paginação de 20 itens é **client-side sobre o array completo**.

E o filtro por nome monta `new RegExp(entrada_do_usuário)` numa **rota pública sem auth** ([product-services.js:189](server%20-%20cópia/v1/services/product-services.js)):

```
GET /api/v1/products?name=(a%2B)%2B%24
```

é um ReDoS de uma linha de curl. O mesmo padrão em `client-services.js:66` e `fornecedor-services.js:128` (essas atrás de auth). Nenhum tem `.limit()` nem `.maxTimeMS()`. _(O verificador corrigiu: o alvo é a CPU do cluster MongoDB, não o event loop do Node — o padrão é avaliado no banco. O efeito prático é o mesmo, porque o mesmo Atlas serve o catálogo da loja.)_

Mesmo sem má intenção: quem digitar `anel (novo` na busca recebe **500**, porque o RegExp não compila.

O único bom padrão de paginação do repositório está em `sale-controller.js:100`: `Math.min(parseInt(req.query.limit) || 5, 200)`.

## 6.6 Degradação que esconde falha

[feed-controller.js:112](server%20-%20cópia/v1/controllers/feed-controller.js) transforma **banco fora do ar em feed vazio com HTTP 200**. Para o Google Merchant, feed vazio não é "erro temporário", é "o catálogo acabou" — e ele desativa os produtos. Falha em integração com robô tem que ser 5xx, para o robô reagendar.

---

# 7. Imagens

## 7.1 O fluxo vivo

`browser → crop em canvas (react-easy-crop) → multipart → multer → multer-storage-cloudinary → Cloudinary`

## 7.2 O fluxo fantasma

A pasta `server/uploads/` tem **14 JPGs de setembro/2025** e `app.js:41-43` ainda serve `express.static('/uploads')`. **Nenhum código escreve ali** — o multer grava tudo no Cloudinary. É caminho legado ativo apenas para leitura, servindo arquivos publicamente por uma rota que ninguém revisa. Em deploy serverless isso nem funcionaria: filesystem efêmero e read-only.

## 7.3 Validação: quase nada

- **Sem `limits: { fileSize }`** no multer.
- **Sem `fileFilter`** checando MIME.
- A única checagem real é `allowed_formats` **no Cloudinary** — ou seja, o servidor bufferiza e transfere o arquivo inteiro antes de a recusa acontecer do lado de lá.
- Nenhum middleware traduz `MulterError`, então o admin vê "Erro ao cadastrar o produto" para qualquer falha.

## 7.4 Otimização: **nenhuma**

Não há transformação do Cloudinary — nem no upload, nem na entrega. Nenhum `f_auto`, nenhum `q_auto`, nenhuma variante responsiva, nenhum `srcset`, nenhum WebP/AVIF, nenhum placeholder. O crop no canvas **preserva a resolução original** da foto e reencoda em JPEG sem parâmetro de qualidade.

Nas 23 `<img>` do front: **zero `loading="lazy"`, zero `decoding="async"`, zero `fetchpriority`**. O card de produto renderiza duas imagens por peça, ambas baixadas no load. `Relatorios.jsx:550` baixa o **JPEG integral** para renderizar uma miniatura de 32px.

## 7.5 `alt`: o campo não existe

Não há campo `alt` no model. O nome do produto faz as vezes (`ProductCard.jsx:111`). Acerta no caso decorativo (`alt="" aria-hidden`) e erra em `SectionTitle.jsx:19`, uma `<img>` sem atributo `alt` nenhum.

## 7.6 Ciclo de vida: **nada é apagado, nunca** — dois vazamentos independentes

1. **No delete:** o controller lê `const { imageUrl } = await ProductServices.deleteProduct(id)` e monta um `fs.unlink` num caminho local. Só que o schema **não tem campo `imageUrl`** — tem `images: [String]`. O valor é sempre `undefined`, o `if` nunca entra, **nenhuma imagem é removida**, e o código dá a impressão contrária.
2. **No update:** trocar a foto de um produto não apaga a anterior. Este é o maior dos dois, porque re-cortar foto acontece toda semana.

`grep 'uploader'` ou `'destroy'` em todo o `v1/`: **zero**. E o `public_id` devolvido pelo Cloudinary é **descartado** em `product-controller.js:35` — a lib já entrega em `file.filename`. Sem `public_id`, não há como apagar nem retroativamente: as fotos têm nome `product-0-1757796592563`, sem vínculo recuperável com o produto.

Cada foto que já subiu está lá para sempre. Isso é aluguel eterno pago em cota de storage e bandwidth.

## 7.7 O que o pipeline acertou

A **melhor peça de engenharia do fluxo** é o manifesto `imageOrder` com token `"__NEW__"` (`EditProductModal.jsx:288` → `product-controller.js:69-89`): reconcilia fotos existentes e novas preservando a ordem escolhida no admin. Resolve exatamente o problema que a galeria de uma Trip vai ter.

## 7.8 Uma armadilha de modelagem

`product-model.js:14-15` declara `imagesGoldCount: Number` ao lado de `images: [String]`. O significado é **posicional e não declarado em lugar nenhum**: as primeiras N imagens são do material Ouro, o resto é Prata. Apagar a segunda foto de uma peça com 3 douradas e 2 prateadas faz o seletor de material passar a mostrar a foto errada — sem erro, sem log, até um cliente reclamar que recebeu a cor errada.

---

# 8. SEO técnico — a parte mais original do projeto

Vale uma seção própria porque a Caqui precisa do equivalente, e porque é aqui que o Dália mostra a melhor e a pior engenharia ao mesmo tempo.

## 8.1 Dynamic rendering por User-Agent

[vercel.json:12-21](client%20-%20cópia/vercel.json) tem um rewrite condicional que detecta ~17 robôs pelo `User-Agent` e desvia para [api/prerender.js](client%20-%20cópia/api/prerender.js) — uma função serverless que busca o produto na API e devolve **HTML cru** com `<title>`, meta, Open Graph e JSON-LD reais. Usuários recebem a SPA normal.

É o que faz o preview de link no WhatsApp funcionar, e é uma boa ideia bem executada em intenção. **Três furos graves na execução:**

1. **A home e TODAS as páginas de categoria nunca chegam ao prerender.** A Vercel resolve filesystem antes de rewrites, então `/` casa com o `index.html` estático e nunca alcança a função. O ramo de categoria em `prerender.js:175-186` é **código morto**. O próprio autor documentou a causa em `index.html:11-12` sem tirar a consequência.
2. **Soft-404 industrial:** o prerender responde **HTTP 200 para qualquer caminho inexistente**, com canônica auto-referente (`prerender.js:222-229`).
3. **O HTML servido ao Googlebot é um subconjunto pobre** do que o usuário vê: uma foto, `h1`, preço, uma linha de texto. Não é cloaking punível, mas garante que o Google indexe a versão magra e nunca veja o conteúdo rico.

Causa raiz do furo 1: **categoria em query string** (`/?cat=brincos`). Isso também fez a canônica da home vazar para todas as categorias, e nove URLs do sitemap declararem no HTML bruto que são `/`.

## 8.2 O melhor arquivo do projeto

[src/config/seo-copy.js](client%20-%20cópia/src/config/seo-copy.js): fonte única de copy de SEO, JS puro sem dependência de browser, consumida **tanto pelo React quanto pelo Node do prerender**. Tem inclusive disciplina editorial — `productSeo` só afirma "hipoalergênica" quando o campo do produto diz que é.

## 8.3 Feed do Google Merchant Center

[feed-controller.js](server%20-%20cópia/v1/controllers/feed-controller.js) gera RSS 2.0 direto do Mongo. Quatro decisões boas: mapa da categoria da loja para a taxonomia oficial do Google; **omitir campo ambíguo em vez de mandar valor errado**; manter item esgotado como `out_of_stock` em vez de removê-lo; descrição sintética de fallback.

Dois erros: o `g:id` é `sku || fallback` — **chave instável**, e um backfill de SKU destrói o histórico do item no Merchant; e as variantes de cor, que existem no modelo, são **simplesmente ignoradas** (sem `g:item_group_id`, sem `g:color`).

## 8.4 JSON-LD sem escape

`prerender.js:61` monta `<script type="application/ld+json">${JSON.stringify(b)}</script>`. `JSON.stringify` **não escapa `<`**, e a descrição do produto entra crua. Uma descrição contendo `</script>` fecha a tag. O mesmo padrão em `Seo.jsx:59`. Curioso: o mesmo arquivo aplica `escapeHtml` religiosamente em todos os outros pontos — o autor conhecia o risco e só deixou passar dentro do JSON-LD.

_(O verificador corrigiu: o preview de link no WhatsApp **não** quebra, porque as metas `og:` são emitidas antes do bloco JSON-LD. O dano real é o JSON-LD ser descartado pelo parser — perdendo rich results e a validação de preço no Merchant — e o resto do JSON vazar como markup, com `</script><script>…` injetando script arbitrário na página entregue aos robôs.)_

---

# 9. O que é BOM e o que é DÍVIDA TÉCNICA

## 9.1 O que vale replicar

| #   | Prática                                                | Onde                                      | Por que vale                                                                                                                                                                  |
| --- | ------------------------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **Arquitetura em camadas de verdade**                  | `v1/{routes,controllers,services,models}` | 9 de 10 controllers respeitam o service. Não é pasta decorativa.                                                                                                              |
| B2  | **Middleware declarado rota a rota**                   | todos os `*-routes.js`                    | 44/55 protegidas, e a leitura do arquivo já revela o que está aberto.                                                                                                         |
| B3  | **Auth antes do multer**                               | `product-routes.js:9`                     | Anônimo com arquivo de 500 MB é barrado no header, sem queimar cota.                                                                                                          |
| B4  | **Contador atômico de SKU**                            | `sku-service.js:40-47`                    | `$inc` + `upsert` + `unique` + `immutable` cobre corrida, duplicado e adulteração.                                                                                            |
| B5  | **Caminho único de escrita para o estoque**            | `product-services.js:66`                  | O PUT genérico **descarta** `stock` de propósito. Fechar a porta lateral é o que faz o ledger valer algo.                                                                     |
| B6  | **Snapshot da venda em consulta em lote**              | `sale-services.js:44-60`                  | `$in` + projeção + `.lean()`, e congela `name`/`unitPrice`/`sku`/`custo`. Renomear a peça não reescreve o passado.                                                            |
| B7  | **Projeção explícita nas rotas públicas de agregação** | `sale-services.js:179,207`                | `$project` nomeado + teto de `limit` no servidor. O contraste direto com o vazamento de custo mostra que o cuidado existia — só não foi uniforme.                             |
| B8  | **Joi rejeitando chave desconhecida**                  | `update-product-schema.js:96`             | Bloqueia mass assignment em todas as escritas validadas.                                                                                                                      |
| B9  | **Fonte única de copy de SEO**                         | `config/seo-copy.js`                      | Consumida por React e por Node, sem dependência de browser.                                                                                                                   |
| B10 | **Manifesto `imageOrder` com token `__NEW__`**         | `EditProductModal.jsx:288`                | Reconcilia fotos existentes e novas preservando ordem.                                                                                                                        |
| B11 | **`config/` vs `content/`**                            | `content/policies.js:5`                   | Dados estruturais separados de texto editorial, sem duplicação entre rodapé e PDP.                                                                                            |
| B12 | **Disciplina nos scripts de migração**                 | `server/scripts/`                         | Todos aceitam `--dry`, documentam o comando no cabeçalho, e três verificam idempotência em código. `analyze-sale-items.js` é read-only e roda **antes** do script de escrita. |
| B13 | **Gráficos SVG sem biblioteca**                        | `ui/Charts.jsx:18-152`                    | Donut/AreaLine/HBars em 163 linhas, zero dependência. E o relatório rotula "potencial" vs "realizado" em vez de inventar margem.                                              |

## 9.2 Dívida técnica — 25 achados verificados

Ordenados por severidade. Os quatro primeiros foram encontrados **independentemente pelos dois críticos**.

### Severidade alta

| #       | Achado                                                                                                                                                                                                                                                                                         | Evidência                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **D1**  | Senha do admin comparada com `===` contra env var. Sem hash, sem `User`, sem role. `bcrypt` instalado e nunca importado.                                                                                                                                                                       | `auth-controller.js:8`                                                        |
| **D2**  | Rate limit de login **só no `localStorage`**. Servidor sem nenhum throttle.                                                                                                                                                                                                                    | `LoginPage.jsx:28-31` · `auth-routes.js:7`                                    |
| **D3**  | `const JWT_SECRET = process.env.JWT_SECRET \|\| 'production'`. Se a env faltar, **a API sobe assinando com um segredo público**. Falha silenciosa. Agravado pela ordem de módulos ESM: `configDotenv()` roda depois de o valor já ter sido capturado, e o script `start` não usa `--env-file`. | `jwt-services.js:3` · `app.js:8` · `package.json:5`                           |
| **D4**  | `GET /api/v1/products` público devolve `custo` e `custoEmbalagem` de todas as peças. Um `curl` sem token entrega a margem do negócio inteiro.                                                                                                                                                  | `product-routes.js:17` · `product-services.js:176` · `product-model.js:12-13` |
| **D8**  | Saldo de estoque e ledger gravados **fora de transação**, com read-modify-write. Dois ajustes simultâneos perdem um; falha entre as duas escritas muda o número sem rastro.                                                                                                                    | `product-services.js:88-125`                                                  |
| **D9**  | **O total da venda vem pronto do cliente** e o servidor nunca recalcula. `Joi.number()` aceita `total` como campo livre.                                                                                                                                                                       | `sale-schema.js:42-44` · `sale-services.js:15-35` · `CreateSaleModal.jsx:279` |
| **D10** | Apagar cliente apaga em cascata todas as vendas dele, sem soft delete e sem transação. _(Verificador: há `confirm()` avisando; falta dimensionar o estrago e auditar. Severidade → média.)_                                                                                                    | `client-services.js:51-53`                                                    |
| **L1**  | Categoria sem enum no banco: a lista vive no bundle do front e o comentário do arquivo **documenta** que categoria fora da lista deixa o produto ineditável.                                                                                                                                   | `product-model.js:16` · `config/categories.js:1-20`                           |
| **L2**  | Axios **reenvia qualquer requisição até 5×, incluindo POST e PATCH**, com timeout de 90s. Um POST que grava e demora é reenviado — **venda duplicada**, movimento de estoque duplicado.                                                                                                        | `api/axios.js:16-39`                                                          |
| **L3**  | Variantes de cor modeladas como produtos separados unidos por **string livre** `colorGroup`, resolvidas baixando o catálogo inteiro no navegador. Sem dimensão de tamanho. Um acento diferente separa a variante do grupo silenciosamente.                                                     | `product-model.js:26-30` · `ProductDetail.jsx:293-301`                        |
| **L4**  | Relatórios e segmentação calculados **no navegador**, baixando três coleções inteiras. O backend já tem os filtros; a página não os usa.                                                                                                                                                       | `Relatorios.jsx:124-303`                                                      |
| **L5**  | Nada é editável pelo CRM além de uma lista de canais de venda. **Settings tem uma única chave.** Trocar o número de WhatsApp exige editar 4 arquivos e fazer deploy.                                                                                                                           | `settings-model.js:6-7` · 5 construtores independentes de link                |

### Severidade média

| #       | Achado                                                                                                                                                                                                                                                                                                 | Evidência                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **D11** | Zero cabeçalhos de segurança: sem `helmet`, sem bloco `headers` no `vercel.json`. Nenhuma CSP.                                                                                                                                                                                                         | `package.json:7` · `vercel.json:2`                                      |
| **D12** | Token de 7 dias em `localStorage`, **sem revogação**. "Sair" é local; o token continua válido.                                                                                                                                                                                                         | `LoginPage.jsx:91` · `jwt-services.js:4`                                |
| **D13** | `new RegExp()` com string crua do usuário em 3 serviços, um deles **público sem auth**. ReDoS + COLLSCAN.                                                                                                                                                                                              | `product-services.js:189`                                               |
| **D14** | `POST /favorites` anônimo, sem rate limit, sem verificar se o produto existe, com IP vindo de header forjável.                                                                                                                                                                                         | `favorite-routes.js:9` · `favorite-controller.js:7`                     |
| **D15** | **Carrinho nunca revalida.** `price` e `subtotal` congelados no `localStorage` são a única fonte da mensagem de WhatsApp. Cupons no bundle.                                                                                                                                                            | `CartContext.jsx:6-9` · `generateWhatsappLink.js:22` · `coupons.js:3-6` |
| **D16** | A home dispara **4 `GET /products` simultâneos**, cada um com o catálogo inteiro. `useProducts` não tem cache nem dedupe.                                                                                                                                                                              | `useProducts.jsx:9-22` · `Header.jsx:151,203,285`                       |
| **D17** | Token só anexado dentro de um `.then()`. Requisições do CRM saem antes e tomam 403 sem retry.                                                                                                                                                                                                          | `useAuth.jsx:20-25` · `axios.js:22-35`                                  |
| **D18** | `/sales/mais-vendidos` roda `$unwind` sobre a coleção inteira **a cada visita à home**, sem índice e sem cache.                                                                                                                                                                                        | `sale-services.js:166-180` · `sale-model.js:41-42`                      |
| **D20** | **Zero testes** nos dois projetos — inclusive nas regras de dinheiro, estoque e autorização.                                                                                                                                                                                                           | `package.json` (ambos)                                                  |
| **D21** | `cors()` sem allowlist. _(Verificador reduziu o impacto: sem `credentials`, só expõe o que já é público — o que inclui o custo.)_                                                                                                                                                                      | `app.js:12`                                                             |
| **D22** | `error.message` cru concatenado em toda resposta de erro, sem error handler central. _(Verificador reduziu: para atacante não autenticado, limita-se ao feed e a erros genéricos.)_                                                                                                                    | `client-controller.js:22` · `feed-controller.js:139`                    |
| **D23** | JSON-LD injetado sem escapar `<`.                                                                                                                                                                                                                                                                      | `prerender.js:61` · `Seo.jsx:59`                                        |
| **D24** | Compra com itens e cascade de fornecedor sem transação, com compensação `catch(() => {})` **vazia**.                                                                                                                                                                                                   | `compra-fornecedor-services.js:31-45` · `fornecedor-services.js:82-94`  |
| **D26** | **Zero code splitting.** 61% do `src/` é CRM e vai no bundle do visitante. _(Verificador: `canvas-toBlob` não está no bundle — só `react-easy-crop` é dependência admin-only real.)_                                                                                                                   | `main.jsx:11-26`                                                        |
| **D27** | Backend agrupa por mês em UTC; frontend agrupa no fuso do navegador. _(Verificador: divergência **latente**, não observável hoje — nenhuma tela mostra os dois números para o mesmo dado.)_                                                                                                            | `compra-fornecedor-services.js:213-218` · `Relatorios.jsx:51-55`        |
| **L6**  | Sem rota `*` e sem `errorElement`. E `/error` renderiza **texto arbitrário vindo da query string** sob o domínio da loja, com a logo ao lado.                                                                                                                                                          | `main.jsx:30-53` · `ErrorPage.jsx:5-6`                                  |
| **L7**  | Guard de auth = mesmo `useEffect` copiado em **11 páginas**, com duas variantes incompatíveis.                                                                                                                                                                                                         | 11 arquivos                                                             |
| **L8**  | **Duas seções inteiras do CRM (Saídas e Fornecedores) não têm link de entrada** em lugar nenhum. Só se chega digitando a URL. Mais de 1.000 linhas construídas e efetivamente fora do ar.                                                                                                              | `AdminHeader.jsx:54-91` · `main.jsx:49-51`                              |
| **L9**  | Remoção de acentos usa **caracteres combinantes literais** dentro do regex, com um comentário afirmando o contrário ("Unicode escapes EXPLÍCITOS, à prova de bala"). A forma correta existe em outro arquivo do mesmo projeto. Qualquer normalização NFC do fonte quebra slug e busca **em silêncio**. | `searchMatch.js:41-48` · `slug.js:9`                                    |
| **L10** | Conteúdo institucional e jurídico (política de trocas, LGPD) é **módulo JS**. Corrigir uma vírgula exige deploy.                                                                                                                                                                                       | `content/policies.js:1-30`                                              |
| **L11** | Scripts de migração com `dbName` hardcoded nos 6 arquivos, sem alias de npm e **sem registro de execução**. Um deles fura o Mongoose de propósito para escrever num campo `immutable`.                                                                                                                 | `scripts/backfill-sku.js:21,63-65`                                      |

### Severidade baixa

| #       | Achado                                                                                                                                                                                                            |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D28** | Caminho legado de upload em disco convive com Cloudinary; o delete de imagem é **código morto que nunca executa**. Mais 6 dependências fantasma.                                                                  |
| **D29** | `useAuth` não devolve `logout` nem `authLoading`; o botão "Sair" do Dashboard é `onClick={undefined}`.                                                                                                            |
| **D30** | `createProduct` rejeita `stock: 0` por checagem de truthiness, contradizendo o próprio schema Joi. _(Verificador: `price: 0` não é falso negativo — o Joi já proíbe com `.positive()`.)_                          |
| **L12** | `CartRecovery` comunica-se com o carrinho por `CustomEvent` com string mágica (`"dalia:open-cart"`), fora do React, havendo um Context disponível. E monta o link do WhatsApp **no render**, com preço congelado. |

---

# 10. Decisões arquiteturais para a Caqui Trekking

## 10.1 A decisão que precisa ser tomada primeiro: a stack

O briefing da Caqui pede **Prisma + PostgreSQL + TypeScript strict** e usa rotas no formato `/trekking/[slug]`, com "metadata única por página" — isso descreve **Next.js**, não a SPA Vite do Dália. O documento de prompts diz, no mesmo PROMPT 01, "mesma stack do Dália" e "Prisma apontando pra PostgreSQL". As duas coisas não podem ser verdade.

**Recomendação: Next.js (App Router) + PostgreSQL + Prisma + TypeScript.** Não por modismo — por cinco razões que saem diretamente desta análise:

1. **O modelo da Caqui é relacional.** `Trip 1:N Departure`, `Product 1:N ProductVariant`, `Departure N:N Guide`. Não há documento aninhado profundo, não há schema variável, não há volume. Postgres dá **integridade referencial de verdade** — o Dália não tem, e apagar um `Product` deixa `StockMovement` e `Favorite` órfãos.
2. **Os enums da Caqui são o núcleo do negócio.** `availability`, `difficulty`, `size`, `status`. No Postgres viram constraint de banco; no Dália, `category` ficou string livre e o custo está documentado no achado L1.
3. **Migrations versionadas.** O Dália não tem **nenhum** controle de evolução de schema — o substituto são 6 scripts sem registro de execução, e descobrir se um backfill já rodou exige abrir o Mongo e olhar.
4. **SSR mata 241 linhas de `prerender.js` e os três furos dele** (home inalcançável, soft-404, HTML magro para o bot). Para a Caqui isso vale mais que para o Dália: **o funil inteiro passa pelo WhatsApp**, então o card de preview do link compartilhado num grupo **é a peça de venda**.
5. **TypeScript pega exatamente os quatro erros que este domínio produz:** confundir centavos com reais, `Date` com string ISO, id de `Trip` com id de `Departure`, e um estado de disponibilidade não tratado. O Dália é JS puro e instala `@types/react` só para o autocomplete — o custo dos tipos sem o benefício da verificação. Os bugs D29 e L7 são consequência direta disso.

**Se a escolha for Mongoose por familiaridade**, é decisão legítima — mas então é preciso assumir explicitamente, e por escrito, que **integridade referencial e migração passam a ser responsabilidade manual da aplicação**.

## 10.2 MANTER

| Decisão                                                                                                | De onde vem                                                                           |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| **Camadas `routes → controllers → services → models`**, com nomes `{dominio}-{camada}`                 | B1 — provado, 9/10                                                                    |
| **Envelope único de resposta**, num só módulo                                                          | 6.1                                                                                   |
| **Middleware de auth declarado rota a rota** (não em bloco)                                            | B2 — torna o que está aberto visível na leitura                                       |
| **Auth antes do upload**                                                                               | B3                                                                                    |
| **Contador atômico** (`$inc` + `upsert` + `unique` + `immutable`) para qualquer código sequencial      | B4                                                                                    |
| **Caminho único de escrita** para campo sensível, com o update genérico descartando-o                  | B5 — aplicar a `Departure.availability`                                               |
| **Snapshot do que foi vendido** no registro do lead: nome da Trip, data da saída, `priceCents` vigente | B6 — mas com `immutable: true`, porque no Dália editar uma venda **apaga o snapshot** |
| **Projeção explícita + teto de `limit`** em toda rota pública                                          | B7                                                                                    |
| **`encodeURIComponent` uma vez sobre a mensagem inteira**                                              | 4.4 — copiar exatamente assim                                                         |
| **Fonte única de copy de SEO**, sem dependência de browser                                             | B9                                                                                    |
| **Manifesto de ordem de imagens com token `__NEW__`**                                                  | B10 — a galeria da Trip tem o mesmo problema                                          |
| **`config/` vs `content/`**, e o padrão `--dry` + idempotência verificada nos scripts                  | B11, B12                                                                              |
| **Botão fantasma como conveniência de UX**, com a proteção real no backend                             | 5.5 — o modelo mental está certo                                                      |

## 10.3 MUDAR

| Decisão                                                                                                                                                      | Por quê                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Dinheiro em Int de centavos**, sem exceção, com `Number.isInteger` no schema                                                                               | 3.6 — o `round2` do Dália erra acima de R$ 8.192 e todo o `numeric.js` existe só para compensar o tipo      |
| **O servidor recalcula todo valor.** O cliente manda `[{departureId, qty}]`; o backend devolve preço e total                                                 | D9, D15                                                                                                     |
| **`POST /cart/validate` obrigatório antes de montar a mensagem.** O `localStorage` guarda só `{kind, refId, qty}` — **nunca preço, nome ou disponibilidade** | 4.3 — o requisito já está no briefing; o Dália é a prova viva do custo de não tê-lo                         |
| **Chave versionada e namespaced** (`caqui.cart.v1`), com `try/catch` na leitura **e** na escrita e validação de shape item a item                            | 4.2 — copiar `FavoritesContext`, não `CartContext`                                                          |
| **`{ error: { code, message, details? } }`** com `code` em SCREAMING_SNAKE e `abortEarly: false`                                                             | 6.3 — sem código estável, a revalidação do carrinho não consegue dizer **qual** item mudou                  |
| **Error handler central no Express**, com `AppError` carregando `code` + `httpStatus`                                                                        | 2, 6.6 — mata os ~54 try/catch e o vazamento de `error.message`                                             |
| **401 é 401**                                                                                                                                                | 6.2                                                                                                         |
| **Lista vazia é `200 []`**                                                                                                                                   | 6.2 — senão "nenhuma expedição com vaga" derruba o site inteiro                                             |
| **Validação como middleware de rota**, usando o `value` validado, nunca o corpo bruto                                                                        | 6.4 — no Dália, o que passou pela validação não é o que foi gravado                                         |
| **Modelo `User` com bcrypt (cost ≥ 12) + roles `OWNER`/`ADMIN`**, desde o dia 1                                                                              | D1 — retrofitar role depois exige reemitir todos os tokens                                                  |
| **Rate limit no servidor** no login, com log de tentativa falha                                                                                              | D2 — _se pode ser apagado com `localStorage.clear()`, não é um controle_                                    |
| **Validar todas as envs no boot e `process.exit(1)` se faltar. Zero fallback de segredo.**                                                                   | D3 — um app que sobe com segredo default é pior que um app que não sobe                                     |
| **Cookie `httpOnly; Secure; SameSite`** com access token curto                                                                                               | D12 — e decidir a topologia de domínio **antes** da primeira rota, porque ela define o CORS                 |
| **Dois DTOs por entidade** (`toPublicDTO` / `toAdminDTO`); `res.json(doc)` proibido em review                                                                | D4 — o equivalente da Caqui é custo de transporte, cachê de guia e margem por saída                         |
| **`React.lazy` em todas as rotas do CRM**, com separação física `store/` · `admin/` · `shared/`                                                              | D26 — se o CRM está no bundle público, você entrega ao mundo exatamente o que os 5 toques deveriam esconder |
| **Um único `<RequireAuth>`** e **request interceptor** no axios                                                                                              | D17, L7                                                                                                     |
| **`publicId` persistido + `destroy` no delete e no diff do update**                                                                                          | 7.6 — é a única linha que separa "consigo limpar meu storage" de "pago aluguel eterno"                      |
| **Transformação na entrega** (`f_auto,q_auto,dpr_auto,w_{n}`), 3 variantes, `srcset`, `loading="lazy"`                                                       | 7.4 — foto de paisagem é muito mais pesada que semijoia em fundo branco; o desperdício escala pior          |
| **`alt` obrigatório no schema**, editável no CRM                                                                                                             | 7.5 — é onde entram "trilha", "Serra do Mar", "Mogi das Cruzes"                                             |
| **Imagem como subdocumento** `{publicId, url, width, height, alt, ordem}` — nunca string solta, nunca significado posicional                                 | 7.8, L3                                                                                                     |
| **Slug persistido no banco**, gerado uma vez, com tabela de slugs antigos → 301                                                                              | 8.1 — se o slug for derivado do título, renomear a expedição muda a URL canônica em silêncio                |
| **Caminhos reais, nunca categoria em query string**                                                                                                          | 8.1 — foi a causa raiz de três furos de SEO no Dália                                                        |
| **Um único helper de data** com `timeZone: 'America/Sao_Paulo'`, e `timezone` explícito em todo `$dateToString`/`date_trunc`                                 | 4.6, D27 — no Dália `grep timeZone` retorna zero; **na Caqui a data É o produto**                           |
| **Uma cópia de cada função**, num pacote compartilhado                                                                                                       | 2 — `formatBRL` tem 10 cópias e `BRAND` já divergiu                                                         |
| **`VITE_*`/env vars desde o commit inicial**, com `.env.example` versionado e `.gitignore` **antes da primeira linha de código**                             | 1, 5.8                                                                                                      |
| **Retry só em métodos idempotentes**, teto de 2                                                                                                              | L2 — hoje um POST de venda que demora vira venda duplicada                                                  |
| **Escapar `<` no JSON-LD**: `JSON.stringify(o).replace(/</g,'\\u003c')`                                                                                      | D23 — descrição de expedição é texto longo com muito copiar-e-colar                                         |
| **Template da mensagem de WhatsApp como dado**, com placeholders, preview no CRM e **um único** construtor de link no projeto                                | L5 — a operação não pode depender do dev para ajustar a primeira frase da negociação                        |
| **Conteúdo operacional da Trip no banco**, não em módulo JS                                                                                                  | L10 — o que fecha a venda (o que levar, cancelamento por chuva, ponto de encontro) muda toda temporada      |
| **Fonte única de itens de menu do CRM**, com lint garantindo que toda rota `/crm` aparece nela                                                               | L8 — no Dália, duas seções inteiras ficaram inacessíveis                                                    |
| **Rota `*` com 404 de marca**; página de erro **nunca** lê texto de query string                                                                             | L6                                                                                                          |
| **Relatórios como agregação no backend**, com o corte de período resolvido em America/Sao_Paulo no servidor                                                  | L4 — o CRM da Caqui será operado do celular, no meio do dia                                                 |

## 10.4 ABANDONAR

- **Bootstrap / react-bootstrap** e o hábito de acumular dependência não usada. Um sistema de estilo: Tailwind. Para componente headless (modal, drawer — o carrinho e o seletor de saída vão precisar), Radix ou Headless UI, que compõem em vez de concorrer.
- **Hard delete.** `deletedAt` em `Trip`, `Departure`, `Product`, `ProductVariant`, `Lead`, com filtro por padrão na camada de leitura — não confiando em cada chamador lembrar. Uma `Departure` passada é registro histórico, não lixo.
- **Cupom validado no cliente.** O briefing já diz que não há cupom; mantenha assim. Se um dia entrar, nasce no servidor, dentro do `/cart/validate`.
- **Telefone e contato hardcoded em componente.** Como **toda** a venda fecha no WhatsApp, um número errado esquecido num arquivo é pedido perdido em silêncio. Teste que falha se aparecer um dígito de telefone em `.jsx`.
- **`window.location.href` no CTA de finalizar.** `<a target="_blank" rel="noopener noreferrer">`.
- **Baixar o catálogo inteiro e filtrar no navegador.** A Caqui terá poucos itens, o que torna a tentação maior. Resista: filtro, ordenação, projeção e limite no servidor desde o primeiro commit.
- **`new RegExp()` com entrada de usuário**, em qualquer lugar.
- **Rotas administrativas no `robots.txt`.** Painel sob `/crm/*`, `noindex` na página, e o `robots.txt` **não menciona o prefixo** — porque mencionar é publicar.
- **Feed do Google Merchant Center, no lançamento.** Três razões: expedição é serviço, não bem físico; o Merchant exige checkout funcional na landing page e a Caqui não tem checkout; e sem estoque, frete ou GTIN o Caqui Wear entregaria um feed fraquíssimo. O mesmo esforço rende mais em JSON-LD rico + `og:image` gerada + Google Business Profile. Reavalie se e quando houver checkout real.
- **Código dormente "para o futuro".** O `baixarEstoqueDaVenda` desligado do Dália é dívida com aparência de previdência — e no dia em que alguém virar a flag, entra em produção uma corrida nunca testada.
- **Degradar bonito em integração com robô.** Banco fora do ar tem que ser 5xx, nunca 200 com lista vazia.

## 10.5 Decisões de conteúdo e SEO já resolvidas por esta análise

- **`Trip` é a página indexável; `Departure` não ganha URL própria.** Uma Trip com 12 saídas viraria 12 páginas quase idênticas — conteúdo raso, canibalização, crawl budget queimado. As saídas entram na mesma página, como array de ofertas no JSON-LD. Para link direto de campanha: `?saida=<id>` com canônica sempre apontando para a Trip limpa.
- **Mapa de disponibilidade → schema.org**, escrito **uma vez** num módulo compartilhado: `AVAILABLE → InStock` · `LAST_SPOTS → LimitedAvailability` (o vocabulário tem esse valor exato) · `SOLD_OUT → SoldOut`. O Dália derivava disponibilidade em quatro lugares com três políticas diferentes.
- **JSON-LD:** `Event` por Departure (com `startDate` carregando **offset explícito**, `-03:00`, nunca `Z`), `LocalBusiness` + `Organization` na home — para ecoturismo local, o Maps converte mais que a busca orgânica —, `Product` no Caqui Wear, e `BreadcrumbList` em todas as páginas. O Dália não tem nenhum breadcrumb: é o rich snippet mais barato que existe, e ficou na mesa.
- **`og:image` gerada por Trip** (1200×630, com foto + nome + data da próxima saída + preço), com `og:image:width`/`height` declarados. Isso importa muito mais aqui do que no Dália: **o preview do link no WhatsApp é a peça de venda.**
- **Sitemap:** pule `changefreq` e `priority` inteiros — o Google os ignora desde 2023. Uma Trip sem saída aberta sai do sitemap mas **continua respondendo 200**: o roteiro tem valor de busca mesmo sem data disponível.

## 10.6 O conjunto mínimo de testes

Não peça cobertura total. Peça exatamente estes seis, que travam justamente o que este código não conseguiu travar:

1. Aritmética de centavos e formatação BRL.
2. Conversão UTC ↔ America/Sao_Paulo, com um caso às 02:00 UTC do dia 1º.
3. Montagem da mensagem do WhatsApp a partir do carrinho, com nome de roteiro acentuado.
4. Revalidação: preço divergente e `Departure` passada são rejeitados.
5. Um teste que **percorre o router** e falha se qualquer rota fora de uma allowlist pública explícita não tiver o middleware de auth.
6. Um `GET` no endpoint público de Trip/Departure que **falha se qualquer chave contendo `custo`/`cost`/`margem` aparecer** na resposta.

Mais um CI de meia hora rodando `lint + typecheck + test` em cada push, com ESLint configurado nos **dois** lados. Isso transforma D3, D4 e o vazamento eterno do Cloudinary em build vermelho.

---

## Pendências que esta análise não resolve

1. **A escolha da stack** (10.1) — decisão sua, e ela trava o PROMPT 01.
2. **Topologia de hospedagem** — se front e API ficarem em hosts diferentes, o cookie `httpOnly` cross-site exige `SameSite=None; Secure` mais CORS com allowlist. **Isso precisa ser decidido antes da primeira rota.** E não replique o plano grátis que hiberna: numa operação cuja conversão é abrir uma conversa, 90 segundos de skeleton é o funil inteiro.
3. **Rotação dos segredos do Dália** (5.8) — fora do escopo da Caqui, mas é hoje.
