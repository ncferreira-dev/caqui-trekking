# 18 · A agenda de calendário, nos dois lados (18/08/2026)

> **Status: implementado.** Fecha o item 5 de
> [13-vagas-agenda-e-resultado.md](13-vagas-agenda-e-resultado.md), o único que
> tinha ficado de fora quando as vagas e o fechamento entraram.

## O pedido, na fala do cliente

> "Uma espécie de agenda, tanto no CRM quanto no site do painel do cliente em
> si. Pela agenda também dá para a parte do cliente selecionar qual dia faz
> sentido pra ele, ou então ao apertar num dia que não tem nenhum evento, ele
> pode já mandar mensagem salva, já com aquele dia. Ou então para quem é do
> CRM, consegue apertar na agenda no calendário e marcar. Através de lá, quando
> não tiver um evento, aperta lá e põe assim, criar evento."

São duas telas com a mesma geometria e propósitos opostos. Vale escrever a
diferença, porque ela decidiu quase todo o resto:

|                       | Site                                  | CRM                                     |
| --------------------- | ------------------------------------- | --------------------------------------- |
| Pergunta que responde | "eu posso no dia 12, tem algo?"       | "que dias do mês estão livres?"         |
| Dia COM saída         | leva à linha da lista logo abaixo     | abre aquela saída para editar           |
| Dia SEM saída         | abre o WhatsApp com a data preenchida | abre "nova saída" com a data preenchida |
| Dia no passado        | inerte                                | continua clicável                       |
| Vista padrão          | lista                                 | lista                                   |

## A peça comum: `src/lib/calendario.ts`

Função pura, sem framework, sem banco, sem navegador. É o mecanismo 5 da
doutrina, e aqui ele paga rápido: as duas telas desenham a MESMA grade, e uma
divergência entre elas seria invisível até alguém comparar as duas lado a lado.

O arquivo faz duas aritméticas que parecem a mesma e não são, e confundi-las é
o defeito caro deste projeto:

1. **A grade** (`diasDaGradeDoMes`) é calendário civil. "Que dia da semana cai
   1º de agosto de 2026" tem a mesma resposta em Mogi, em Lisboa e em Auckland.
   Fuso não entra: a conta é aritmética de inteiros em UTC, sem `Intl` e sem
   `new Date(ano, mes, dia)` — esse último usa o fuso da MÁQUINA e devolveria o
   dia 31 do mês anterior em qualquer servidor a leste de Greenwich.
2. **A posição de um instante na grade** (`chaveDia`) é fuso puro. Uma saída
   gravada como `2026-08-16T02:00:00Z` acontece no dia 15 em Mogi, e é na
   célula do dia 15 que ela precisa aparecer. Aqui `Intl` com `timeZone`
   explícito é obrigatório.

Coberto por `src/test/calendario.test.ts` (20 casos). Três deles foram
verificados por mutação: zerar o recuo do domingo derruba 4 casos, trocar o
fuso de `chaveDia` derruba 2, mudar a grade para 35 células derruba 1.

### Por que 42 células sempre

Um mês ocupa 4, 5 ou 6 semanas conforme o dia em que começa. Gerando só as
semanas necessárias, a grade muda de altura ao trocar de mês e tudo o que está
abaixo pula. Seis semanas fixas custam alguns dias apagados do mês vizinho e
compram uma página que não se move.

## O site: `?vista=calendario`

A lista continua sendo o padrão, e o calendário entra ao lado dela, não no
lugar. São perguntas diferentes: a lista responde "qual é a próxima", que é o
que alguém sem data na cabeça quer saber; o calendário responde "eu posso no
dia 12".

A vista vive na URL, então o link é compartilhável, o botão voltar desfaz, e a
página se comporta igual antes e depois da hidratação. `linkDaAgenda()` monta
todo link preservando os filtros aplicados: o seletor de vista, as setas de mês
e o rodapé usam o mesmo helper, e o primeiro esquecimento de um parâmetro
descartaria em silêncio um filtro que a pessoa está vendo na tela.

### O dia vazio é o recurso, não o buraco

Num calendário comum, 25 das 31 células são vazio morto e a página parece uma
agenda deserta. Aqui cada célula vazia é uma oferta: a Caqui monta trilha
fechada em qualquer data, e esta é a única tela do site onde esse fato aparece
no lugar exato em que a pessoa está pensando na data.

`mensagemDeDiaLivre()` monta o texto, com a mesma estrutura de formulário de
`/guia-particular`: dia, quantas pessoas, trilha ou região. A diferença entre
receber "tem no dia 15?" e receber os três é a diferença entre dez mensagens e
um orçamento.

