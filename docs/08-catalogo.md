# 08 — Catálogo Trekking

> Fase B, PROMPT 08. A parte que vende: home, agenda, detalhe do roteiro e o
> seletor de saída.

---

## A pergunta de cada página

O mesmo dado aparece em três lugares, ordenado por três perguntas diferentes.
É por isso que existem dois componentes de card e não um com `variante`.

| Página      | Pergunta                | O card lidera com  |
| ----------- | ----------------------- | ------------------ |
| `/`         | "Quando é a próxima?"   | uma data           |
| `/agenda`   | "O que tem no dia 15?"  | a data, em carimbo |
| `/trekking` | "Para onde dá para ir?" | a ficha técnica    |

A home não é vitrine de roteiros. Um grid de fotos bonitas responde à segunda
pergunta e leva a uma página que ainda vai ter que perguntar a data de novo. O
primeiro elemento clicável depois do herói já mostra um dia, um preço e uma
vaga.

---

## A agenda

### A janela começa no 1º do mês, não em "agora"

O briefing pede que a saída encerrada não suma — ela é prova social. Mas
"todas as saídas de todos os tempos" empurra as datas futuras para baixo da
dobra, e a página que existe para vender vaga passa a mostrar primeiro o que
não se pode comprar.

A janela padrão é o **mês corrente em diante**. Quem entra dia 20 continua
vendo as saídas do dia 5, do 12 e do 18 — o mês não fica pela metade, e a
prova social de quem chega no fim do mês é a mais forte que existe: "isto aqui
está rodando". O histórico completo fica atrás de `?passadas=1`, que estende a
janela em 12 meses.

### Dentro do mês, o que já passou vai para o fim

A ordem cronológica pura colocaria os cards esmaecidos no topo do mês corrente.
Cada mês é dividido em dois blocos — o que ainda vai acontecer, e depois "já
realizadas" — e a cronologia vale **dentro** de cada bloco. É a única quebra de
cronologia da página, e existe porque a primeira coisa visível tem que ser uma
data que ainda dá para comprar.

### Encerrada não some, e também não se disfarça

A tentação é `opacity: 0.5`. Só que opacidade baixa reprova em contraste — o
texto do card cairia de 19,44:1 para perto de 7:1, e os rótulos secundários
para menos de 4,5:1.

Então o esmaecimento é **dessaturação** (`grayscale`) na foto mais a trama
diagonal por cima, e o texto mantém o preto. A informação "isto já passou" está
na tarja escrita "Encerrado", que não depende de cor nem de opacidade. E o
preço sai: preço de saída que já aconteceu é oferta de algo que não se pode
comprar.

---

## Os filtros não têm um byte de JavaScript

`<form method="get" action="/agenda">`. Sem `'use client'`, sem estado, sem
efeito.

O reflexo é um componente de cliente com quatro `useState` e um `router.push`
no `onChange`. Esse caminho custa bundle, custa hidratação, e entrega uma
experiência **pior**:

- O estado do filtro vive na memória do componente, então a URL não descreve a
  tela. Mandar "olha a agenda de setembro" pelo WhatsApp manda a agenda inteira.
- O botão voltar não desfaz o filtro, porque nada foi para o histórico.
- Enquanto o bundle não chega, os `<select>` existem e não fazem nada.

Com um formulário GET, o navegador monta a query string sozinho — é para isso
que ele existe. A URL vira o estado, o histórico funciona, o link é
compartilhável, o Google indexa `/agenda?mes=2026-09`, e a página se comporta
igual antes e depois da hidratação.

Isso obrigou a duas peças novas, e as duas são o custo honesto da decisão:

| Peça                     | Por que existe                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `ui/select-nativo.tsx`   | `campo.tsx` usa `useId` e por isso é módulo de cliente. Aqui o `id` vem de quem chama — o `name` de um filtro já é único na página. |
| `ui/estilos-de-campo.ts` | Importar QUALQUER coisa de um módulo `'use client'` cria referência de cliente, inclusive uma string. As classes moram fora.        |

