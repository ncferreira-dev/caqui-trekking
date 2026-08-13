# 02 — Modelagem do domínio

> Fase A, PROMPT 02. `prisma/schema.prisma` + migration + seed.
> 15 models, 7 enums, 1 migration aplicada, seed idempotente.

---

## O mapa

```
                    ┌──────────────┐
                    │ SiteSetting  │  singleton (CHECK id = 1)
                    │              │  whatsappMessageTemplate ← editável no CRM
                    └──────────────┘

  ┌─────────────┐   N:N   ┌──────┐   1:N   ┌───────────┐   N:N   ┌───────┐
  │ ActivityTag │─────────│ Trip │─────────│ Departure │─────────│ Guide │
  └─────────────┘         └──────┘         └───────────┘         └───────┘
                             │                   │                   │
                             │                   │ 1:N               │
                             │                   ▼                   │
                             │        ┌──────────────────────────┐   │
                             │        │DepartureAvailabilityChange│  │
                             │        └──────────────────────────┘   │
                             │                                       │
   ┌─────────┐  1:N  ┌────────────────┐                              │
   │ Product │───────│ ProductVariant │                              │
   └─────────┘       └────────────────┘                              │
        │                                                            │
        │            ┌────────────┐                                  │
        └────────────│ MediaAsset │──────────────────────────────────┘
             (exatamente uma FK preenchida, garantido por CHECK)

   ┌──────┐        ┌──────────┐      ┌──────┐   ┌────────────────┐
   │ User │────────│ AuditLog │      │ Lead │   │ ContactMessage │──→ Trip?
   └──────┘        └──────────┘      └──────┘   └────────────────┘
```

---

## 1. Por que `Trip` é separado de `Departure`

`Trip` é o **roteiro base, escrito uma vez**: "Pedra Grande de Quatinga", com descrição,
fotos, dificuldade, altimetria, o que levar e política de cancelamento.

`Departure` é a **saída concreta**: 15/08/2026, 06:00, R$ 90,00, últimas vagas.

Os roteiros se repetem todo mês. Sem a separação, cada agenda nova seria uma cópia do mesmo
texto e das mesmas fotos — e a operação real da Caqui é justamente "abrir a agenda do mês que
vem", que precisa ser **um clique duplicando a saída**, não recadastrar o roteiro.

Três consequências que já estão no schema:

**A URL indexável é a da Trip, não a da Departure.** Uma Trip com 12 saídas viraria 12 páginas
quase idênticas se canibalizando no Google e queimando crawl budget. A canônica é
`/expedicoes/[slug]`; as saídas entram na mesma página, como array de ofertas no JSON-LD.

**O `slug` é persistido, gerado uma vez na criação.** Nunca derivado do título em tempo de
render. No projeto de referência o slug era recalculado a cada render — renomear o item mudaria
a URL canônica em silêncio e mataria o ranking.

**"Encerrada" não é status gravado.** Deriva de `startAt < now()`. Um campo `FINISHED` exigiria
alguém atualizando na mão toda semana, e a primeira vez que esquecessem o site mentiria.
Verificado no seed: a saída de 08/08/2026 aparece como encerrada sem nenhum campo dizendo isso.

---

## 2. Por que `availability` é manual

`AVAILABLE | LAST_SPOTS | SOLD_OUT`, alterado à mão. **Sem contagem de vagas, sem decremento,
sem reserva.**

A Caqui controla vaga na conversa do WhatsApp — é lá que a venda fecha. Um número de vagas no
banco seria uma segunda verdade competindo com a real, e ela perderia: bastaria uma venda
fechada no WhatsApp sem alguém abrir o CRM para o site anunciar vaga que não existe.

O projeto de referência é a prova empírica disso. Ele tinha contagem de estoque completa, com
ledger de movimentação — e mantinha o decremento automático **desligado de propósito**:

```js
static BAIXAR_ESTOQUE_NA_VENDA = false;  // DESLIGADO de propósito: o controle é manual
```

Havia até um método `baixarEstoqueDaVenda()` inteiro, escrito, que abortava na primeira linha e
nunca rodou uma vez. Duas lições, as duas aplicadas aqui:

1. **Não escrever a versão automática "para o futuro".** Isso é dívida com aparência de
   previdência: o método dormente fazia read-modify-write sem transação, e no dia em que alguém
   virasse a flag entraria em produção uma corrida jamais testada.
2. **O que vale copiar é a disciplina do caminho único**, não a tabela de estoque. Por isso
   existe `DepartureAvailabilityChange`: quem mudou, quando, de que estado para qual, e por quê.
   `availability` é o campo mais mexido do sistema; sem log, _"por que essa saída ficou esgotada
   no dia 3?"_ não tem resposta. A mudança e o registro são gravados na mesma transação — no
   projeto de referência eram duas escritas soltas que podiam divergir permanentemente.

