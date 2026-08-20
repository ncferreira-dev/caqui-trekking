# 20 · Auditoria arquitetural do CRM (20/08/2026)

> **Escopo:** o painel administrativo, do clique ao banco. Concorrência, transações,
> consultas, índices, permissões, tratamento de erro e processo de entrega.
>
> **Método:** leitura do código, `EXPLAIN` no Postgres de desenvolvimento e medição
> no navegador contra o servidor local. Nada foi alterado durante a auditoria.
>
> **Pedido do cliente:** "o CRM no dia a dia" foi apontado como a dor real. Os
> achados estão ordenados por impacto sobre a operação diária, não por gravidade
> teórica.

---

## Situação dos achados (atualizado em 20/08/2026)

| #   | Achado                             | Situação                      |
| --- | ---------------------------------- | ----------------------------- |
| A1  | Corrida no lançamento de vagas     | resolvido — ver nota          |
| A2  | `P2002` virava "Erro interno"      | resolvido em `3d7e27d`        |
| A3  | Nada obrigava o `npm run check`    | resolvido em parte — ver nota |
| A4  | Três consultas em fila nas saídas  | resolvido em `3d7e27d`        |
| A5  | `startAt` sem índice próprio       | **aberto** — sem urgência     |
| A6  | bcrypt dentro da transação         | resolvido em `3d7e27d`        |
| A7  | O toque de vagas bloqueia o seguin | **aberto** — decisão pendente |

**Nota sobre o A1:** resolvido preservando a decisão de o campo ser um TOTAL,
que continua certa — é o número que a pessoa tem na cabeça depois de desligar o
telefone. O que entrou foi uma trava otimista: quem lança declara o valor que
estava na tela, e o `UPDATE` só casa a linha se ela ainda estiver nele. Não
estando, a resposta é 409 dizendo o número atual, em vez de apagar o lançamento
do outro.

A leitura também veio para dentro da transação, o que corrige o `from` do
histórico. Sozinha ela não resolveria a perda: no isolamento padrão do Postgres
as duas transações leem o mesmo valor e as duas gravam. A condição precisa
fazer parte do próprio `UPDATE`.

**Nota sobre o A3:** entrou a camada que importa, o GitHub Actions rodando
`npm run check` em push e pull request (`.github/workflows/check.yml`). O hook
local de pre-commit **não** entrou: ele exige uma dependência nova
(`lint-staged`) e muda o `npm install` de todo mundo, e a barreira que não
depende da máquina de ninguém já está de pé.

---

## Antes dos achados: o que está sólido

Isto não é cortesia. Os itens abaixo foram conferidos um a um e passaram, e é o
que permite ler o resto do documento sem susto.

| Camada                | Estado                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Soft delete           | `deletedAt: null` presente em toda consulta de `Trip`, `Product` e `Guide`, pública e admin      |
| Autorização           | Tabela `rota × método × papel` em `server/autorizacao.ts`, confrontada com o disco por teste     |
| Sessão                | Cookie `httpOnly`, `secure` em produção, `sameSite: 'strict'`, `tokenVersion` invalidando logout |
| Bloqueio de login     | Contador e `lockedUntil` no banco, não no navegador. Tentativa durante bloqueio não conta        |
| Transações            | Toda mutação administrativa roda em `$transaction`, com a auditoria gravada dentro dela          |
| `CHECK` no banco      | Nove restrições em `departures`, cobrindo negativos, capacidade e ordem das datas                |
| Paginação             | Teto aplicado no schema de entrada. Nenhuma rota devolve a tabela inteira, nem por acidente      |
| Vazamento de internos | `internalNotes` fora dos DTO públicos, com teste dedicado                                        |

O modelo de dados está certo. Os achados abaixo são de **execução**, não de
modelagem.

---

## A1 · A vaga lançada pode sumir sem aviso

**Gravidade: alta.** É dado de venda.

**PROBLEMA**
`lancarVagas` (`server/services/admin/departure-admin-service.ts:239`) lê a saída
**fora** da transação e grava um valor **absoluto** dentro dela:

```ts
const atual = await exigirSaida(departureId) // ← fora
const seloAntes = seloDe(atual)

return prisma.$transaction(async (tx) => {
  const depois = await tx.departure.update({
    data: { seatsTaken: entrada.seatsTaken }, // ← valor absoluto, vindo do cliente
  })
```

O front agrava: `controle-de-vagas.tsx` envia `valor + 1`, onde `valor` é o número
que **aquela aba** tinha na tela.