O botão "Aplicar" também é um `<button>` com `classesDeBotao()`, não o
componente `Button` — mesma razão, mesmo cuidado.

### Não aplica sozinho no `change`

Auto-aplicar é agradável com **um** filtro. Com quatro, quem quer "setembro +
moderado + cachoeira" recarrega a página três vezes e vê o resultado piscar
duas vezes até chegar onde queria. Um botão é um clique a mais e duas recargas
a menos.

### O filtro só oferece o que existe

`opcoesDeAgenda()` deriva os meses, as dificuldades e as tags **dos dados**.
Imprimir os próximos 12 meses e os 4 níveis produz um filtro que promete o que
não existe: escolher "Extremo" e receber "nenhuma saída" faz a pessoa concluir
que o site está quebrado, não que aquele nível não tem data marcada.

Com a seed real, o `<select>` de atividade oferece 6 das 8 tags — camping e
boia cross ficam de fora porque nenhuma saída publicada as usa.

O agrupamento por mês acontece em JS e não em SQL porque a chave é o mês em
`America/Sao_Paulo`, e `date_trunc` opera no fuso da sessão — que este projeto
força para UTC de propósito. Fazer no banco seria um `AT TIME ZONE` embutido
numa query crua, fora do alcance do Prisma e do TypeScript. Teto de 400 linhas
para a consulta não virar varredura.

---

## O fuso, outra vez

`src/lib/datetime.ts` ganhou o caminho **inverso** do resto do arquivo: de hora
de parede de São Paulo para instante UTC.

```
instanteLocal('2026-08-01T00:00:00')  →  2026-08-01T03:00:00.000Z
```

O erro que isso impede: `new Date('2026-08-01')` devolve `00:00Z`, que é 21h do
dia **31 de julho** em Mogi. Uma saída do dia 31 às 22h cairia dentro de agosto.

`intervaloDoMes` recorta do primeiro ao último milissegundo do mês, e o fim de
um mês encosta no começo do seguinte com exatamente 1 ms de diferença — sem
buraco e sem sobra. `src/test/datetime.test.ts` prova os dois, mais a virada de
ano, mais o caso "23:30 do dia 31 ainda é o mês que acaba".

As duas passadas de offset existem para o caso de o limite cair perto de uma
virada. O Brasil não tem horário de verão desde 2019, mas a lei já mudou duas
vezes e derivar custa uma chamada a mais.

---

## O seletor de saída

É o ponto de conversão, e **ele não vende**.

O site nunca processa pagamento. O botão põe a data e a quantidade numa
mochila, e a mochila vira uma mensagem de WhatsApp onde a Caqui fecha a venda
conversando (PROMPT 09). Por isso o rótulo é **"Adicionar à mochila"** e não
"Comprar" ou "Reservar agora": os dois prometem uma vaga garantida que só a
conversa confirma, e a promessa quebrada custa mais que o clique ganho.

Embaixo do botão, em mono: _"A vaga é confirmada na conversa. Nada é cobrado no
site."_

O que vai para o `localStorage` é `departureId` e quantidade. Só. Sem preço,
sem título, sem disponibilidade — mesma regra de `POST /api/cart/validate`
desde o PROMPT 03.

### Esgotado é o momento de maior intenção da página

Quem chegou até ali escolheu o roteiro, escolheu a data e clicou. Um botão
cinza escrito "Esgotado" joga fora a pessoa mais qualificada que a página vai
receber naquele dia — e desistência tem custo zero de memória: ela não volta.

Vaga cancela. Grupo pede segunda turma. O "Avise-me" transforma as duas coisas
em venda.

A caixa de consentimento nasce desmarcada e o botão não envia sem ela.
"Assinou porque não desmarcou" não é consentimento sob a LGPD. E o texto é
específico — "pode me avisar sobre **esta data**" —, porque "concordo em
receber comunicações" é consentimento para qualquer coisa, que é o mesmo que
consentimento para nada.

### Os rádios são nativos

`accent-color` pinta o rádio nativo com a cor da marca. Um rádio desenhado à
mão custaria estado de foco, de `disabled` e de teclado — o nativo já tem os
três, e o grupo dá navegação por seta de graça.

