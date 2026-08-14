# 09 — Caqui Wear, carrinho e handoff pro WhatsApp

> Fase B, PROMPT 09. A loja da marca e o fluxo de finalização. É aqui que o
> projeto se resolve.

---

## O handoff, primeiro

Tudo neste prompt existe para produzir uma mensagem de texto. O site não cobra,
não emite pedido, não fala com gateway — ele monta uma conversa.

```
Olá! Vim pelo site 🌄

*MEU PEDIDO*

🥾 Pedra Grande de Quatinga
📅 sábado, 15 de agosto, 06:00
👤 2 vagas
R$ 180,00

👕 Óculos Wayfarer Caqui
Preto · 1 un
R$ 59,90

*Total: R$ 239,90*
```

### O template vem do CRM, por interpolação

`whatsappMessageTemplate` é um campo do banco. `montarMensagem` conhece dois
marcadores — `{{itens}}` e `{{total}}` — e nada mais. A Caqui pode reescrever a
saudação, tirar os emoji ou trocar "pedido" por "reserva" sem deploy.

Se alguém apagar `{{itens}}` editando no CRM, a lista é anexada ao fim em vez de
sumir: uma mensagem com saudação e total, sem itens, faria a Caqui receber
"Olá! Total: R$ 239,90" sem saber do quê.

### `split`/`join`, nunca `replace`

`String.replace` interpreta `$&`, `$1` e `$'` no texto de substituição como
padrões. O nome de um produto pode conter `$` — é literalmente o símbolo de
dinheiro — e pedaços da mensagem sumiriam em silêncio. Há teste.

### O espaço de "R$ 59,90" não é um espaço

`Intl.NumberFormat('pt-BR')` separa o símbolo do valor com **U+00A0**, o espaço
não-quebrável. É o que impede o WhatsApp de quebrar a linha entre "R$" e o
número. Ele vira `%C2%A0` na URL e volta idêntico.

Isso apareceu quando os primeiros testes falharam comparando com um espaço
comum — e a lição é a de sempre: assertar contra o formatador, não contra uma
string que a gente acha que ele produz.

### O que NÃO pode entrar na mensagem

Item esgotado, data que já passou, variante fora de linha. A interface avisa
antes; `itensQueVaoNaMensagem` é a última rede. E o total soma os subtotais que
estão impressos na mensagem, não `totalCentavos` — uma mensagem cujas linhas não
somam o próprio total é o pior erro possível aqui.

---

## O PLANO B não é polimento

No desktop, sem WhatsApp Web logado, `wa.me` abre uma aba que fica em branco ou
numa tela de instalação. A pessoa que passou por agenda, seletor de data e
mochila desiste ali — achando que o site quebrou. E ninguém descobre por quê:
não há erro, não há log, não há requisição falhando. A conversão evapora.

Por isso:

| Ambiente | Botão                                                 | E também                  |
| -------- | ----------------------------------------------------- | ------------------------- |
| Toque    | "Finalizar pedido no WhatsApp" → `wa.me` (abre o app) | mensagem na tela + copiar |
| Ponteiro | "Abrir no WhatsApp Web" → `web.whatsapp.com/send`     | mensagem na tela + copiar |

Nos dois casos **a mensagem montada aparece na tela** e **o número aparece em
texto legível**. Mesmo que tudo falhe, existe um caminho manual óbvio: copiar,
abrir o WhatsApp, colar. E se a cópia automática for bloqueada — `navigator.
clipboard` exige contexto seguro — o `<pre>` tem `select-all`: um clique
seleciona tudo.

### A detecção é de capacidade, não de user-agent

`matchMedia('(pointer: coarse)')` pergunta ao navegador se o ponteiro primário
é um dedo. Um Windows com tela sensível ao toque e um iPad com teclado respondem
pelo que **são**. Sniffing de `navigator.userAgent` erra nos dois.

Lido por `useSyncExternalStore`, então não há efeito sincronizando estado, e o
HTML do servidor sai com o plano B visível.

### O botão é um `<a href>`, e isso restringe o resto

Um `onClick` que faz `await revalidar()` e só então chama `window.open` perde o
gesto do usuário no `await` — o navegador trata a abertura como pop-up e
bloqueia. Com link de verdade, a navegação é do usuário, funciona no clique do
meio, e o destino aparece na barra de status.

O preço é que o link reflete a **última validação**. Daí `useValidacao`
revalidar quando a aba volta a ficar visível: voltar para a aba é exatamente o
momento em que a pessoa vai finalizar.

---

## O carrinho

### A revalidação não é conferência — é o que preenche a tela

