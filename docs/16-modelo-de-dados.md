# 16 · O modelo de dados, como arquitetura

> Segundo documento da série. O primeiro é [15-mapa-da-api.md](15-mapa-da-api.md).
> Aqui o assunto é o desenho: quais entidades existem, por que estão separadas
> assim, o que as relações dizem sobre o produto, e onde o modelo ainda não
> responde ao que a operação pede.

---

## 1. A pergunta que o modelo responde primeiro

**Não existe "workspace" neste sistema, e isso é uma decisão.**

Vale começar por aí porque é a primeira coisa que um CRM costuma ter. Workspace
(ou tenant, ou organização) existe para separar dados de clientes diferentes no
mesmo banco. A Caqui Trekking é **uma** operação, com **um** conjunto de dados e
dois operadores. Um `workspaceId` em toda tabela custaria um índice a mais em
cada consulta, uma cláusula a mais em cada `where` — e a primeira vez que
alguém esquecesse a cláusula, vazaria dado entre inquilinos que não existem.

O que faz o papel de "configuração da organização" é `SiteSetting`, um singleton
com `CHECK (id = 1)` na migration. Sem o CHECK, "singleton" é uma combinação que
alguém quebra num INSERT distraído.

**Quando isso mudaria:** se a Caqui abrir franquia, ou se o sistema for vendido
para uma segunda operadora. Aí `workspaceId` entra em Trip, Product, Guide,
User e SiteSetting deixa de ser singleton. É uma migração grande, e é a certa
para se fazer no dia em que houver um segundo cliente — não antes.

---

## 2. A separação que carrega o produto inteiro

```
Trip  (o roteiro, escrito uma vez)
  └── Departure  (a saída, com data e preço próprios)
```

`Trip` é "Pedra Grande de Quatinga": a descrição, a distância, o desnível, o que
levar, a política de cancelamento, as fotos. `Departure` é "Pedra Grande,
15/08/2026, 06:00, R$ 90,00".

Sem essa separação, cada data nova seria duplicação do conteúdo inteiro: o mesmo
texto, as mesmas fotos e as mesmas medidas copiados todo mês. O CRM ficaria
insuportável e a correção de um erro de texto teria que ser feita doze vezes.

**A consequência de SEO é o que fecha a decisão:** só `Trip` tem URL indexável
(`/trekking/[slug]`). `Departure` não ganha página própria — doze saídas do
mesmo roteiro seriam doze páginas quase idênticas competindo entre si no Google.

### O que cada uma possui

| Pertence a `Trip`                      | Pertence a `Departure`                |
| -------------------------------------- | ------------------------------------- |
| descrição, destaques, o que levar      | data, hora de encontro, ponto         |
| distância, desnível, altitude, duração | preço e preço "de"                    |
| dificuldade, cidade, estado, região    | vagas, disponibilidade, guias da data |
| fotos, tags de atividade               | notas internas, fechamento            |
| política de cancelamento               | status de publicação próprio          |

O critério: **muda com a data?** Se muda, é da saída. O preço é da saída porque
alta temporada custa diferente. O guia é da saída porque quem leva muda. A
distância é do roteiro porque a montanha não anda.

---

## 3. As relações, e o que elas revelam

```
SiteSetting (singleton)

Guide ──┬── MediaAsset (fotos)
        └── DepartureGuide ──┐
                             │
Trip ──┬── MediaAsset        │
       ├── TripActivityTag ──┴── ActivityTag
       ├── ContactMessage
       └── Departure ──┬── DepartureGuide
                       └── DepartureAvailabilityChange ── User

Product ──┬── MediaAsset
          └── ProductVariant

User ── AuditLog
Lead   (solto, de propósito)
```

### `MediaAsset` tem três donos possíveis, e exatamente um preenchido

```prisma
tripId    Int?
productId Int?
guideId   Int?
```

Com `CHECK` na migration garantindo que exatamente uma está preenchida.

A alternativa comum seria `ownerType: String` + `ownerId: Int` (polimórfico). Ela
foi recusada porque joga fora a integridade referencial, que é o motivo de
termos escolhido Postgres. No projeto de referência (MongoDB), apagar um produto
deixava registros órfãos apontando para um id inexistente. Com FK e
`ON DELETE CASCADE` isso é impossível por construção.

**O que isso ainda não resolve:** a imagem não sabe de que COR ela é. É o
assunto de [14-cadastro-de-produto.md](14-cadastro-de-produto.md), e a resposta
é um campo `colorName` na própria mídia — não uma tabela de ligação, porque uma
peça fotografada mostra uma cor.

### `TripActivityTag` é a única relação N-para-N do sistema

E é a única entidade que **nenhuma tela escreve**. As cinco tags do seed são
todas as tags que existirão até alguém construir a ligação. Ver o item 3.3 do
mapa da API.

### `DepartureGuide` é N-para-N porque saída tem mais de um guia

E o mesmo guia leva várias saídas. Não há campo de papel (guia principal,
monitor de apoio): se a operação passar a distinguir, é uma coluna nesta tabela,
não uma tabela nova.

### `Lead` não se relaciona com nada, e é intencional

Quem assina a newsletter não é um usuário nem um cliente: é um e-mail com
consentimento e uma origem. Ligá-lo a `Trip` ou a `User` criaria um CRM de
pessoas que ninguém pediu, com as obrigações de LGPD que vêm junto.

`consentAt` é `DateTime?`, não `Boolean`: "quando consentiu" responde à
pergunta que a LGPD faz, e "sim" não responde.

---

## 4. As sete regras transversais do schema

