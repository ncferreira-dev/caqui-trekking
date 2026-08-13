# 06 — Design system

> Fase B, PROMPT 06. Tokens, 12 componentes, 3 grafismos.
> Vitrine: **`/dev/styleguide`** — não existe em produção.

---

## Onde o briefing e a logo divergem

O briefing descreve a marca por escrito. Antes de desenhar qualquer coisa, fui
atrás do ativo real — e ele está no repositório: a logo aparece como marca
d'água nas fotos de produto que a Caqui entregou
(`assets/_originais/IMG-20241102-WA0057.jpg`).

Três divergências, todas resolvidas a favor da logo:

| Briefing escrito                     | Logo real                                                | O que fiz                                                                                                                      |
| ------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| "tipografia pesada e **condensada**" | wordmark pesadíssimo e **largo**, terminais arredondados | **Archivo Black** (está na lista do cliente, e é o único de largura normal). Anton ou Bebas ao lado da logo brigariam com ela. |
| "montanhas em **preto sólido**"      | desenho de **linha com hachura**, tipo xilogravura       | os grafismos são gravura, não silhueta chapada                                                                                 |
| — (não menciona)                     | tudo dentro de um **brasão hexagonal**                   | o hexágono virou a geometria que organiza o sistema                                                                            |

O hexágono foi o achado mais útil. Ele dá ao sistema uma forma própria que não
precisou ser inventada: o selo de dificuldade **é** um hexágono, e o canto
cortado do card é a menor citação possível dele.

> ⚠️ O `Brasao` em `src/components/marca/grafismos.tsx` é uma **reconstrução**
> feita a partir da marca d'água — é o que existe hoje. Peça o arquivo vetorial
> original à Caqui e substitua; as letras da logo real são desenho próprio, e a
> diferença aparece em tamanho grande.

---

## A decisão que reorganizou tudo: contraste medido antes de desenhar

Calculei as razões WCAG de toda a paleta fixa antes da primeira linha de CSS.
O resultado mudou o componente mais importante do site.

**Branco sobre `#F26522` dá 3,15:1.** O AA exige 4,5:1 para texto normal. Ou
seja: o botão laranja com rótulo branco — o reflexo automático de qualquer um —
seria o elemento mais importante da página, ilegível para quem tem baixa visão.

**Preto sobre o mesmo laranja dá 6,16:1.** Passa com folga. E é exatamente como
se serigrafa fita de equipamento outdoor — e é a própria logo, onde a serra
preta se recorta contra o sol laranja.

Quando a restrição de acessibilidade e a identidade apontam para a mesma
resposta, não há o que discutir.

### A tabela que governa o uso da cor

Liberadas:

| Frente      | Fundo          | Razão      |        |
| ----------- | -------------- | ---------- | ------ |
| ink-900     | branco         | 19,44:1    | AAA    |
| ink-700     | branco         | 14,16:1    | AAA    |
| ink-900     | forest-300     | 11,51:1    | AAA    |
| forest-800  | branco         | 11,08:1    | AAA    |
| forest-600  | branco         | 6,39:1     | AA     |
| danger      | branco         | 6,22:1     | AA     |
| **ink-900** | **orange-500** | **6,16:1** | **AA** |

Proibidas — e o número que as reprova:

| Frente     | Fundo      | Razão  | Por quê                                  |
| ---------- | ---------- | ------ | ---------------------------------------- |
| branco     | orange-500 | 3,15:1 | o erro mais comum                        |
| orange-500 | branco     | 3,15:1 | só ≥24px, onde o mínimo cai para 3:1     |
| orange-500 | sand-100   | 2,80:1 | nem grande. Laranja não encosta em areia |
| orange-400 | branco     | 2,34:1 | decorativo, só dentro de gradiente       |
| forest-300 | branco     | 1,69:1 | preenchimento, nunca texto nem filete    |
| sand-100   | branco     | 1,13:1 | não delimita nada sozinho                |

### A regra é imposta pelo ESLint, não pela documentação

`text-caqui-orange-*` em `className` é **erro de lint**. Documentar não
bastaria: escrever `text-caqui-orange-500` é a coisa mais natural do mundo, e o
defeito é invisível para quem enxerga bem.

A regra já pagou o custo dela: pegou **duas violações minhas** durante a
construção — o contador da aba ativa e o hover do título do acordeão. Mesma
disciplina do `no-restricted-properties` contra `toFixed`, do PROMPT 01.

A única exceção sancionada é o preço, e ela vive no utilitário `.preco`, que
**trava o `font-size` em 28px** — porque acima de 24px o mínimo cai para 3:1 e
a combinação passa. Deixar o tamanho a cargo de quem usa quebraria a regra em
silêncio no dia em que alguém aplicasse a classe num texto pequeno.