---

## A colisão que só apareceu medindo

No celular, a barra fixa de compra (`fixed inset-x-0 bottom-0`, `z-40`) e o
botão flutuante do WhatsApp (`fixed right-4 bottom-4`, `z-40`) ocupam o mesmo
canto. Com o mesmo `z-index`, vence quem vem depois no DOM — o círculo verde —
e ele cobria **exatamente** o CTA "Escolher data".

Medido: WhatsApp em 740–796, barra em 743–812. Sobreposição confirmada.

A correção: a barra marca `data-barra-de-compra` no `<html>`, e o CSS sobe o
botão 4,5 rem. Fica no CSS porque o botão do WhatsApp é componente de
**servidor**, sem estado — e não vale torná-lo cliente para ele saber de algo
que só o CSS precisa saber.

A regra é escopada em `@media (width < 64rem)`, repetindo o corte `lg` da
barra: acima disso a barra é `lg:hidden`, mas o atributo continua no `<html>`
— o observer não sabe de CSS. Sem o escopo, o botão subiria no desktop para
desviar de uma barra que não está lá.

Depois: WhatsApp em 668–724, barra em 743–812. Em 1280px, barra `display:none`
e botão sem `transform`.

### A barra some quando o seletor aparece

Uma barra sempre visível flutua por cima do próprio bloco que manda usar, e
passa a haver dois "chame a ação" idênticos na mesma tela. Um
`IntersectionObserver` no `#seletor-de-saida` resolve, e custa zero durante a
rolagem — quem avisa é o navegador.

Ela nasce **escondida** e aparece por JS. O contrário piscaria uma barra preta
na base da tela em toda visita, inclusive nas em que ela nem devia existir.

---

## Imagem: por que não é `next/image`

`next/image` existe para gerar variantes, negociar formato e reservar espaço.
As duas primeiras já estão resolvidas antes de a imagem chegar aqui: o
Cloudinary entrega `f_auto,q_auto,c_limit` na borda, escolhendo AVIF ou WebP
pelo `Accept` (docs/05-midia.md).

Passar por `/_next/image` em cima disso significaria:

1. Uma invocação de função serverless por imagem, por largura, no primeiro
   acesso — custo real na Vercel e latência real no primeiro visitante de cada
   tamanho.
2. Re-encodar um arquivo **já** otimizado. Recomprimir AVIF em WebP não
   melhora; degrada.
3. Perder o `f_auto` — o formato passaria a ser decidido pelo Next, e o CDN do
   Cloudinary viraria armazenamento burro.

O que sobra de `next/image` é `width`/`height` e `loading="lazy"`: dois
atributos nativos do HTML.

O `sizes` é **obrigatório** e não tem padrão. Sem ele o navegador assume
`100vw` e baixa a imagem de 2000px para preencher um card de 380px — o defeito
de performance mais caro e mais silencioso que existe em catálogo, porque nada
aparece quebrado, só pesado.

A regra `@next/next/no-img-element` foi desligada em **dois arquivos
nomeados** (`midia/imagem.tsx` e `catalogo/galeria.tsx`), não globalmente. Um
`<img>` solto em qualquer outro lugar continua sendo erro.

### O borrão é `background-image` da própria `<img>`

Sem elemento extra, sem estado, sem `onLoad`. O `blurDataUrl` pinta o fundo da
imagem; quando os bytes reais chegam, cobrem. Se o JavaScript não rodar,
funciona igual.

### `MidiaVazia` não é caso de borda

A Caqui vai publicar roteiro antes de ter foto, e o CRM é operado do celular no
meio da trilha. Um `<img>` com `src` vazio renderiza o ícone de imagem quebrada
— que comunica "site com defeito", não "foto ainda não subiu".

---

## O mapa só carrega depois de um clique

