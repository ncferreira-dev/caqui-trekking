# 13 · Vagas, agenda e resultado por saída — pedido guardado (18/08/2026)

> **Status: implementado.** Os itens 1 a 4 entraram em 18/08/2026, com o modelo
> de vagas e o fechamento de saída: ver
> [17-vagas-e-fechamento.md](17-vagas-e-fechamento.md). O item 5, a agenda de
> calendário nos dois lados, entrou no mesmo dia: ver
> [18-agenda-de-calendario.md](18-agenda-de-calendario.md). O item 6 (trazer o
> que serve dos CRMs da Dália e da Doctor Quality) foi absorvido pelos dois.
>
> Este arquivo fica como o registro do pedido original e do raciocínio que o
> desenho seguiu. O que ele descreve como proposta já é o que está no ar em
> localhost.

## O que foi pedido, na ordem em que foi dito

1. Ao cadastrar uma saída no CRM, informar **quantas pessoas cabem** naquela
   trilha.
2. Quando as vagas se esgotarem, o site deve refletir isso **sozinho**.
3. Um **relatório/dashboard** no CRM que contabilize **quanto de lucro** aquela
   viagem deu.
4. Quando a data passar, na hora de tirar a saída do site, registrar **quantas
   vagas foram preenchidas e quantas pessoas foram**, para ter controle.
5. Uma **agenda de calendário**, nos dois lados:
   - No CRM: clicar num dia vazio abre "criar saída" ali mesmo.
   - No site: o cliente escolhe o dia que faz sentido para ele; clicando num dia
     **sem saída**, dispara uma mensagem de WhatsApp já preenchida com aquele
     dia.
6. Aproveitar o que já existe nos CRMs da **Dália Concept** e da **Doctor
   Quality**.

---

## O achado que muda o desenho: aqui não existe reserva

O site da Caqui **não vende**. A mochila termina num `handoff` para o WhatsApp,
e está escrito no rodapé: "o pagamento não acontece aqui". Não há checkout, não
há pedido, não há linha no banco dizendo que alguém comprou.

Então "esgotar sozinho" **não pode** vir de um motor de reservas, porque não
existe um. Se for implementado como se existisse, o site vai anunciar vaga que
já foi vendida no WhatsApp, que é o pior erro possível neste negócio.

O que existe é o **livro do operador**. A contagem é lançada por quem fecha a
venda, e o que passa a ser automático é o **selo**, não a venda:

| Hoje                                          | Com vagas                                          |
| --------------------------------------------- | -------------------------------------------------- |
| `availability` é digitado à mão               | `availability` é **derivado** de vagas             |
| 3 estados que alguém precisa lembrar de virar | 1 número que alguém já ia anotar de qualquer jeito |

O schema já confessa o problema, em `prisma/schema.prisma`:

```prisma
/// MANUAL. Alterado por endpoint dedicado, com histórico em
/// DepartureAvailabilityChange. É o campo mais mexido do sistema.
availability Availability @default(AVAILABLE)
```

"O campo mais mexido do sistema" é a descrição de um campo que devia ser uma
conta. `AVAILABLE`, `LAST_SPOTS` e `SOLD_OUT` saem sozinhos de
`vagasTotais - vagasVendidas`, e o campo manual vira **exceção declarada**
(fechar por chuva, por exemplo), não a operação normal.

---

## Modelo de dados proposto

### `Departure` ganha a capacidade

```prisma
/// Quantas pessoas cabem. Nulo = sem limite declarado, e aí o selo volta a
/// ser manual. Não é `0`: zero significaria "não cabe ninguém".
capacity      Int?
/// Quantas já fecharam. Lançado por quem vende no WhatsApp.
seatsTaken    Int  @default(0)
/// A partir de quantas vagas restantes o selo vira "últimas vagas".
lastSpotsAt   Int  @default(3)
```

Regras que precisam ser do BANCO e não da tela:

- `seatsTaken >= 0`
- `capacity` nulo ⇒ `availability` continua manual
- `seatsTaken > capacity` **é permitido** e vira alerta, não erro: overbooking
  acontece na vida real (dois guias vendendo ao mesmo tempo), e um sistema que
  recusa o lançamento faz a pessoa mentir o número para conseguir salvar.

### `Departure` ganha o fechamento

O item 4 do pedido. Quando a data passa, a saída não some: ela **fecha**.

```prisma
/// Preenchido no fechamento, depois da saída acontecer.
closedAt        DateTime? @db.Timestamptz(3)
/// Quantas pessoas FORAM. Diferente de `seatsTaken`: gente falta.
attendeeCount   Int?
/// Receita realizada em centavos. Não é `preço × pessoas`: tem desconto,
/// cortesia, criança, guia convidado.
revenueCents    Int?
/// Custo realizado em centavos: transporte, alimentação, ingresso do
/// parque, cachê de guia externo.
costCents       Int?
closingNotes    String?   @db.Text
```

**Por que `revenueCents` é lançado e não calculado:** `priceCents × attendeeCount`
está errado em quase toda saída real. Se o número for calculado, o relatório de
lucro fica bonito e falso, e um relatório falso é pior que nenhum, porque
alguém vai decidir preço com base nele.