---

## 3. `MediaAsset`: três FKs anuláveis + CHECK, não polimorfismo por string

O briefing pedia para escolher entre tabela pivô por entidade e `ownerType` + `ownerId`, e
justificar. **Escolhi uma terceira via: uma tabela só, com `tripId` / `productId` / `guideId`
anuláveis, FK de verdade com `ON DELETE CASCADE`, e um CHECK garantindo que exatamente uma está
preenchida.**

```sql
CHECK ((("tripId" IS NOT NULL)::int
      + ("productId" IS NOT NULL)::int
      + ("guideId"  IS NOT NULL)::int) = 1)
```

**Por que não `ownerType` + `ownerId`:** porque joga fora a integridade referencial, que é o
motivo pelo qual escolhemos Postgres. Com um id solto e um discriminador em string, o banco não
tem como saber que `ownerId = 42` aponta para uma Trip que ainda existe. Foi exatamente o que
aconteceu no projeto de referência (MongoDB): apagar um produto deixava `StockMovement` e
`Favorite` órfãos apontando para um id que não existe mais, e ninguém detectava.

**Por que não três tabelas separadas:** duplicaria os oito campos de mídia três vezes, e toda
mudança na forma de tratar imagem passaria a tocar três lugares.

A tabela única com FKs reais dá as duas coisas: cascade automático no delete e um único lugar
para evoluir. O CHECK fecha os dois estados inválidos que as FKs anuláveis sozinhas
permitiriam — imagem órfã e imagem com duas donas. Ambos testados: o Postgres rejeita.

**Adição ao briefing: `publicId`.** Não estava na especificação e entrou porque, sem ele, não há
como apagar a imagem do provedor de storage. No projeto de referência o `public_id` do Cloudinary
era descartado no upload, e **nenhuma imagem jamais foi removida** — nem ao apagar o produto, nem
ao trocar a foto. O código do delete referenciava um campo que nem existia no schema, então o
`if` nunca entrava e o sistema dava a impressão contrária. Cada foto que subiu está lá até hoje.

**`alt` é obrigatório**, não opcional. Acessibilidade e SEO local: é onde entram "trilha",
"cachoeira", "Serra do Mar", "Mogi das Cruzes". Imagem decorativa usa string vazia — explícito,
não esquecido.

---

## 4. Um bug de fuso horário encontrado e corrigido durante o seed

Vale registrar porque foi invisível pela aplicação e teria chegado em produção.

Ao conferir o seed, o instante gravado estava **3 horas à frente**:

```
  quis gravar        2026-08-15T09:00:00Z   (06:00 em São Paulo)
  gravado no banco   2026-08-15T12:00:00Z   ← errado
  lido pelo Prisma   2026-08-15T09:00:00Z   ← certo (!)
```

A sessão do Postgres herdava `America/Sao_Paulo` da máquina, e o adapter tratava `timestamptz`
como naive. O Prisma aplicava o mesmo desvio nas duas pontas, então **ele era autoconsistente e
nada parecia quebrado** — o erro só aparece quando se lê o banco por fora, o que fiz com o driver
`pg` puro.

Quem enxergaria a data errada: relatórios em SQL, o job do sitemap, o feed, o JSON-LD, um `psql`
de plantão, qualquer segundo serviço. Numa saída de nascer do sol às 03:00, o grupo perderia o
nascer do sol.

**Correção:** a sessão é fixada em UTC na criação do adapter, em `src/lib/db-adapter.ts`, que é o
único lugar onde o adapter nasce — a aplicação e o seed importam de lá. Verificado com o `pg`
puro: as 5 saídas do seed batem exatamente com o `meetingTimeLocal` de cada uma.

---

## 5. Regras transversais, e onde cada uma está no schema

| Regra                         | Como foi aplicada                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Dinheiro em `Int` de centavos | `priceCents`, `compareAtPriceCents`. Nunca Float, nunca Decimal. R$ 199,90 = `19990`. CHECK `>= 0` no banco.         |
| Datas UTC                     | `@db.Timestamptz(3)` + sessão em UTC. Exibição converte para `America/Sao_Paulo` na borda da UI.                     |
| Soft delete                   | `deletedAt` em `Trip`, `Product`, `Guide`.                                                                           |
| Timestamps                    | `createdAt`/`updatedAt` em **todos** os models, mesmo vocabulário.                                                   |
| Índices                       | Em toda coluna de filtro ou ordenação. O central é `@@index([status, startAt])` na Departure — a agenda cronológica. |
| Enums do Prisma               | 7 enums. Nenhuma String solta onde o domínio é fechado.                                                              |

**Sobre medidas que não são dinheiro:** `distanceKm` e as coordenadas usam `Decimal` (`numeric` no
Postgres, exato), não Float. Float não entra neste schema em lugar nenhum.

