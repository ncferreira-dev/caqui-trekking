# 07 — Shell, navegação e botão fantasma

> Fase B, PROMPT 07. Header, rodapé, movimento e as 12 rotas do site.

---

## O botão fantasma

**5 toques na logo revelam um link para `/crm`.** Nada além disso.

Digitar `/crm` na barra de endereço leva ao mesmo lugar — e é assim que tem que
ser. A barreira real é o guard do backend, rota a rota, com um teste que
percorre o diretório e falha se alguma rota administrativa nascer sem ele.

### A armadilha: a logo é um link

Se cada toque navegasse, o componente desmontaria no primeiro e a contagem
morreria junto. De `/agenda`, seria impossível chegar a 5. Duas medidas:

1. **A contagem vive no `sessionStorage`**, não em memória — sobrevive à
   navegação do primeiro toque.
2. **Do 2º toque em diante a navegação é cancelada.** O primeiro faz o que
   qualquer pessoa espera de uma logo: vai para a home. Os seguintes são
   engolidos, e a página não pisca.

O toque é contado no `pointerdown`, que dispara **antes** da navegação.

### A janela é de ociosidade

O briefing pede "5 toques em até 3 segundos" e "contador zera após 3s parado".
Implementei a segunda: o que zera é a **pausa** entre toques. Cinco toques
rápidos levam menos de um segundo de qualquer jeito, então a regra mais
permissiva satisfaz as duas — e o briefing é explícito sobre o gesto não ser
frustrante de acertar.

### O feedback do 3º toque tem duas formas, não uma

O pulso é `transform: scale(1.03)` — 3%, deliberadamente pequeno. Mas sob
`prefers-reduced-motion` ele não roda, e aí o gesto ficaria sem retorno
nenhum. Por isso existe **também** um ponto laranja no canto do brasão, que
não depende de animação. Quem desligou movimento continua vendo que o gesto
está sendo reconhecido.

### `noindex`, e não uma linha no `robots.txt`

O projeto de referência escondia o painel atrás de 5 cliques e listava
`/login`, `/dashboard`, `/clients` e `/admin/` no `robots.txt` — arquivo
público, servido na raiz. O efeito de "esconder" ali é o oposto: vira um
índice do que existe.

---

## Header

Transparente sobre o herói, sólido ao rolar. A troca é observada por
`IntersectionObserver` numa sentinela de 1px no topo — o navegador avisa
quando o estado muda, em vez de o main thread perguntar a cada quadro.

**A lista de rotas com herói é uma constante explícita.** Descobrir se a página
tem herói só depois da hidratação produziria um quadro de header sólido sobre o
herói; em conexão lenta, esse "quadro" dura o tempo do bundle. `usePathname()`
é conhecido no servidor, então o HTML já sai certo. O preço é uma linha quando
uma página nova ganhar herói.

O estado sólido é **derivado** (`!sobreHeroi || passouDoTopo`), não um segundo
estado sincronizado por efeito — navegar de `/` para `/agenda` não depende de
um efeito corrigir um valor obsoleto.

### Menu mobile

`<dialog>` de tela cheia: armadilha de foco, Escape e camada superior saem do
nativo. O que fica por nossa conta é o que o briefing pede explicitamente —
**travar a rolagem do corpo** — mais devolver o foco ao hambúrguer.

Os itens entram escalonados por `animation-delay`. Com `motion-safe:` e não uma
regra de reduced-motion depois: sem animação nenhuma, o item nasce visível, sem
depender de `animation-fill-mode`.

---

## O carrinho é um store externo

O contador do header lê o `localStorage`. O reflexo seria `useState` +
`useEffect`, e o React Compiler recusa — com razão. O `localStorage` muda **por
fora do React**: em outra aba, ou em outro componente da mesma página.

`useSyncExternalStore` é o mecanismo feito para isso, e resolve de brinde o
caso do servidor: `getServerSnapshot` devolve vazio, `getSnapshot` devolve o
real, e o React troca na hidratação sem acusar divergência.