**IMPACTO**
Dois guias lançando vaga ao mesmo tempo, ou a mesma pessoa com duas abas abertas:
o segundo `PATCH` sobrescreve o primeiro. Uma venda some do livro, sem erro, sem
log, sem ninguém perceber. O selo do site passa a mostrar mais vaga do que existe.

O histórico mente junto: `seloAntes` sai daquela leitura de fora, então
`DepartureAvailabilityChange` pode gravar um `from` que nunca existiu. O registro
que existe para responder "por que essa saída ficou esgotada no dia 3?" passa a
dar a resposta errada.

**A ironia** — o comentário do `schema.prisma` cita exatamente este cenário
("dois guias vendendo ao mesmo tempo") para justificar permitir overbooking. A
decisão de produto está certa. É a implementação que tem a janela.

**RECOMENDAÇÃO**
Três caminhos, com consequências diferentes para a UI:

1. **Incremento relativo** — o botão manda `+1` / `-1` e o banco faz
   `seatsTaken: { increment: 1 }`. Atômico, sem trava, sem tela nova. Não resolve
   o campo digitado à mão, que continua absoluto.
2. **Leitura dentro da transação** — move o `exigirSaida` para dentro do
   `$transaction`. Corrige o histórico. **Não** corrige a perda: sem
   `SELECT ... FOR UPDATE` ou isolamento serializável, duas transações ainda leem
   o mesmo valor.
3. **Trava otimista** — o cliente manda o `updatedAt` que viu; o `update` filtra
   por ele e, não casando, devolve 409 "alguém mudou isso agora, confira". É o
   único que **conta a verdade para quem está operando**, e o único que exige
   tela nova.

**RISCO DE MEXER** — baixo no 1 e no 2; médio no 3, que muda o contrato da rota e
pede tratamento novo no front.

**DECISÃO NECESSÁRIA** — qual dos três. Minha recomendação é **1 + 2 juntos**
(botões atômicos e histórico correto), deixando o 3 para quando houver mais de
uma pessoa lançando de verdade. Hoje a operação é a Caqui sozinha, e a trava
otimista cobraria uma tela nova para um conflito que ainda não acontece.

---

## A2 · Colisão de dado único vira "Erro interno"

**Gravidade: média.**

**PROBLEMA**
`route-handler.ts` traduz `P2025` do Prisma (registro inexistente) para 404, mas
**não trata `P2002`** — violação de restrição única. Confirmado por varredura: a
única referência a código do Prisma no projeto inteiro é o `P2025`.

O padrão das rotas é conferir antes e inserir depois:

```ts
const jaExiste = await prisma.departure.findUnique({ where: { tripId_startAt: ... } })
if (jaExiste) throw new AppError(ErrorCode.CONFLICT, 'Já existe uma saída...')
// ← janela
return prisma.$transaction(...)
```

A conferência devolve um 409 bonito no caso normal. Na corrida, quem barra é a
restrição do banco, e aí o erro cai no ramo do desconhecido.

**IMPACTO**
A pessoa vê **"Erro interno. Tente novamente."** com um `requestId`, em vez de
"já existe uma saída deste roteiro nesta data". Vale para o duplo clique em
"duplicar para o mês seguinte", para e-mail repetido em usuário novo, para slug
repetido em roteiro e produto, e para variante com mesmo tamanho e cor.

Pior que o susto: a pessoa tenta de novo, vê o registro lá, e fica sem saber se
criou dois.

**RECOMENDAÇÃO**
Acrescentar o ramo `P2002` no `route-handler`, junto do `P2025`, devolvendo 409 e
usando `meta.target` para dizer qual campo colidiu. É uma correção de **classe
inteira**, num arquivo só, exatamente como o `P2025` já é.

**RISCO DE MEXER** — muito baixo. Ramo novo num `catch` que já existe.

**DECISÃO NECESSÁRIA** — nenhuma. É consenso técnico. Só precisa de ordem.

---

## A3 · Nada obriga o `npm run check` a passar

**Gravidade: alta.** É processo, e processo é o que deixa os outros achados voltarem.

**PROBLEMA**
Não existe `.github/workflows`, não existe husky, não existe hook em
`.git/hooks`, não existe `lint-staged`. O `npm run check` é excelente e é
**opcional**.

**EVIDÊNCIA, e ela é do próprio repositório**
O commit `4285a2a`, o último antes desta auditoria, entrou com o lint vermelho:
introduziu um travessão na dica do editor de saída, que a regra
`no-restricted-syntax` recusa. Ficou assim até a Tarefa 0 de hoje. No mesmo
commit, `src/lib/cores.ts` nasceu sem teste nenhum, apesar de terminar exportando
`NOMES_DE_COR` com o comentário "só para o teste".