`lucro = revenueCents - costCents`. Uma função pura, num lugar só
(mecanismo 5 de `arquitetura-defensiva`), chamada pelo card da saída, pelo
relatório do mês e pela exportação. Três telas discordando sobre lucro é
exatamente o defeito que aquela skill descreve.

### `TripCostTemplate` (opcional, segunda rodada)

Custo padrão por roteiro, para o fechamento já vir preenchido e a pessoa só
corrigir. Sem isso, fechar saída vira digitação e ninguém fecha.

---

## As três telas

### 1. Cadastro de saída: um campo, e ele muda o resto

Um campo "vagas" no formulário que já existe. O que ele desbloqueia:

- selo derivado no site (`Últimas vagas`, `Esgotado`)
- o contador "faltam N" no CRM
- a taxa de ocupação no relatório

### 2. Fechamento: a fila do que aconteceu e ninguém anotou

Uma lista no painel: **saídas com data no passado e sem `closedAt`**. É uma
busca que precisa voltar vazia, não um botão que alguém lembra de apertar.

O formulário de fechamento tem quatro campos e um botão. Se levar mais que isso,
não é preenchido, e um fechamento não preenchido derruba o relatório inteiro.

### 3. Relatório: número que é porta

O padrão do KPI da Doctor Quality vale inteiro aqui, e a razão está escrita no
próprio componente dela: _"todo número do dashboard é uma porta: o usuário
clica e vai ver QUAIS são, não só quantos."_

Os números que a operação da Caqui de fato precisa:

| Indicador         | Vem de                                       |
| ----------------- | -------------------------------------------- |
| Lucro do mês      | soma de `revenue - cost` das saídas fechadas |
| Lucro por roteiro | o mesmo, agrupado por `tripId`               |
| Taxa de ocupação  | `attendeeCount / capacity`                   |
| Presença          | `attendeeCount / seatsTaken` (quem faltou)   |
| Saídas por fechar | a fila acima, e ela **precisa** aparecer     |

⚠️ **Cuidado com gráfico:** a operação tem 5 roteiros e 6 saídas. Gráfico com
seis pontos não diz nada e ocupa meia tela. Começar por número e lista; gráfico
quando houver histórico que justifique. Mesma ressalva já anotada em
[12-redesign-crm.md](12-redesign-crm.md) sobre o `recharts`.

---

## A agenda, nos dois lados

O CRM da Doctor Quality já tem esta peça pronta e testada, em
`web/src/components/agenda/`: `AgendaCalendar`, `MonthView`, `WeekView`,
`DayView`, `ListView`, `agendaUtils.ts` e `agendaUtils.spec.ts`.

O que vale trazer, e o porquê:

- **`diasDaGradeDoMes`**: os 42 dias (6 semanas) começando no domingo anterior
  ao dia 1. Grade de tamanho fixo não "pula" de altura ao trocar de mês.
- **`chaveDia` em `YYYY-MM-DD`**: agrupa por dia sem passar por fuso, e comparar
  string nesse formato dá a mesma ordem que comparar data.
- **`dataPorExtenso` montado à mão**, e não `toLocaleDateString`: o texto é
  gerado no servidor e no navegador, e locales diferentes dão divergência de
  hidratação. Este projeto já tem `lib/datetime.ts` com o mesmo cuidado.
- **A armadilha do clique no dia**, documentada lá dentro: a célula **não** pode
  ser `<button>`, porque os chips dentro dela também são botões, e botão dentro
  de botão é HTML inválido. O clique de "criar aqui" vai numa camada de fundo
  absoluta, atrás dos chips.

### No CRM

Clicar num dia vazio abre "criar saída" com a data preenchida. Clicar numa saída
existente abre a saída.

### No site

O pedido do cliente: clicar num dia **sem saída** manda uma mensagem de WhatsApp
já com aquele dia. Isso **já tem metade pronta**: `/guia-particular` monta uma
mensagem pré-preenchida numa constante `PEDIDO`. O que falta é a mesma mensagem
com a data escolhida costurada dentro, e a agenda como calendário além de lista.

⚠️ **Decisão pendente do cliente:** a agenda do site hoje é uma lista
cronológica, que é a forma certa para quem quer saber "qual é a próxima". O
calendário serve a outra pergunta: "eu posso no dia 12, tem algo?". As duas são
legítimas e não são a mesma tela. Provavelmente é lista por padrão, com o
calendário como segunda visão, e não uma substituindo a outra.

---

## O que ainda precisa de resposta antes de escrever código

1. **Quem lança a vaga vendida?** Só o dono, ou qualquer guia? Muda a
   autorização (mecanismo 1) e o rastro (mecanismo 6).
2. **Sinal ou valor cheio?** Se a Caqui cobra sinal por WhatsApp, `revenueCents`
   precisa saber a diferença entre "recebido" e "fechado", ou o lucro do mês
   conta dinheiro que ainda não entrou.
3. **A saída fechada sai do site?** Hoje some por data. Com fechamento, dá para
   manter uma página de saída realizada, que é conteúdo e é prova social.
4. **Custo fixo entra?** Combustível e pedágio são por saída; seguro e Cadastur
   são do mês. Misturar os dois no mesmo campo produz um lucro por viagem que
   não fecha com o lucro do mês.
