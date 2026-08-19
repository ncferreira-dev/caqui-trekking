# 17 · Vagas e fechamento — o que foi implementado

> Terceiro documento da série ([15](15-mapa-da-api.md) é o mapa da API, [16](16-modelo-de-dados.md)
> é o modelo de dados). Aqui está o que saiu do papel em 18/08/2026, a partir da
> especificação de [13-vagas-agenda-e-resultado.md](13-vagas-agenda-e-resultado.md).

---

## O que mudou, em uma frase

**A disponibilidade deixou de ser um campo que alguém digita e virou uma conta
sobre dois números que o operador já anotava de qualquer jeito.**

---

## 1. O defeito que isso corrige

O schema descrevia `availability` como "o campo mais mexido do sistema". Campo
mais mexido do sistema é a descrição de uma conta que alguém está fazendo de
cabeça, várias vezes por semana, sem rede.

O fluxo real: a Caqui está no meio de uma conversa no WhatsApp, alguém fecha a
última vaga, e ela precisa lembrar de abrir o CRM e marcar "esgotado" antes da
próxima pessoa pedir. Entre uma coisa e outra, o site anuncia vaga vendida. A
janela dura o tempo de uma conversa.

---

## 2. O modelo

```prisma
capacity             Int?              // quantas cabem
seatsTaken           Int  @default(0)  // o livro do operador
lastSpotsAt          Int  @default(3)  // limiar de "últimas vagas"
availabilityOverride Availability?     // a EXCEÇÃO declarada

closedAt      DateTime?  // tira da fila "por fechar"
attendeeCount Int?       // quantas pessoas FORAM
revenueCents  Int?       // receita LANÇADA
costCents     Int?       // custo LANÇADO
closingNotes  String?
```

Com CHECKs no banco para o que a tela não garante sozinha: `seatsTaken >= 0`,
`capacity > 0` quando presente, receita e custo não negativos.

**Overbooking é permitido de propósito.** Dois guias vendendo ao mesmo tempo
acontece, e um banco que recusa o lançamento faz a pessoa mentir o número para
conseguir salvar. Vira alerta na tela, não erro.

### A migração não quebrou nada

`AVAILABLE` era o estado "nada de especial", e é exatamente o que a conta
devolve quando há vaga. Copiá-lo para a exceção transformaria toda saída
existente em exceção permanente. `LAST_SPOTS` e `SOLD_OUT` eram decisões
humanas de verdade, e viraram exceção declarada.

```sql
UPDATE "departures"
SET "availabilityOverride" = "availability"
WHERE "availability" <> 'AVAILABLE';
```

Saída sem `capacity` continua funcionando exatamente como antes.

---

## 3. A lógica pura

`src/lib/vagas.ts`, sem Prisma, sem React, sem fuso:

| Função           | Responde                                              |
| ---------------- | ----------------------------------------------------- |
| `estadoDeVagas`  | qual selo o site mostra, e quantas vagas sobraram     |
| `lucroCentavos`  | receita menos custo, ou `null` se faltar um dos lados |
| `taxaDeOcupacao` | quem foi sobre a capacidade, ou `null`                |

Os três chamadores usam a mesma função: o DTO público, a tela do CRM e o
carrinho. É o que faz os três concordarem, em vez de cada um repetir a regra com
uma diferença sutil.

**`lucroCentavos` devolve `null` quando falta um lado, e não zero.** Tratar
ausência como zero é o defeito clássico do relatório financeiro: a saída sem
custo lançado apareceria como a mais lucrativa do mês, e a lista ordenada por
lucro colocaria o dado que falta no topo.

---

## 4. As três rotas

| Rota                                       | Quando                           |
| ------------------------------------------ | -------------------------------- |
| `PATCH /admin/departures/:id/vagas`        | "fechei mais uma" — todo dia     |
| `PATCH /admin/departures/:id/availability` | a exceção: chuva, parque fechado |
| `POST /admin/departures/:id/fechar`        | depois de a saída acontecer      |