O `localStorage` guarda `id` e `quantidade`. **Só.** Nome, data, tamanho, cor e
preço de cada linha vêm de `POST /api/cart/validate` no momento em que a mochila
abre. Não existe um carrinho desenhado que depois é conferido: sem a chamada não
há o que desenhar.

É a mesma regra do PROMPT 03, e o motivo continua sendo o projeto de referência:
lá `price` e `subtotal` eram congelados no localStorage e iam direto para a
mensagem. Como o localStorage é editável, `setItem('cart', …)` com preço 1,00
gerava uma mensagem oficial do site dizendo "colar = R$ 1,00" — e a atendente,
reconhecendo o formato, tendia a acreditar.

### Um estado só, carimbado com a pergunta que ele responde

O reflexo é `useState` para resultado, outro para `carregando`, outro para
`erro`, e um efeito zerando os três. O React Compiler recusa — `setState`
síncrono no corpo de um efeito — e a recusa expôs o defeito real: três estados
para uma informação só.

Existe **um** estado, e ele carrega a chave da pergunta que respondeu.
"Carregando?" virou uma comparação em vez de um booleano que alguém precisa
lembrar de virar. É impossível ficar preso em "carregando" para sempre, e
impossível mostrar o resultado de um carrinho antigo.

### Drawer e página são o mesmo componente

`ConteudoDaMochila` serve os dois. Duplicar significaria manter duas versões da
revalidação, do agrupamento e do handoff — e a segunda sempre fica para trás.

O drawer existe para não tirar a pessoa da página da expedição depois de
adicionar uma vaga. A página existe porque tem URL: dá para recarregar,
compartilhar e chegar de fora.

O botão do header **continua sendo um `<Link href="/carrinho">`** com o clique
interceptado. Sem JavaScript, com o bundle a caminho, ou no clique do meio, ele
leva à página de verdade. Um `<button>` puro seria um ícone morto nos três
casos — e a mochila é o fim do funil.

### "Suas experiências" e "Caqui Wear" são coisas diferentes

Uma vaga tem DATA e é perecível. Uma camiseta tem tamanho e cor e fica. Na mesma
coluna, a data vira mais um detalhe de linha — quando ela é o dado que decide se
o pedido ainda vale.

### O enum não fala português

`Tam UNICO · Preto` saía na linha da mochila **e na mensagem do WhatsApp**.
Achado verificando o fluxo no navegador. Pior no catálogo de óculos, que é todo
de tamanho único: a informação inteira daquela linha era vocabulário interno do
banco entregue ao cliente.

Com tamanho único, a cor sozinha identifica a variante. Com grade de verdade, os
dois aparecem. Há teste que falha se `UNICO` reaparecer em qualquer resposta.

---

## A Caqui Wear

### A submarca é SUPERFÍCIE e ACENTO, não outra paleta

O briefing pede "mesma família, identidade própria — puxe mais pro verde e
off-white, laranja só nos CTAs. Sensação de trocar de seção, não de empresa".

O que muda: o fundo vira areia, e o acento vira o verde da mata no rótulo, no
filete e no filtro ativo. O que **não** muda: preto do texto, tipografia,
chanfro do card, laranja do botão.

E o que deliberadamente não foi feito: redefinir `--color-caqui-*` dentro de um
escopo. Um token que muda de valor conforme o ancestral faz o design system
mentir — `text-caqui-ink-900` passaria a significar duas coisas, e a tabela de
contraste do `globals.css` deixaria de valer.

Medido sobre `sand-100`:

| Combinação                | Contraste | Uso                                    |
| ------------------------- | --------: | -------------------------------------- |
| `ink-900`                 |   17,26:1 | corpo e título — a família é a mesma   |
| `forest-800`              |    9,84:1 | rótulo, sobretítulo, filete            |
| `forest-600`              |    5,68:1 | estado e selo                          |
| `ink-500`                 |    4,73:1 | passa raspando; abaixo disso não desce |
| branco sobre `forest-800` |   11,08:1 | filtro ativo                           |

### A troca de imagem no hover é CSS

As duas fotos estão no DOM, empilhadas, e `group-hover` troca a opacidade. Sem
`useState`, sem `onMouseEnter` — o card continua sendo componente de servidor.

Trocar o `src` no `mouseenter` tem um defeito que só aparece em rede lenta: a
segunda imagem começa a baixar quando o ponteiro chega, e aparece depois de ele
já ter saído.

Como no celular não há hover, a segunda foto não pode carregar informação
nenhuma: é o mesmo produto de outro ângulo, nunca outra cor.

