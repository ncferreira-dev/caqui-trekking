# 03 — API pública

> Fase A, PROMPT 03. 11 endpoints, 29 testes de integração.
> Toda rota valida entrada. Nenhuma pode devolver a tabela inteira.

---

## Convenções

**Sucesso** — sempre `{ data }`, com `meta` nas listagens:

```json
{
  "data": [ ... ],
  "meta": { "total": 42, "limit": 20, "offset": 0, "hasMore": true }
}
```

**Erro** — sempre `{ error: { code, message, details? } }`:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Dados inválidos.",
    "details": [{ "field": "limit", "code": "too_big", "message": "..." }]
  }
}
```

O **`code` é o contrato**: estável, em SCREAMING_SNAKE. A `message` é texto para
humano e pode mudar. **O front ramifica pelo código, nunca pela mensagem.**

No projeto de referência não existia código nenhum — o discriminador era uma frase em
português concatenada à mão, e os 34 pontos do front que tratavam erro liam
`err.response.data.message`. Com isso, a revalidação do carrinho seria impossível de
implementar direito: quando uma saída lota, o front precisa saber **qual** item e **por quê**.

`details` traz **todos** os problemas de validação, não só o primeiro.

---

## Endpoints

### Trekking

| Método | Rota                  | Cache | Descrição                               |
| ------ | --------------------- | ----- | --------------------------------------- |
| GET    | `/api/trips`          | 60s   | Roteiros publicados com a próxima saída |
| GET    | `/api/trips/:slug`    | 60s   | Detalhe + saídas futuras + guias        |
| GET    | `/api/departures`     | 60s   | A agenda, cronológica                   |
| GET    | `/api/departures/:id` | 60s   | Detalhe da saída                        |

#### `GET /api/trips`

Só roteiros **publicados que têm ao menos uma saída futura publicada**. Roteiro sem
agenda não aparece na vitrine.

| Query                   | Tipo                                            | Padrão |
| ----------------------- | ----------------------------------------------- | ------ |
| `dificuldade`           | `FACIL` \| `MODERADO` \| `DIFICIL` \| `EXTREMO` | —      |
| `tag`                   | slug da atividade (`rapel`, `tirolesa`…)        | —      |
| `precoMin` / `precoMax` | centavos                                        | —      |
| `limit`                 | 1–100                                           | 20     |
| `offset`                | ≥ 0                                             | 0      |

O filtro de preço opera sobre as **saídas**, não sobre a Trip — é a Departure que tem
preço.

#### `GET /api/departures`

A view central do site.

| Query               | Tipo              | Padrão  |
| ------------------- | ----------------- | ------- |
| `de` / `ate`        | data ISO          | —       |
| `incluirEncerradas` | `true` \| `false` | `false` |
| `limit` / `offset`  |                   | 20 / 0  |

Por padrão devolve **só as futuras**. Com `incluirEncerradas=true`, as passadas voltam
com `encerrada: true` — elas não somem: servem de prova social e histórico.

`encerrada` é **derivado** de `inicioUtc < agora`. Não existe campo no banco.

Cada saída traz a data em dois formatos, de propósito:

```json
{
  "inicioUtc": "2026-08-15T09:00:00.000Z",
  "inicioLocal": "2026-08-15T06:00:00-03:00"
}
```

`inicioUtc` para cálculo; `inicioLocal` para exibição e para o `startDate` do JSON-LD de
`Event` — que **exige offset explícito**: com `Z` ou data nua, o Google mostra o horário
errado no rich result.

### Caqui Wear

| Método | Rota                  | Cache |
| ------ | --------------------- | ----- |
| GET    | `/api/products`       | 60s   |
| GET    | `/api/products/:slug` | 60s   |

`/api/products/:slug` devolve **todas** as variantes, inclusive as indisponíveis, com o
flag `disponivel`. Combinação esgotada **não some** da resposta: a UI precisa mostrá-la
desabilitada, porque a pessoa precisa saber que aquele tamanho e aquela cor existem.

O `precoCentavos` da variante já vem resolvido — o preço próprio dela quando existe,
senão o do produto.

### Carrinho

#### `POST /api/cart/validate` — o endpoint que decide a venda

**Corpo:**

```json
{
  "itens": [
    {
      "lineId": "l1",
      "tipo": "DEPARTURE",
      "departureId": 2,
      "quantidade": 2,
      "precoCentavosNoCarrinho": 9000
    },
    { "lineId": "l2", "tipo": "WEAR", "variantId": 1, "quantidade": 1 }
  ]
}
```

O cliente manda **referência e quantidade**. O `precoCentavosNoCarrinho` é **opcional** e
serve **exclusivamente para detectar divergência** — nunca para calcular.

**Resposta — 200, sempre**, com relatório item a item:

```json
{
  "data": {
    "itens": [
      {
        "lineId": "l1",
        "tipo": "DEPARTURE",
        "ok": false,
        "motivo": "PRICE_CHANGED",
        "precoCentavos": 9000,
        "precoDecimal": "90.00",
        "precoAnteriorCentavos": 100,
        "quantidade": 2,
        "subtotalCentavos": 18000,
        "descricao": "Pedra Grande de Quatinga",
        "detalhe": "sábado, 15 de agosto, 06:00"
      }
    ],
    "totalCentavos": 18000,
    "totalFormatado": "R$ 180,00",
    "temDivergencia": true,
    "podeFinalizar": false
  }
}
```

**Por que 200 e não 400:** o front precisa saber **qual** item divergiu e **por quê** para
avisar antes de montar a mensagem. Um 400 com uma frase não é acionável.

**Motivos por item:**

| `motivo`                  | Significado                                 | Soma no total?        |
| ------------------------- | ------------------------------------------- | --------------------- |
| `null`                    | Item íntegro                                | sim                   |
| `PRICE_CHANGED`           | Preço mudou; o novo está em `precoCentavos` | sim, com o preço novo |
| `DEPARTURE_PAST`          | A data já passou                            | não                   |
| `DEPARTURE_NOT_AVAILABLE` | Saída esgotada                              | não                   |
| `DEPARTURE_NOT_FOUND`     | Saída despublicada ou inexistente           | não                   |
| `VARIANT_UNAVAILABLE`     | Combinação tamanho/cor indisponível         | não                   |
| `VARIANT_NOT_FOUND`       | Produto despublicado ou inexistente         | não                   |

**`podeFinalizar: true` é a única condição para abrir o WhatsApp.**

**Regra inegociável:** o preço vem **sempre do banco**. O `localStorage` guarda apenas
`{ tipo, id, quantidade }` — nunca preço, nome ou disponibilidade.

Verificado contra o servidor real: um carrinho alegando R$ 1,00 numa saída de R$ 90,00
recebe de volta `precoCentavos: 9000`, `motivo: PRICE_CHANGED` e `podeFinalizar: false`.
No projeto de referência, esse mesmo ataque — `localStorage.setItem('cart', …)` com preço
adulterado — gerava uma mensagem oficial do site dizendo "colar = R$ 1,00", e a atendente,
vendo o formato conhecido, tendia a acreditar.

### Institucional e captura

| Método | Rota                 | Rate limit         | Cache      |
| ------ | -------------------- | ------------------ | ---------- |
| GET    | `/api/settings`      | —                  | 300s       |
| GET    | `/api/guides`        | —                  | 300s       |
| POST   | `/api/contact`       | 5 / 10 min por IP  | —          |
| POST   | `/api/leads`         | 10 / 10 min por IP | —          |
| POST   | `/api/cart/validate` | 60 / min por IP    | `no-store` |

`GET /api/settings` inclui o **`whatsappMessageTemplate`** — o texto do pedido, editável no
CRM. É o que permite ajustar a primeira frase da negociação sem deploy.

`POST /api/leads` **exige `consentimento: true`** (LGPD) e grava **quando** a pessoa
consentiu, não apenas que sim. Sem consentimento não existe lead: o schema rejeita.
Exige também ao menos um e-mail ou telefone.

---

## Códigos de erro

| Código                | Status | Quando                                                |
| --------------------- | ------ | ----------------------------------------------------- |
| `VALIDATION_FAILED`   | 400    | Corpo, query ou params inválidos                      |
| `INVALID_PARAM`       | 400    | Segmento de URL malformado                            |
| `TRIP_NOT_FOUND`      | 404    | Roteiro inexistente ou não publicado                  |
| `DEPARTURE_NOT_FOUND` | 404    | Saída inexistente ou não publicada                    |
| `PRODUCT_NOT_FOUND`   | 404    | Produto inexistente ou não publicado                  |
| `NOT_FOUND`           | 404    | Genérico                                              |
| `RATE_LIMITED`        | 429    | Limite por IP estourado                               |
| `INTERNAL_ERROR`      | 500    | Não tratado. Devolve `requestId`; a causa fica no log |

**Nenhum erro devolve mensagem interna.** O handler central converte o desconhecido em
`INTERNAL_ERROR` com um `requestId`, e a causa real vai só para o log do servidor. No
projeto de referência, todo 500 concatenava `error.message` na resposta e entregava nome
de model, campo e índice do banco a quem chamasse.

**Id malformado é 400, não 500.** Lá, `GET /clients/abc` devolvia 500 com "Cast to
ObjectId failed … for model Client".

---

## Decisões

### `internalNotes` nunca sai — em duas camadas

Requisito escrito do projeto, e implementado com redundância deliberada:

1. **O `select` do Prisma não busca o campo.** Os selects públicos estão centralizados em
   `src/server/services/selects.ts`, o que torna auditável a pergunta "o que esta API
   expõe?".
2. **O mapper copia campo a campo.** `src/server/dto/public-dto.ts` é lista de permissão,
   nunca de bloqueio — porque com lista de bloqueio, campo novo no schema entra por padrão
   na resposta, e é assim que se vaza sem perceber.

Há um teste que grava uma string distintiva em `internalNotes`, chama **todas** as rotas
públicas e falha se ela aparecer em qualquer resposta — mais um segundo teste que confirma
que o dado realmente está no banco, senão o primeiro passaria estando vazio.

Isso responde diretamente ao maior erro de negócio do projeto de referência: `GET /products`
era público e devolvia `custo` e `custoEmbalagem`. Um curl sem token entregava a margem
da loja inteira.

### Toda listagem tem teto

`limit` é 1–100, validado no schema. Nenhuma rota pode devolver a tabela inteira, nem por
acidente. Lá, `GET /products` devolvia o catálogo completo sem projeção e sem limite — e a
home o pedia **quatro vezes em paralelo** a cada visita.

### Cache na CDN, não no navegador

`s-maxage` cacheia na borda sem cachear no navegador da pessoa: preço e disponibilidade
mudam, e o navegador não deve segurar dado velho. `/api/cart/validate` é `no-store` — é o
estado vivo, e cacheá-lo reintroduziria exatamente o problema que ele existe para resolver.

### Rate limit — limitação declarada

É **em memória, por instância**. Em serverless com várias instâncias, o limite efetivo é
`limite × nº de instâncias`. Segura abuso casual e script ingênuo, não um atacante
determinado. A substituição por contador compartilhado (Upstash Redis) entra no PROMPT 04,
junto com o rate limit do login, onde a força bruta é o risco real.

O ponto: ele é fraco **por escala**, não por estar do lado errado. O do projeto de
referência anunciava "3 tentativas → bloqueio de 10 min" com o contador no `localStorage`
do navegador — um `curl` nunca o via, e `localStorage.clear()` o zerava.

### Sem lista vazia como 404

Lista vazia é `200 []`. Lá, o serviço lançava `NotFoundError` quando o catálogo vinha
vazio, e o front redirecionava a vitrine inteira para `/error`. Traduzido para a Caqui:
nenhuma expedição com vaga aberta derrubaria o site.

---

## Testes

`npm test` — 29 casos de integração contra um banco Postgres real (`caqui_trekking_test`).

Não são mocks: cada caso limpa o banco, cria fixtures e chama o route handler de verdade.
O setup **recusa rodar** se a `DATABASE_URL` não apontar para um banco `_test`, porque os
testes truncam tabelas.

Cobertura por área:

- **Catálogo** — rascunho não vaza em rota nenhuma; filtro de preço opera sobre saídas;
  `limit` acima do teto é 400 com detalhe por campo.
- **Agenda** — padrão só futuras; `incluirEncerradas=true` traz a passada marcada; id
  malformado é 400.
- **Produtos** — variante indisponível continua na resposta; preço próprio sobrescreve.
- **Carrinho** — preço vem do banco ignorando o do cliente; esgotado, data passada e
  variante indisponível marcados e fora do total; carrinho misto íntegro soma em centavos.
- **Vazamento** — `internalNotes` ausente de todas as rotas, com prova de que o dado existe.
- **Captura** — rate limit dispara na 6ª tentativa; lead sem consentimento é rejeitado.

---

## Estado da Fase A

- [x] **00** — Análise do Dália
- [x] **01** — Bootstrap
- [x] **02** — Schema e seed
- [x] **03** — API do catálogo _(este documento)_
- [ ] **04** — Auth e API do CRM
- [ ] **05** — Mídia e uploads