A pegadinha: `getSnapshot` precisa devolver a **mesma referência** quando o dado
não mudou, ou o React re-renderiza para sempre. Daí o cache chaveado pela string
crua do storage.

**O que o carrinho guarda: referência e quantidade. Só.** Sem preço, sem nome,
sem disponibilidade — mesma regra de `POST /api/cart/validate` desde o PROMPT 03. Dois motivos: nada que o cliente guarda pode virar valor, e dado guardado
envelhece. Um carrinho aberto na terça mostraria o preço de terça numa saída
que mudou na quinta.

A versão fica na **chave** (`caqui:carrinho:v1`), não dentro do valor: mudar o
formato vira chave nova e o carrinho antigo deixa de ser lido — em vez de ser
lido errado.

---

## Movimento

|                      |                                                            |
| -------------------- | ---------------------------------------------------------- |
| **Revelar ao rolar** | `IntersectionObserver`, para de observar depois de revelar |
| **Parallax**         | 3 camadas, teto de 18% da rolagem                          |
| **Rolagem suave**    | nativa, desligada sob movimento reduzido                   |

### O conteúdo nunca começa escondido no CSS

O jeito comum é `.reveal { opacity: 0 }` no CSS e um script que a remove. Isso
publica uma página em branco para quem tem JavaScript desligado, para quem está
numa rede que engoliu o bundle, e para o robô que não executa script. E o
defeito nunca aparece em desenvolvimento.

Aqui o estado inicial é aplicado **pelo próprio JS**. Se ele não roda, nada é
escondido.

### Sob `prefers-reduced-motion`, nada é instalado

Não é só zerar a duração: o observer não é criado, o `will-change` não é
aplicado. Zero trabalho e zero risco de conteúdo preso invisível.

O bloco nuclear `*{transition-duration:0.01ms!important}` **não** é usado — com
`!important` ele mataria também as transições que devem sobreviver com duração
zero, e impediria qualquer alternativa em fade.

### O parallax por JavaScript foi removido em 18/08/2026

O herói antigo era um empilhado de camadas movidas por um listener de rolagem
(`Hero`, `CamadaHero`, `.camada-parallax`), com um céu de nuvens derivando
(`Nuvem`, `Nuvens`, `.nuvem-derivando`, `.serra-respirando`).

O herói novo é **vídeo**, e nada disso é renderizado por página nenhuma desde
o redesenho. Os dois componentes, os três grafismos e as 98 linhas de CSS
saíram do repositório.

Ficou o que substituiu: `VideoDeFundo` (com botão de pausa, WCAG 2.2.2) e o
bloco CENA em `globals.css`, que faz efeito contínuo por `animation-timeline`
— no compositor, com zero trabalho de main thread e zero byte de biblioteca.

---

## Rodapé e dados

O rodapé é a **última cena**, não um depósito de links: abre com uma frase em
escala de cartaz e dois botões que dizem a mesma coisa que ela, segue com a
legenda (navegação numerada, contato em ficha, newsletter) e fecha no colofão.

Ele é `palco-noite`, a mesma chapa do herói e da abertura de capítulo. Até
18/08/2026 era `ink-900`, preto neutro, herdado de quando o rodapé era a única
superfície escura do site. Dois pretos quase iguais empilhados na mesma rolagem
não leem como duas decisões: leem como erro de renderização.

A marca do rodapé também responde ao **gesto dos cinco toques** que leva ao CRM,
e a contagem é compartilhada com a do topo pelo `sessionStorage`.

Nada é `hardcoded`: número, Instagram, Cadastur e credencial do PESM vêm do
banco, editáveis no CRM. No projeto de referência, trocar o número de WhatsApp
exigia editar quatro arquivos — um deles com o número dentro de uma URL
percent-encoded escrita à mão.