---

## O que faz este sistema não parecer template

Três coisas, e nenhuma delas é enfeite.

### 1. Profundidade é deslocamento sólido, não sombra difusa

`--shadow-corte-1/2/3` são sombras pretas de blur zero. Sombra difusa é o
sotaque de SaaS; deslocamento sólido é impressão fora de registro.

No card, a camada de baixo é um **elemento de verdade**, não um `box-shadow` —
porque `clip-path` recorta a sombra junto, e um card chanfrado com
`box-shadow` simplesmente não teria sombra. A restrição técnica e a linguagem
visual concordam.

### 2. O canto cortado, vindo do hexágono

Um retângulo com filete de 1px, sombra dura e display condensada é o template
neobrutalista de 2022 — o segundo visual mais genérico depois do azul de SaaS.
O que salva é a **silhueta**: o chanfro faz a peça parecer etiqueta recortada
em vez de caixa, e ele não foi inventado — é o hexágono do brasão.

### 3. Não existe raio de pílula

Nenhum `border-radius: 9999px` no projeto. O chip de status arredondado é a
assinatura visual do template de SaaS, e a ausência do token é o que impede
ele de voltar por distração.

---

## Os dois selos têm formas diferentes de propósito

Dificuldade e disponibilidade aparecem lado a lado no mesmo card. Se fossem
dois retângulos iguais mudando de cor, o olho teria que ler os dois para saber
qual é qual — e quem não distingue verde de vermelho não saberia nunca.

- **Dificuldade** — hexágono, com medidor de 4 traços preenchidos.
- **Disponibilidade** — flâmula com entalhe, com glifo.

**A cor não carrega a informação; ela reforça.** A rampa que o briefing pede
(verde → vermelho) não é monotônica em luminância: forest-600 dá 0,114 e danger
dá 0,119 — 4% de diferença, indistinguíveis para quem tem protanopia. Cada nível
carrega três sinais independentes: contagem de traços, rótulo escrito e cor.
O styleguide tem um painel em escala de cinza provando que funciona sem cor.

Os glifos são **SVG, não Unicode**: `◐` e `✕` faltam em muitas fontes, e o
navegador troca de família no meio da string, quebrando alinhamento e
espacejamento.

### O estado se propaga pelo componente inteiro

No card esgotado: a foto ganha trama diagonal, o preço perde o laranja, e o
botão vira secundário com outro texto — **"Lista de espera"**, nunca
`disabled`. Botão desabilitado sai do fluxo de teclado e some para leitor de
tela; e, no negócio da Caqui, a conversa é o produto.

---

## Onde escolhi o nativo, e por quê

| Componente    | Implementação              | Motivo                                                                                                                                                                         |
| ------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Modal, Drawer | `<dialog>` + `showModal()` | armadilha de foco, Escape, camada superior e `inert` no resto do documento saem de graça — ~200 linhas e a origem clássica de bug de acessibilidade                            |
| Acordeão      | `<details>` / `<summary>`  | zero JavaScript, e o **Ctrl+F do navegador abre a seção fechada** para mostrar o resultado. Numa página de expedição isso é a diferença entre o conteúdo existir e não existir |
| Select        | `<select>` nativo          | um listbox à mão custa ~250 linhas em troca de controlar a lista aberta — que iOS e Android substituem por um seletor nativo de qualquer jeito. E o CRM é operado do celular   |
| Abas          | ARIA à mão                 | não há equivalente nativo. Roving tabindex, setas, Home/End                                                                                                                    |

O que o `<dialog>` **não** cobre e está implementado à mão: devolver o foco ao
gatilho, travar a rolagem do corpo (compensando a barra, para o conteúdo não
pular) e fechar no clique fora.

---

## Um bug que só apareceu medindo

O anel de foco é duplo — branco por dentro, preto por fora — para contrastar
contra qualquer superfície da paleta. Um anel preto único desapareceria sobre
`forest-800` (1,75:1) ou sobre o badge "Extremo".

Só que a regra vive na camada `base`, e as utilitárias `shadow-*` do Tailwind
têm precedência maior. **Em todo componente com sombra própria — Button, Card —
o anel branco era silenciosamente substituído pela sombra.** Em fundo claro
ninguém notaria; em fundo escuro, o foco sumiria.

Achado inspecionando a `box-shadow` computada do botão em foco, não lendo o
código. A correção usa a utilitária `ring`, que ocupa um **slot próprio** na
`box-shadow` e compõe com a sombra em vez de brigar com ela — verificado no
navegador: anel branco, sombra sólida e outline coexistindo no botão vermelho.