**Dia que já passou não recebe o link.** Convidar alguém a pedir saída para a
semana retrasada é a definição de formulário que não olhou o dado.

### Duas armadilhas que o desenho evita

- **Um link por célula, nunca um dentro do outro.** A tentação é a célula
  clicável com um link por saída dentro. Link dentro de link é HTML inválido, e
  o navegador "conserta" desmontando a árvore. Aqui a célula inteira é UM link,
  e os títulos dentro dela são texto. Ganha de quebra o alvo de toque: a célula
  toda, e não um chip de 12px.
- **O `+` do dia livre fica sempre visível.** A primeira versão escondia o
  convite atrás do `hover`, o que apagava o recurso justamente no celular, onde
  não existe hover e onde está a maior parte de quem visita a agenda. A palavra
  escrita continua sendo comportamento de ponteiro; o sinal de que a célula faz
  alguma coisa, não.

### A âncora

Cada célula com saída aponta para `#dia-2026-08-15`, e o `id` vai na PRIMEIRA
saída daquele dia. Duas saídas do mesmo dia com o mesmo `id` seria documento
inválido, e o navegador saltaria para a primeira que encontrasse, que pode não
ser a de cima. O alvo tem `scroll-mt-32` porque o cabeçalho do mês é
`sticky top-20`: sem a margem, o salto para o dia 15 para com a linha atrás do
cabeçalho e a pessoa vê o dia 16.

## O CRM: `?vista=calendario`

A lista continua sendo onde se OPERA. O argumento original desta tela continua
válido e está no cabeçalho de `saidas/page.tsx`: numa célula não cabem os três
botões de 44px que a lista oferece em um toque. O que mudou foi o pedido, e ele
é outra tarefa: marcar data nova é a única coisa que se faz olhando para os
BURACOS do mês, e buraco é o que uma lista não sabe mostrar.

### O botão de criar fica ATRÁS das saídas, como irmão delas

A célula precisa ser clicável e conter saídas clicáveis. `<button>` dentro de
`<button>` é HTML inválido; o navegador desmonta a árvore e o clique na saída
passa a criar uma saída nova por cima dela.

A solução: o botão de criar é uma camada absoluta cobrindo a célula; o conteúdo
por cima dele é `pointer-events-none`, e só os chips de saída reativam o
ponteiro. Clicar em qualquer lugar vazio cria, clicar num chip abre aquela
saída, e nenhum elemento está dentro do outro.

### O que o chip diz sem ser lido

Cor do estado (abertas / últimas / esgotado), borda tracejada para rascunho,
riscado para cancelada, e **tarja vermelha à esquerda para saída que já
aconteceu e não foi fechada** — a mesma fila "POR FECHAR" do painel, vista no
dia dela. O `aria-label` diz tudo isso por escrito: cor sozinha não conta nada
para quem não a distingue.

### "Hoje" vem do servidor

`chaveDia(agora)` é calculado no Server Component e passado como prop. Calcular
no cliente faria o dia marcado divergir entre o HTML e a hidratação para quem
opera de outro fuso.

## O que a construção encontrou pelo caminho

Ligar o calendário do CRM esbarrou num defeito que estava ali desde sempre:

**`POST /api/admin/departures` recusava toda criação com os campos opcionais em
branco.** O formulário manda `meetingPoint: ponto.trim() || null`, e o schema
declarava `z.string().optional()` — ausente OU string, nunca `null`. Com
`.strict()`, o resultado era 400 em toda saída criada sem ponto de encontro e
sem horário de encontro, ou seja, na operação normal. O PATCH da mesma entidade
já estava correto, o que mostra que foi esquecimento.

Três consertos saíram daí:

1. O `.nullable()` que faltava, com varredura em todos os schemas de escrita da
   API: era o único caso restante da classe.
2. **A mensagem de erro do painel passou a nomear o campo.** A API sempre
   devolveu `details: [{ field, message }]`, e o cliente do CRM descartava.
   Toda recusa chegava como "Dados inválidos." — foi isso que manteve o defeito
   escondido. Agora qualquer divergência futura entre formulário e schema se
   anuncia sozinha, na tela de quem está tentando salvar.
   (`mensagemDeErro`, em `lib/crm/api.ts`, coberta por `erro-do-crm.test.ts`.)
3. O preço sugerido do roteiro passou a preencher o campo no ESTADO INICIAL, e
   não só ao trocar o seletor. O seletor já abre com o primeiro roteiro
   escolhido, e ninguém "muda" para o valor que já está lá: o campo abria vazio
   e o formulário recusava com "Preço inválido".