Um `<iframe>` de mapa incorporado dispara, no primeiro pixel da página, uma
requisição para um terceiro carregando o IP, o `Referer` (a URL exata da
expedição que a pessoa está vendo) e o `User-Agent` de toda visitante — sem
que ninguém tenha pedido mapa nenhum. É rastreamento por padrão, e é a mesma
postura que o projeto recusou no consentimento da newsletter e na captura de
lead.

Também é caro: o embed é o recurso mais pesado da página, e a maioria quer o
**endereço** para abrir no app de navegação do próprio celular.

Então a fachada mostra endereço e horário, e o mapa entra quando alguém pede. A
frase diz para onde o clique manda dado — consentimento informado só vale se
disser o que acontece.

**OpenStreetMap, não Google Maps**: o embed do Google exige chave de API, cobra
por carregamento e obriga a aceitar os termos dele em nome da visitante. Os
links "abrir no Google Maps" e "abrir no Waze" continuam ali — clicar num link
é navegação que a pessoa escolheu, não um pedido feito em nome dela.

O ponto de encontro pertence à **saída**, não ao roteiro: a mesma trilha pode
partir da portaria numa data e do centro de Mogi na outra, quando há van.

---

## A FAQ é derivada, não escrita

Não existe campo `faq` no schema, e inventar um bloco de texto fixo criaria a
pior espécie de conteúdo: o que envelhece sem ninguém perceber. Uma FAQ dizendo
"idade mínima 12 anos" enquanto o `minAge` do banco diz 14 é pior que nenhuma
FAQ.

Cada pergunta só existe quando o dado que a responde existe, e a resposta é
montada a partir dele. Trocar a idade mínima no CRM muda a FAQ no mesmo
instante, sem deploy.

As duas invariáveis — como se reserva, e o que acontece com chuva — descrevem a
**operação**, que é a mesma para todo roteiro. Se um dia deixarem de ser, viram
campo no CRM.

---

## Carrossel e galeria, sem biblioteca

**Carrossel**: `overflow-x: auto` + `scroll-snap` entrega de graça arrastar com
o dedo, arrastar com trackpad, roda horizontal, Shift+roda, Tab que traz o item
para a vista, e momentum nativo do iOS. Uma biblioteca substitui isso por
`transform` calculado à mão, quebra a rolagem por teclado e custa 15–40 KB.
O JavaScript aqui existe só para as duas setas do desktop.

Não existe avanço automático — é a violação clássica do WCAG 2.2.2, e move o
item justamente no instante em que a pessoa vai clicar. E os itens são datas de
saída.

**Galeria**: `<dialog>` nativo com `showModal()`. Lightbox é o componente que
mais some do teclado em site de turismo — abre numa div `fixed`, o foco fica na
miniatura atrás, Tab passeia pela página escondida e Escape não faz nada. O
nativo resolve os quatro. O que sobra por nossa conta é a navegação por seta.

O mosaico não é grade uniforme: doze quadrados iguais é contact sheet, não
capa. A primeira foto ocupa dois terços e a altura inteira; as duas seguintes
empilham ao lado; o resto vira fita de miniaturas.

---

## Esqueleto, nunca girador de página inteira

Um spinner centralizado comunica uma coisa só — "espere" — e apaga a página
inteira para dizê-la. O esqueleto comunica duas: "espere" e "vai chegar uma
grade de cards com foto, título e ficha aqui".

No detalhe, o esqueleto reserva o **seletor de saída**. Se desenhasse só o
texto à esquerda, a coluna da direita nasceria depois e empurraria o layout —
justamente no elemento que a pessoa está indo clicar.

A hachura é estática e o que pulsa é `opacity`, composta na GPU. O shimmer
diagonal anima `background-position`, que repinta o elemento a cada quadro —
numa grade de 9 cards, isso é repintura contínua por segundos em celular
modesto.

---

## O card inteiro é clicável, mas o link é só o título

```tsx
<Link href={…} className="rounded-xs after:absolute after:inset-0 after:content-['']">
  {saida.trip.titulo}
</Link>
```

O `::after` cobre o card; o **texto** do link continua sendo o título. Quem
navega por lista de links no leitor de tela ouve "Pedra Grande de Quatinga", e
não o card inteiro recitado — que é o que acontece quando se envolve tudo num
`<Link>`.