---

## Grafismos: parcimônia é regra, não conselho

- **Curva de nível** — no máximo 2× por página, nunca em seções vizinhas.
- **Serra** — 1× por página, sempre no herói.
- Nenhum dos dois como `background-image` repetido. Repetir a silhueta
  transforma o elemento da marca em papel de parede.
- Todos são `aria-hidden`.

**A cota fica FORA do SVG**, como elemento HTML posicionado. Texto dentro de um
SVG esticado deforma junto: com `preserveAspectRatio="none"`, um viewBox de
1440 renderizado em 390px comprime o eixo X a 27% e mantém o Y em 100% — a cota
apareceria esmagada e a curva viraria zigue-zague, justamente no celular, que é
onde está o tráfego. Os divisores usam `slice`, que preserva a proporção e
corta o excesso.

Fora, a cota ainda é selecionável, traduzível e encontrável pelo Ctrl+F.

---

## Tipografia

| Papel   | Família           | Trabalho                                                                    |
| ------- | ----------------- | --------------------------------------------------------------------------- |
| Display | **Archivo Black** | títulos, e o numeral do preço                                               |
| Corpo   | **DM Sans**       | texto corrido. Geométrica de terminais macios, ecoando o "trekking" da logo |
| Dados   | **DM Mono**       | distância, cota, duração, data, Cadastur                                    |

O `tabular-nums` está no `body`, no site inteiro. É o que faz as colunas de km
e metros **alinharem entre cards diferentes da mesma lista**, sem tabela — e é
o que faz uma grade de expedições parecer carta topográfica em vez de feed.

DM Mono tem zero cortado por desenho. Foi mantido de propósito: é a convenção
de engenharia para desambiguar `0` de `O`, e casa com o registro de legenda de
mapa. Trocar a família é uma linha, se incomodar.

As três entram por `next/font`, com self-hosting e `size-adjust` calculado —
nenhuma requisição ao Google em runtime e nenhum salto de layout.

---

## Movimento

Nada acima de 240ms. Sob `prefers-reduced-motion`, a redução é **escopada**, e
não o bloco nuclear `*{transition-duration:0.01ms!important}` — com
`!important` ele mataria também as transições que devem sobreviver com duração
zero e impediria qualquer alternativa em fade.

Duas escolhas que economizam quadro:

- **Esqueleto**: hachura estática que pulsa em `opacity` (composta pela GPU),
  não shimmer que anima `background-position` (repintura a cada frame, numa
  grade de 9 cards). Sob movimento reduzido o pulso para — e aí um
  `role="status"` invisível avisa que está carregando, porque um bloco cinza
  parado é indistinguível de conteúdo quebrado.
- **Acordeão**: a altura **não** é animada. `height` e `grid-template-rows`
  forçam recálculo de layout a cada frame. O que se move é o indicador.

---

## Como este sistema foi escolhido

Três direções visuais independentes foram geradas a partir do mesmo briefing —
carta topográfica, etiqueta de equipamento e cartaz de parque nacional — e cada
uma foi avaliada por três lentes separadas: fidelidade à marca, viabilidade e
acessibilidade, e originalidade.

| Direção                     | Marca | Viabilidade | Originalidade |  Média  |
| --------------------------- | :---: | :---------: | :-----------: | :-----: |
| **Etiqueta de equipamento** |  8,0  |     8,5     |      8,0      | **8,2** |
| Carta topográfica           |  6,0  |     7,5     |      9,0      |   7,5   |
| Cartaz de parque            |   —   |      —      |       —       | falhou  |

O que está construído é a **etiqueta** como base, com três enxertos da carta
topográfica: a curva de nível como divisor, a camada de dados em mono tabular,
e a proibição do raio de pílula. A carta perdeu em fidelidade à marca porque
redesenhava o sol como anéis concêntricos — a logo real tem um disco sólido, e
descaracterizar o elemento mais reconhecível da marca custa mais do que ganha.

A crítica mais dura ao vencedor foi que a metáfora da etiqueta "nunca virava
geometria — era aplicada como pele sobre um esqueleto convencional". Ela está
respondida no chanfro: a silhueta do card mudou, não só o acabamento.

---

## O que vem no PROMPT 07

O header usa o `Brasao`, e é nele que entra o gesto dos 5 toques. Reforçando o
que já vale desde o PROMPT 04: **o gesto só revela a rota**. A proteção real é
o middleware do backend, e há um teste que percorre o diretório e falha se
alguma rota admin nascer sem guard.