Um projeto com 500 testes, tabela de autorização auditada e nove `CHECK` no banco
não tem como confiar a última milha à memória de quem commita.

**IMPACTO**
Todo mecanismo de defesa deste repositório vale o quanto alguém lembrar de rodar.
E o repositório já provou que às vezes não lembra.

**RECOMENDAÇÃO**
Duas camadas, nesta ordem:

1. **GitHub Actions** rodando `npm run check` em push e pull request. É a barreira
   que não depende da máquina de ninguém. Precisa de um Postgres de serviço para
   os testes que tocam o banco.
2. **Hook local de pre-commit** rodando lint e format nos arquivos em stage
   (`lint-staged`). Não roda a bateria inteira, que leva 208 segundos e mataria a
   vontade de commitar.

**RISCO DE MEXER** — baixo. Some um arquivo de workflow e uma dependência de dev.
O risco real é o oposto: continuar sem.

**DECISÃO NECESSÁRIA** — o repositório tem remoto no GitHub? Sem isso, só a
camada 2 se aplica.

---

## A4 · A página mais usada faz três idas ao banco em fila

**Gravidade: média.** Invisível localmente, real na produção.

**PROBLEMA**
`app/(crm)/crm/(painel)/saidas/page.tsx` faz três consultas **sequenciais**:

```ts
const totalDeSaidas = await prisma.departure.count(...)   // 1
const linhas = await prisma.departure.findMany(...)       // 2
const roteiros = await prisma.trip.findMany(...)          // 3
```

A 2 depende da 1, porque `fatiar` precisa do total. Mas a **3 não depende de
nenhuma** das duas: é a lista de roteiros para o seletor de "nova saída".

O painel (`painel/page.tsx`) faz isso certo, com nove consultas em `Promise.all`.
A página de saídas, que é a mais aberta, não.

Somando o layout, uma navegação para `/crm/saidas` custa: sessão (layout) +
`count` de mensagens não lidas + sessão (página) + três consultas acima. Seis
idas ao banco, e só duas em paralelo.

**IMPACTO**
Local, com Postgres na mesma máquina, isso não aparece. Em produção o banco é o
Neon e a aplicação é a Vercel: cada ida é uma travessia de rede. Seis travessias
sequenciais é o tipo de coisa que faz o painel "demorar para abrir" sem nenhuma
consulta lenta no relatório.

**RECOMENDAÇÃO**
Juntar `roteiros` ao `Promise.all` com o `count`. Elimina uma travessia inteira,
em três linhas, sem mudar comportamento nenhum.

A leitura dupla de sessão (layout e página) é **deliberada** e está justificada em
`server/crm/sessao-da-pagina.ts`: layout do Next não é barreira. Não mexer.

**RISCO DE MEXER** — muito baixo.

**DECISÃO NECESSÁRIA** — nenhuma.

---

## A5 · `startAt` não tem índice próprio

**Gravidade: baixa hoje. Média quando houver volume.**

**PROBLEMA**
Os três índices de `departures` que contêm `startAt` o têm como coluna **não
principal**:

```
departures_status_startAt_idx           (status, startAt)
departures_tripId_startAt_idx           (tripId, startAt)
departures_status_closedAt_startAt_idx  (status, closedAt, startAt)
```

A consulta central do CRM filtra `startAt` **sem** `status`, de propósito, para
que rascunho e cancelada apareçam. Nenhum dos três serve para essa varredura.

**EVIDÊNCIA**

```
EXPLAIN SELECT id FROM departures WHERE "startAt" >= now() ORDER BY "startAt";
  Sort
    ->  Seq Scan on departures
```