---

## O estado vazio são duas telas

"Nenhum resultado" com filtro aplicado é culpa do filtro, e a saída é
afrouxá-lo. Sem filtro nenhum, é a agenda que está vazia, e aí a saída é o
WhatsApp — mandar a pessoa "limpar os filtros" que ela não pôs seria zombaria.

---

## O que a API ganhou

`GET /api/departures` aceita `mes`, `dificuldade`, `tag`, `precoMin` e
`precoMax`.

A **faixa de preço filtra a saída, não o roteiro** — é a Departure que tem
preço; o mesmo roteiro custa diferente no feriado e na baixa temporada. Há um
teste que falha se alguém mover o filtro para a Trip.

`mes` é açúcar para o par `de`/`ate`, resolvido no fuso de São Paulo. Quem
manda os dois vence com o par explícito.

O `chaveMesSchema` trava forma **e** intervalo: sem o `refine`, `?mes=2026-99`
passaria pela forma, viraria `Date` inválido lá dentro e produziria 500 no
lugar de 400.

---

## Verificação

| O quê                                           | Resultado                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm run lint` · `typecheck` · `build`          | limpos                                                                                    |
| `npm run test`                                  | 131 testes                                                                                |
| Agenda com a seed real                          | 4 futuras + 1 encerrada em "Já realizadas"                                                |
| Filtro `?dificuldade=DIFICIL&preco=30000-60000` | devolve só Escalavrado, R$ 425,00                                                         |
| Adicionar à mochila                             | `localStorage` com `{lineId,tipo,departureId,quantidade}`; contador do header em "1 item" |
| Colisão WhatsApp × barra (375px)                | corrigida: 668–724 vs 743–812                                                             |
| Mesma regra em 1280px                           | barra `display:none`, botão sem `transform`                                               |

---

### O que NÃO foi verificado, e por quê

**Toda a camada de imagem rodou no caminho vazio.** O banco de desenvolvimento
tem zero `media_assets`, e o `.env` não tem credenciais de Cloudinary — então
`Galeria`, lightbox, `srcset`, `sizes` e o borrão de `blurDataUrl` nunca foram
exercitados com uma foto real. O que foi verificado é o `MidiaVazia`, que é o
estado que o site vai ter no ar até as fotos chegarem.

A causa não é técnica: **o cliente não entregou foto de expedição nenhuma.**
As 41 fotos entregues são todas produto da Caqui Wear — 15 de vestuário e
caneca, e 26 de óculos de sol que estavam classificadas como "roteiros" por
causa do nome de arquivo do WhatsApp. Ver `assets/README.md`.

Decidido em 14/08/2026, com o cliente:

| Assunto           | Decisão                                             |
| ----------------- | --------------------------------------------------- |
| Foto de expedição | Fica em branco por enquanto. O `MidiaVazia` segura. |
| Os 26 óculos      | Viram produto no PROMPT 09, categoria `ACESSORIO`.  |
| Cloudinary        | Configurar antes do deploy (PROMPT 11), não agora.  |

---

## Pendências que este prompt deixa

- **Foto de expedição** — nenhuma foi entregue. Todo roteiro renderiza o
  grafismo de montanhas até que cheguem.
- **Cadastro dos óculos** como produto `ACESSORIO`, com o problema do preço
  queimado na imagem a resolver (ver `assets/README.md`). PROMPT 09.
- **Fotos por cor da Caqui Wear** — decisão do cliente, registrada em
  `docs/relatorio-fase-a.md`. Bloqueia parte do PROMPT 09.
- **Credenciais do Cloudinary** no `.env`, antes do deploy. Sem elas o upload
  responde 503 `MEDIA_STORAGE_UNCONFIGURED` nomeando as variáveis que faltam.
- **JSON-LD** de `Event` e `Product`, `sitemap` e `robots` são o PROMPT 11.
- **`faq` como campo do CRM**, se um dia as duas perguntas invariáveis
  deixarem de ser invariáveis.