Escritas no topo de `prisma/schema.prisma` e aplicadas sem exceção:

1. **Dinheiro é `Int` de centavos.** Nunca `Float`, nunca `Decimal`. No projeto
   de referência o dinheiro era `Float` e o helper de arredondamento errava
   sistematicamente acima de R$ 8.192,00.
2. **Data é `Timestamptz`, gravada em UTC.** A conversão para
   `America/Sao_Paulo` acontece num helper único, na borda da UI. A saída de
   nascer do sol é às 03:00: errar o fuso muda o DIA.
3. **Soft delete (`deletedAt`) em Trip, Product e Guide.** Saída passada é
   registro histórico, não lixo.
4. **`createdAt`/`updatedAt` em todos os models.**
5. **Índice em toda coluna usada em filtro ou ordenação.**
6. **Enum do Prisma, nunca String solta.** No projeto de referência `category`
   era texto livre, e "anéis" e "aneis" viravam duas linhas no relatório.
7. **Medida exata que não é dinheiro usa `Decimal`** (distância, coordenada).
   `Float` não entra neste schema em lugar nenhum.

### A regra 3 tem um buraco conhecido

O filtro automático de soft delete vale para o nível de cima da consulta.
**Relação aninhada precisa do filtro escrito à mão** — e foi exatamente aí que
apareceu, em 18/08/2026, um guia arquivado continuando a sair com nome, Cadastur
e PESM na API pública, através do join de `Departure → DepartureGuide → Guide`.

Isso merece varredura no verificador, não vigilância.

---

## 5. O que mudou em 18/08/2026: a disponibilidade virou conta

Era assim:

```prisma
/// MANUAL. É o campo mais mexido do sistema.
availability Availability @default(AVAILABLE)
```

"O campo mais mexido do sistema" é a descrição de uma conta que alguém está
fazendo de cabeça. A Caqui fecha vaga no WhatsApp; entre fechar a última e
lembrar de abrir o CRM existia uma janela em que o site anunciava vaga vendida.

Agora:

```prisma
capacity             Int?           // quantas cabem
seatsTaken           Int  @default(0)   // o livro do operador
lastSpotsAt          Int  @default(3)   // limiar de "últimas vagas"
availabilityOverride Availability?      // a EXCEÇÃO declarada
```

O selo do site sai de `estadoDeVagas()` em `src/lib/vagas.ts`, uma função pura
chamada pelo DTO público, pelo CRM e pelo carrinho — os três concordam porque
os três chamam a mesma coisa.

`availabilityOverride` guarda só a exceção: chuva, parque interditado, decisão
do guia. `null` significa "vale a conta". Sem `capacity`, o campo volta a ser a
fonte da verdade, e é isso que fez a migração não quebrar nenhuma saída
existente.

### E o fechamento

```prisma
closedAt      DateTime?   // tira da fila "por fechar"
attendeeCount Int?        // quantas pessoas FORAM
revenueCents  Int?        // receita LANÇADA
costCents     Int?        // custo LANÇADO
closingNotes  String?
```

Receita não é `priceCents × attendeeCount`. Essa conta está errada em quase toda
saída real (desconto, cortesia, criança, guia convidado, pagamento parcial), e
calculada produz um relatório de lucro bonito e falso — do tipo que alguém usa
para decidir preço.

`null` é estado legítimo ("ainda não sei quanto custou") e é diferente de zero.
`lucroCentavos()` devolve `null` quando falta um dos lados, em vez de tratar
ausência como zero: senão a saída sem custo lançado aparece como a mais
lucrativa do mês, e a lista ordenada por lucro coloca o dado que falta no topo.

---

## 6. Onde o modelo ainda não responde à operação

| Pergunta que a Caqui faz             | O modelo responde?  |
| ------------------------------------ | ------------------- |
| Quantas vagas sobraram nesta saída?  | sim, desde 18/08    |
| Quanto lucrei nessa viagem?          | sim, desde 18/08    |
| Qual roteiro dá mais resultado?      | sim (agrupando)     |
| Que foto é da camiseta azul?         | **não** (doc 14)    |
| Quem levou o grupo do dia 12?        | sim                 |
| Esse guia ainda está na equipe?      | sim, mas vaza (§4)  |
| Quantas pessoas faltaram?            | sim                 |
| Qual meu custo fixo do mês?          | **não**             |
| Esse cliente já viajou comigo antes? | **não**, e nem deve |

As duas últimas merecem nota.

**Custo fixo do mês** (seguro, Cadastur, contador) não cabe em `Departure`:
misturado ali, o lucro por viagem deixa de fechar com o lucro do mês. Se entrar,
é uma entidade própria — `CustoMensal` — e o relatório passa a ter duas linhas
distintas: margem por saída e resultado do mês.

**Histórico de cliente** exigiria transformar `Lead` num cadastro de pessoas, com
tudo que a LGPD pede junto. A Caqui não vende no site; o cliente é uma conversa
de WhatsApp. Enquanto for assim, guardar menos é a decisão certa.

---

## 7. O que eu faria a seguir, nesta ordem

1. **`POST /api/admin/trips`.** Enquanto não existir, o modelo inteiro está
   ancorado no que o seed criou. É o gargalo real.
2. **Filtro de guia arquivado nos joins públicos**, num `where` compartilhado.
   Defeito de dado pessoal exposto, com correção de três linhas.
3. **`MediaAsset.colorName`.** Migração aditiva, nulo, não quebra nada.
4. **CRUD de guia e a ligação de tag ao roteiro.**
5. **`CustoMensal`**, se e quando o relatório do mês for pedido de verdade.