**IMPACTO — e o tamanho honesto dele**
A tabela tem **6 linhas**. Com 6 linhas o Postgres varreria tudo mesmo havendo
índice, porque é mais barato. **Isto não está lento hoje e não é a causa de
lentidão nenhuma.** É uma regra do próprio `schema.prisma` ("índice em toda coluna
usada em filtro ou ordenação") que tem uma exceção não intencional, e que cobra a
conta quando a agenda acumular anos de saídas.

**RECOMENDAÇÃO**
Um `@@index([startAt])` na próxima migration que houver. Não vale uma migration
só para ele agora.

**RISCO DE MEXER** — nenhum.

**DECISÃO NECESSÁRIA** — nenhuma. É item de "quando passar por perto".

---

## A6 · O hash da senha roda dentro da transação

**Gravidade: baixa.**

**PROBLEMA**
Em `app/api/admin/users/route.ts`, `gerarHash(dados.senha)` é chamado **dentro** do
`prisma.$transaction`. O bcrypt com custo 12 leva de 250 a 400 ms de CPU, e a
transação fica aberta o tempo todo.

**IMPACTO**
Uma conexão do pool presa por até meio segundo fazendo trabalho que não é de
banco. Com a criação de usuário sendo rara e restrita a OWNER, é irrelevante na
prática. Vira problema se o padrão for copiado para uma rota movimentada.

**RECOMENDAÇÃO**
Calcular o hash antes de abrir a transação. Uma linha movida.

**RISCO DE MEXER** — nenhum.

---

## A7 · Cada toque recarrega a página inteira

**Gravidade: média.** É o achado que mais casa com "o CRM no dia a dia".

**PROBLEMA**
`router.refresh()` aparece **33 vezes em 19 componentes** do CRM. Toda mutação
dispara uma re-renderização completa da página no servidor.

**EVIDÊNCIA — medido no navegador, um clique em "+1 vaga"**

| Requisição                            | Tempo (local, a quente) |
| ------------------------------------- | ----------------------- |
| `PATCH /api/admin/departures/4/vagas` | 37 ms                   |
| `GET /crm/saidas?_rsc=...`            | 49 ms                   |

A primeira medição, a frio, deu 675 ms na PATCH — compilação do modo dev, não
conta.

**IMPACTO**
A UI já é otimista: o número muda na hora. Mas `controle-de-vagas.tsx` marca
`ocupado` e **bloqueia o próximo toque** até o servidor responder. Lançar seis
vagas são seis idas e voltas em fila, cada uma re-executando as seis consultas do
A4.

Local dá 86 ms e ninguém sente. Em produção, com Neon, essas duas requisições
carregam as travessias de rede do A4 dentro delas. A promessa escrita na própria
tela é "mude a disponibilidade em um toque".

**RECOMENDAÇÃO**
Não trocar o `router.refresh()` por gestão de estado no cliente. O padrão atual é
correto e é o que mantém a página como fonte única da verdade. O que dá para
fazer sem virar arquitetura nova:

1. Resolver o A4 primeiro. Metade do custo do refresh é a fila de consultas.
2. Soltar o `ocupado` no botão de passo, deixando os toques se acumularem, com
   uma única gravação depois de uma pausa curta. Casa com o A1, caminho 1: com
   incremento relativo, toques acumulados são somáveis com segurança.

**RISCO DE MEXER** — médio no item 2: mexe no comportamento do controle mais usado
do sistema, e precisa de teste próprio para a rajada de cliques.

**DECISÃO NECESSÁRIA** — se o item 2 entra agora ou depois do redesign. Ele mexe
no mesmo componente que o redesign vai tocar.

---

## Ordem de ataque sugerida

Do mais barato e mais seguro para o mais caro:

| #   | Achado                           | Custo  | Risco | Decisão pendente            |
| --- | -------------------------------- | ------ | ----- | --------------------------- |
| 1   | A2 · `P2002` no tratador de erro | 15 min | nulo  | nenhuma                     |
| 2   | A4 · `roteiros` no `Promise.all` | 10 min | nulo  | nenhuma                     |
| 3   | A6 · hash fora da transação      | 5 min  | nulo  | nenhuma                     |
| 4   | A3 · CI e hook                   | 1 h    | baixo | tem remoto no GitHub?       |
| 5   | A1 · corrida das vagas           | 2 h    | médio | qual dos três caminhos      |
| 6   | A7 · rajada de toques            | 3 h    | médio | antes ou depois do redesign |
| 7   | A5 · índice em `startAt`         | junto  | nulo  | nenhuma                     |

Os três primeiros somam meia hora, não têm decisão pendente e não mudam
comportamento nenhum visível. São o pacote óbvio.

---

## O que esta auditoria NÃO cobriu

Dito para que ninguém leia ausência como aprovação:

- **O site público.** O escopo pedido foi o CRM.
- **Acessibilidade e contraste.** Existem testes (`contraste.test.ts`), não foram
  reavaliados.
- **Custo de build e tamanho de bundle.**
- **A migração de `availabilityOverride`.** As saídas já cadastradas não foram
  conferidas uma a uma contra a regra derivada nova.
- **Carga real.** Tudo foi medido com 6 saídas e um usuário.