**`meetingTimeLocal` é `String`, deliberadamente.** É um rótulo de parede ("06:00") em horário de
São Paulo, que vai escrito no card e na mensagem do WhatsApp. Não é timestamp e não deve sofrer
conversão de fuso — é o horário que a pessoa lê, não um instante.

**`internalNotes` da Departure nunca sai na API pública.** Isso é responsabilidade do DTO do
PROMPT 03, e o teste que garante isso entra lá.

---

## 6. Constraints que o Prisma não expressa

Escritas à mão no SQL da migration, porque são regras de integridade e pertencem ao banco:

| Constraint                                                           | O que impede                                                                                      | Testado     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------- |
| `site_settings_singleton`                                            | Segunda linha de configuração                                                                     | ✓ rejeitado |
| `media_assets_exatamente_um_dono`                                    | Imagem órfã ou com duas donas                                                                     | ✓ rejeitado |
| `departures_preco_nao_negativo`                                      | Preço negativo                                                                                    | ✓ rejeitado |
| `products_preco_nao_negativo`, `product_variants_preco_nao_negativo` | Idem                                                                                              | —           |
| `departures_fim_depois_do_inicio`                                    | Saída que termina antes de começar                                                                | —           |
| `departures_tripId_startAt_key` (unique)                             | Duas saídas do mesmo roteiro no mesmo instante — o duplo clique em "duplicar para o mês seguinte" | ✓ rejeitado |

---

## 7. O seed

`npx prisma db seed` — **idempotente**. Rodar duas vezes não duplica: tudo entra por `upsert`
sobre a chave natural. Verificado rodando duas vezes seguidas; as contagens não mudam.

O que ele cria:

- **SiteSetting** com o WhatsApp `(11) 94301-7232`, `@caquitrekking`, `@caqui.wear` e o template
  da mensagem com placeholders.
- **8 tags de atividade**: rapel, tirolesa, cachoeira, trilha, escalaminhada, nascer do sol,
  camping, boia cross.
- **5 expedições com a agenda real de agosto/2026**, cada uma com uma saída:

  | Data (SP)   | Roteiro                                   | Preço     | Disponibilidade          |
  | ----------- | ----------------------------------------- | --------- | ------------------------ |
  | 08/08 07:00 | Fazenda Santa Rita — Cachoeira do Paredão | R$ 199,90 | **encerrada** (derivada) |
  | 15/08 06:00 | Pedra Grande de Quatinga                  | R$ 90,00  | Vagas abertas            |
  | 16/08 08:00 | Mega Tirolesa de 2 km + Rapel de 50 m     | R$ 299,00 | **Esgotado**             |
  | 23/08 03:00 | Nascer do Sol no Pico do Lopo             | R$ 279,00 | Vagas abertas            |
  | 29/08 05:00 | Escalavrado — Teresópolis                 | R$ 425,00 | **Últimas vagas**        |

  Os três estados de disponibilidade estão representados, mais o caso de saída encerrada.

- **3 produtos Caqui Wear, 15 variantes** — peças e preços reais do catálogo da marca: Camiseta
  Dry Fit (R$ 50,00, dois tamanhos de cor), Baby Look Dry Fit (R$ 50,00, três cores) e Caneca
  (R$ 35,00, tamanho único). Uma combinação está marcada como indisponível de propósito: a UI
  precisa mostrá-la desabilitada, não sumir com ela.
- **1 usuário OWNER**, com senha vinda de `SEED_OWNER_PASSWORD` e hash bcrypt cost 12.
- **2 guias de exemplo**, para a página de expedição ter o bloco de guias responsáveis testável.

**Não cria imagens.** `MediaAsset` não tem chave natural para upsert, e as fotos reais entram no
PROMPT 05, pelo import em lote da pasta de assets.

---

## Pendências que o cliente precisa resolver

Nenhuma bloqueia o PROMPT 03, mas todas viram texto no site:

1. **Descrição de cada roteiro.** As do seed são de trabalho, escritas por mim a partir do nome
   da expedição. Precisam da revisão de quem guia.
2. **Política de cancelamento real.** A do seed é um esboço genérico.
3. **Número do Cadastur e credenciais PESM.** Estão como placeholder no `SiteSetting`, e são
   justamente o que sustenta o argumento de segurança da marca.
4. **Fotos originais.** Imagem de feed do Instagram é quadrada e comprimida — não sustenta hero
   nem Open Graph.

---

## Estado da Fase A

- [x] **00** — Análise do Dália
- [x] **01** — Bootstrap
- [x] **02** — Schema e seed _(este documento)_
- [ ] **03** — API do catálogo, incluindo `POST /api/cart/validate`
- [ ] **04** — Auth e API do CRM
- [ ] **05** — Mídia e uploads