O corpo de `vagas` leva o **total**, nunca um delta: delta exige que servidor e
tela concordem sobre o valor anterior, e dois toques rápidos com rede lenta
viram quatro vagas.

`availability` passou a aceitar `null`, que devolve o selo para a conta. Era a
operação que faltava: com um campo só, não havia como dizer "esqueça o que eu
marquei" — a pessoa tinha que adivinhar qual valor recolocar.

O histórico em `DepartureAvailabilityChange` guarda o **selo**, não o valor cru
da coluna. É a pergunta que alguém faz seis meses depois, e ela não distingue se
o selo mudou porque a última vaga fechou ou porque choveu.

---

## 5. As telas

### Na lista de saídas

```
[−]  6  [+]   de 12 · faltam 6    [AUTO] Abertas Últimas Esgotado   Editar
```

O passo `+1` é o gesto do meio da conversa; o campo aceita digitar o total, para
quem está conferindo a lista no fim do dia. Otimista, com volta atrás: uma tela
dizendo "9 de 10" com o banco em 8 é pior que uma tela lenta.

Os botões da direita são a **exceção**, e só acendem quando o selo veio de uma
decisão humana. "Auto" desfaz.

Saída que já aconteceu ganha o botão **Fechar** na própria linha.

### No fechamento

Quatro campos: quantas pessoas foram, receita, custo, observações. O resultado
aparece **em tempo real**, para a pessoa conferir antes de salvar em vez de
descobrir no relatório do mês.

A receita abre com a sugestão de `preço × pessoas` e é só uma sugestão: desconto
de grupo, cortesia, meia de criança e pagamento parcial entram aqui. Se fosse
calculada, o relatório ficaria bonito e falso.

Deixar em branco é uma resposta: significa "ainda não sei".

### No painel

```
RESULTADO DO MÊS     SAÍDAS FECHADAS     OCUPAÇÃO MÉDIA     POR FECHAR
R$ 1.179,10          1                   sem dado           2
1 saída fechada      no mês corrente     ...                o relatório depende disso
```

E o alerta: **"2 saídas já aconteceram e não foram fechadas"**, com a lista.
É uma busca que precisa voltar vazia, não um botão que alguém lembra de apertar.

O bloco financeiro só aparece quando existe saída fechada: um painel mostrando
R$ 0,00 no dia 1º de todo mês não informa nada e ensina a pessoa a ignorar o
bloco.

---

## 6. Os testes que nasceram falhando

Todos verificados quebrando o código de propósito e vendo o caso acusar.

| Arquivo                  | O que trava                                       |
| ------------------------ | ------------------------------------------------- |
| `vagas.test.ts`          | limiar exato, overbooking, exceção, dado faltando |
| `auth.test.ts`           | histórico do selo, limpar exceção, fechar futura  |
| `criar-roteiro.test.ts`  | slug, rascunho, colisão com arquivado             |
| `guia-arquivado.test.ts` | guia fora da equipe some dos três caminhos        |
| `contraste.test.ts`      | o preço passa em toda superfície onde aparece     |
| `travas-do-lint.test.ts` | as regras do ESLint continuam ligadas             |
| `tempo-de-login.test.ts` | o oráculo de enumeração continua fechado          |
| `carrinho-teto.test.ts`  | a soma não estoura o teto do servidor             |

---

## 7. O que falta desta especificação

- **A agenda de calendário**, nos dois lados (item 5 do doc 13). As peças da
  Doctor Quality estão mapeadas e prontas para portar.
- **Custo fixo mensal**, se o relatório do mês for pedido de verdade. Ver a
  seção 6 do [16-modelo-de-dados.md](16-modelo-de-dados.md).
- **Ler o histórico de disponibilidade** numa tela. O dado está gravado desde o
  primeiro dia e nenhuma tela mostra.