### O zoom é `background-position`, não lightbox

Roupa se compra olhando a textura da malha. Um lightbox exige abrir, olhar,
fechar — três ações para uma pergunta de um segundo. Aqui o ponteiro sobre a
foto move uma cópia ampliada atrás dela.

No celular não existe: sem ponteiro, o zoom por toque roubaria o gesto de rolar
a página na maior área da tela — e o celular já tem pinça, que funciona melhor.

### Combinação indisponível não some

Requisito escrito do briefing, e o motivo é comercial antes de ser de
acessibilidade: some com o "G" e a pessoa conclui que a peça não é feita no
tamanho dela e vai embora. Deixe o "G" riscado e ela entende que existe e
acabou.

Três sinais independentes: `disabled` nativo (que o leitor de tela anuncia),
trama diagonal (que não depende de cor), e texto para leitor de tela.

**A grade é cruzada**, e é isso que complica: "Preto" existe em P, M e G;
"Cinza Chumbo" só em P e M. Aqui a COR manda — escolher uma cor mantém todos os
tamanhos visíveis e marca como indisponíveis os que aquela cor não tem. Nada
some, nada mente. Se o tamanho atual não existir na cor nova, o seletor pula
para o primeiro que existe, em vez de deixar a pessoa parada numa combinação
impossível.

### O filtro de categoria são links, e a agenda tem formulário

Não é incoerência. A agenda tem quatro filtros que se combinam, e ali um botão
"Aplicar" evita três recargas para uma escolha. Aqui é **um** filtro, com cinco
opções no máximo, mutuamente exclusivo: cada opção é um destino, e destino é
link.

O ganho: `/wear?categoria=CAMISETA` fica no histórico, é compartilhável e
indexável, e a escolha atual é visível de relance em vez de escondida numa caixa
fechada. Zero JavaScript nos dois casos.

---

## Os óculos entraram no catálogo

Os 10 modelos levantados em `docs/09-oculos.md` foram cadastrados: **13 produtos
e 32 variantes** na seed, contra 3 e 15 antes.

O preço acompanha o material da haste — acetato R$ 59,90, madeira R$ 71,90,
espelhado R$ 89,90 — e formato virou produto, cor virou variante.

---

## Dívidas registradas

### A tabela de medidas é de referência, não medida

A Caqui não passou a medição das peças reais. Os valores são padrão de malha dry
fit brasileira, e a tela diz "aproximado" com todas as letras. Quando as medidas
reais chegarem, viram campo no CRM — hoje não existem no schema.

Ela mede a **peça estendida**, não o corpo: "busto 96 cm" é ambíguo, e comparar
com uma camiseta que a pessoa já tem é o método mais confiável para comprar
roupa sem provar. Numa loja com checkout, tamanho errado vira frete de troca;
aqui vira uma conversa constrangida com alguém que já pagou por Pix.

### Composição e cuidados são derivados da categoria

Não existe campo `composicao` no schema. Um texto fixo por produto envelheceria
sem ninguém perceber — "100% poliéster" numa peça que virou poliamida é
informação errada com cara de informação certa. Mesma decisão da FAQ da
expedição.

### Continua em aberto

- **Foto por cor** — a galeria é do PRODUTO, não da variante. Num produto de 4
  cores, quem escolhe "Preto" continua vendo a foto do marrom ao lado. É a
  decisão do `relatorio-fase-a.md`, e os óculos a tornam mais visível porque ali
  a cor É o produto.
- **Preço queimado nas fotos dos óculos** — aceito em 14/08/2026 com o risco
  assumido. Ver `assets/README.md`.
- **Nenhuma foto de expedição** — todo roteiro segue com o grafismo de
  montanhas.

---

## Verificação

| O quê                            | Resultado                                                  |
| -------------------------------- | ---------------------------------------------------------- |
| `lint` · `typecheck` · `build`   | limpos                                                     |
| `npm run test`                   | 149 testes                                                 |
| Adicionar peça na `/wear/[slug]` | `localStorage` com `{lineId, tipo, variantId, quantidade}` |
| Mochila com os dois tipos        | agrupada, total R$ 239,90 vindo do servidor                |
| Mensagem montada                 | formato do briefing, sem `UNICO` vazando                   |
| Desktop                          | "Abrir no WhatsApp Web" → `web.whatsapp.com/send`          |
| Mobile (`pointer: coarse`)       | "Finalizar pedido no WhatsApp" → `wa.me`, copiar mantido   |
| Drawer pelo ícone do header      | abre, agrupa, finaliza                                     |