**O site não cai se as configurações sumirem.** `buscarSettings()` devolve
`null`, o rodapé omite o que faltar e o botão de WhatsApp não aparece. Catálogo
e agenda continuam de pé. A regra: falha de dado **essencial** é erro; falha de
dado acessório é ausência.

A newsletter usa `POST /api/leads`, que exige `consentimento: true`. A caixa
começa desmarcada e o botão não envia sem ela — "assinou porque não desmarcou"
não é consentimento sob a LGPD.

### Quatro correções de contraste que só apareceram medindo

| Achado                                    | Medido               | Correção                                    |
| ----------------------------------------- | -------------------- | ------------------------------------------- |
| `ink-500` nos rótulos do rodapé escuro    | **3,65:1** — reprova | novo token `sand-400` (#9A948B), 6,32:1     |
| `ink-700` como filete no escuro           | **1,37:1**           | filete próprio, areia a 22%                 |
| branco a 20% como filete sobre a noite    | some                 | `rule-noite`; `rule-invertido` foi apagado  |
| `danger` no erro do formulário, no escuro | **3,05:1** — reprova | novo token `danger-claro` (#EF6B73), 6,36:1 |

A terceira e a quarta são de 18/08/2026, e as duas são do mesmo tipo: um token
nascido para uma superfície e usado noutra. `rule-invertido` não foi corrigido,
foi **apagado** — depois da varredura não sobrava nenhum uso certo dele, e um
token que só dá para usar errado não precisa de comentário avisando.

E um falso positivo legítimo da regra de lint: laranja **sobre fundo escuro**
passa (8,31:1 em `orange-400` sobre `ink-900`). Em vez de abrir exceção, o
valor ganhou um segundo nome — `--color-caqui-realce-escuro` — porque tem outra
regra de uso, e o nome é a documentação.

---

## Rotas

```
/                      home — herói com parallax
/trekking              lista de roteiros
/trekking/[slug]       detalhe do roteiro
/agenda                agenda cronológica
/wear                  catálogo da Caqui Wear
/wear/[slug]           detalhe da peça
/carrinho              a mochila
/sobre                 institucional + guias
/contato               formulário → POST /api/contact
/crm                   login → POST /api/auth/login
404 · error            fronteiras de erro
```

**Todas consomem a API real.** Nos componentes de servidor isso significa
chamar o serviço direto, sem o desvio de uma requisição HTTP do servidor para
ele mesmo — mesmo código, mesmos bytes, sem o round-trip. A rota HTTP continua
existindo e é ela que o cliente usa.

O conteúdo desenhado do catálogo é o **PROMPT 08**, e o carrinho com handoff
para o WhatsApp é o **PROMPT 09**. O que existe agora é a estrutura real, com
dados reais, na forma que esses dois vão vestir.

### `(loja)` e `(crm)` são grupos de rota separados

Layouts independentes ⇒ o Next separa os chunks: quem entra na loja não baixa o
código do painel. No projeto de referência, 61% do `src/` era CRM e ia no mesmo
bundle de 811 KB que a visitante baixava para ver um produto — e, num site cujo
painel é revelado por um gesto secreto, entregar o código dele a todo mundo
anula o gesto.

---

## Detalhes que não aparecem

- **Link "pular para o conteúdo"** antes do header, visível só no foco.
- **`LinkBotao` em vez de `asChild`.** Um `<button>` que às vezes é `<a>` é a
  origem mais comum de navegação quebrada. Duas tags, duas semânticas,
  aparência compartilhada.
- **O contador do carrinho no `aria-label`** — quem só ouve "carrinho" perde a
  única informação do ícone.
- **A tela de erro mostra o `digest`, nunca a mensagem.** No projeto de
  referência, o catch genérico concatenava `error.message` na resposta, e um
  500 entregava nome de model, de campo e de índice do banco.
- **"Tentar de novo" é `reset()`**, não `location.reload()`: remonta só o
  segmento que quebrou.
