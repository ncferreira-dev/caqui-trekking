# 10 — CRM

> Fase B, PROMPT 10. A interface administrativa em `/crm`. Aqui a prioridade é
> velocidade de operação, não beleza.

---

## A tabela de autorização

Antes de escrever a primeira tela, uma mecânica nova: `src/server/autorizacao.ts`
declara **quem pode chamar cada rota de `/api/admin/*`**, e
`src/test/autorizacao.test.ts` confronta a tabela com o disco.

O projeto já tinha uma varredura que exige 401 de toda rota admin sem sessão.
Ela pega o defeito mais grave — rota nascendo pública — e **não pega o
segundo**: rota nascendo com o papel errado. Uma rota de usuários que aceita
ADMIN passa naquela varredura com folga, porque recusa quem não tem sessão
exatamente como manda. O buraco fica aberto e verde.

Quatro coisas passam a quebrar:

| Quebra quando                               | Por que importa                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| Rota no disco sem entrada na tabela         | Ninguém publica endpoint administrativo sem decidir, por escrito, quem acessa |
| Entrada na tabela sem rota no disco         | Tabela envelhecida é pior que tabela nenhuma — alguém acredita nela           |
| Papel que a tabela nega e o handler aceita  | Guard removido ou afrouxado                                                   |
| Papel que a tabela permite e o handler nega | Guard apertado demais — quem descobre é a Caqui, num sábado, do celular       |

O quarto caso não é simetria bonita: é o defeito que ninguém testa. Guard
excessivamente restritivo não parece falha de segurança, parece o sistema
funcionando — até a operação diária travar.

### Ela nasceu falhando, e achou uma divergência real

Escrita antes das rotas novas, falhou em cinco casos. Três eram rotas que eu
ainda ia criar. O quarto foi um achado de verdade: eu tinha declarado
`DELETE /api/admin/tags/[id]` como **só OWNER**, e o handler aceita ADMIN.

Quem estava errado era a tabela. A política escrita em `docs/04-permissoes.md`
é _"ADMIN faz tudo, menos gerenciar usuários e **arquivar roteiro**"_ — apagar
uma tag de atividade é gestão de conteúdo de rotina, e o serviço já recusa
remover tag em uso.

O valor do mecanismo apareceu exatamente aí: ele me obrigou a conferir o
palpite contra a política escrita em vez de embarcar a divergência.

### Ela não é a segurança — é a prova de que a segurança está lá

Quem barra é o `exigirPapel` dentro de cada handler. A tabela **não é lida em
runtime de propósito**: se ela fosse o mecanismo, um erro de digitação numa
chave abriria uma rota em silêncio. Sendo só a expectativa do teste, um erro de
digitação **quebra o teste** — falha para o lado seguro.

---

## O guard da UI não é o guard dos dados

`server/crm/sessao-da-pagina.ts` manda para o login quando a sessão caiu. Existe
para a pessoa não encarar um painel que vai levar 401 em toda requisição.

A distinção é fácil de embaralhar e cara:

- Se **essa função** sumisse: o painel apareceria e nenhum dado carregaria.
- Se o **guard da API** sumisse: o dado sairia para qualquer um.

Mesma regra do papel vindo do banco, e não do token — desativar alguém vale na
navegação seguinte. `exigirSessaoDaPagina()` é chamada **em cada página**, não
só no layout: layout do Next não é barreira.

Na navegação, esconder o item que a pessoa não pode usar é **cortesia**: o
`fetch` continua chamável do console. O valor é não oferecer um caminho que
termina em 403.

---

## O celular é o cenário principal, não a adaptação

O briefing é explícito, e ele molda a tela inteira: a Caqui mexe nisto do
telefone, no meio do dia, entre uma conversa e outra do WhatsApp.

**A navegação fica embaixo.** Menu hambúrguer custa dois toques e obriga a
esticar o polegar até o canto mais distante da tela — numa mão só, geralmente
em pé. Barra inferior: um toque, na zona onde o polegar já está. Em `lg` ela
vira coluna à esquerda.

**Seis itens é o teto.** Em 375px, seis alvos dão 62px cada. O sétimo espreme
tudo ou vira "mais…", que é o hambúrguer com outro nome.

**Denso não é apertado.** O respiro encolhe; o alvo de toque não. Os botões
mantêm 44px de altura mínima.

---

## Disponibilidade em um toque

É o campo mais mexido do sistema inteiro, e a tela existe em função dele.

O fluxo real: a Caqui está numa conversa, alguém fecha a última vaga, e ela
precisa marcar "esgotado" antes da próxima pessoa reservar. Abrir a saída,
achar o campo, salvar, voltar são quatro toques e uma navegação — tempo
suficiente para chegar um segundo pedido da vaga que não existe mais.

Três botões na própria linha. Um toque. `PATCH` dedicado, que grava histórico
em `DepartureAvailabilityChange` e auditoria **na mesma transação**.

### O otimismo desfaz

O botão pinta na hora e a requisição vai atrás — esperar a resposta faz a
pessoa tocar de novo achando que não pegou, e aí são dois PATCH e duas linhas
no histórico.

Se falhar, o estado **volta** e um aviso explica. O pior resultado possível
aqui é a tela dizer "esgotado" e o site continuar vendendo: um otimismo que não
desfaz é pior que nenhum otimismo. Vale igual para a grade de variantes da
Wear.

---

## Calendário: por que não

O briefing pede "calendário mensal + lista". Entreguei lista agrupada por mês, e
vale escrever o porquê em vez de entregar as duas coisas pela metade:

- A Caqui tem 4 a 8 saídas por mês. Uma grade de 35 células para 6 marcações é
  29 quadrados vazios ocupando a tela do celular.
- O que se faz aqui é **mudar disponibilidade**. Numa célula de calendário não
  cabem três botões de 44px — a grade obrigaria a tocar no dia, abrir um
  painel, e só então agir: os quatro toques que esta tela existe para eliminar.
- Lista de datas já é ordenada por data. O ganho do calendário é ver buracos na
  agenda, e o cabeçalho de mês com a contagem entrega isso em uma linha.

Se a operação crescer para dezenas de saídas por mês, o calendário passa a
valer — e entra como **vista alternativa**, não como substituto.

---

## Confirmação diz a consequência, não "tem certeza?"

"Tem certeza?" não informa nada: quem clicou já tinha certeza, foi por isso que
clicou. O diálogo só vale se disser o que acontece com o mundo.

Cancelar uma saída:

> Ela some da agenda do site na hora, e ninguém mais consegue reservar. Quem já
> tem a vaga na mochila recebe um aviso de indisponível ao tentar finalizar —
> mas **quem já fechou pelo WhatsApp precisa ser avisado por você.**
>
> A saída não é apagada: fica no histórico, marcada como cancelada.

Depois de ler isso a pessoa às vezes desiste. É o objetivo — e é por isso que o
texto da consequência é **prop obrigatória** do componente, não opcional.

E o erro fica **dentro** do diálogo: fechar e mostrar um aviso no canto faria a
pessoa perder o contexto do que tentou fazer.

---

## O preview do template usa a mesma função da loja

A tela de configurações edita `whatsappMessageTemplate` com prévia ao vivo. A
prévia chama `montarMensagem` — **a mesma função que a loja chama de verdade**.

Esse é o ponto todo. Uma prévia que reimplementasse a interpolação mostraria uma
coisa e o cliente receberia outra, e a divergência apareceria na conversa sem
ninguém saber por quê. `montarMensagem` é função pura, sem framework e sem
banco, e é isso que permite rodá-la nos dois lugares com resultado idêntico.

Os marcadores entram por clique, não por digitação: `{{itens}}` digitado à mão
é onde nasce o `{{iten}}` que o servidor recusa. E o marcador desconhecido
aparece **cru na prévia**, o que torna o erro visível antes de qualquer aviso.

---

## Cliente de API: ramifica pelo `code`, nunca pela `message`

`src/lib/crm/api.ts`. O `code` é o contrato, estável, em SCREAMING_SNAKE. A
`message` é para humano e muda a qualquer momento — no projeto de referência o
front comparava strings de mensagem, e bastava melhorar uma redação para o
tratamento de erro parar de funcionar em silêncio.

**401 manda para o login. 403 não.** São coisas diferentes: 401 é "não sei quem
você é" — insistir não adianta. 403 é "sei quem você é e você não pode" —
deslogar seria absurdo.

A mensagem do servidor **é** exibida aqui, ao contrário da loja: quem lê é a
Caqui, e "Já existe uma saída deste roteiro nesta data" é exatamente o que ela
precisa saber.

---

## O que NÃO foi entregue, e por quê

O briefing pede editor rico, galeria por arrastar, CRUD completo de produto e
formulário dos dados da empresa. Eles dependem, todos, de **upload de imagem
funcionando ponta a ponta**, que passou a existir em 21/08/2026: o Cloudinary
ganhou credencial, e `POST /api/admin/media` sobe de verdade. Sem as variáveis
no ambiente ele continua respondendo 503 `MEDIA_STORAGE_UNCONFIGURED`,
nomeando o que falta.

Entregar uma área de arrastar que sempre falha seria pior que não entregar: a
Caqui tentaria, veria erro, e concluiria que o CRM está quebrado. O que está no
ar é o que funciona hoje:

| Tela     | Entregue                                                                   | Falta                        |
| -------- | -------------------------------------------------------------------------- | ---------------------------- |
| Painel   | números, dois alertas, próximas saídas                                     | —                            |
| Saídas   | lista por mês, disponibilidade em um toque, duplicar, cancelar             | criar saída por formulário   |
| Roteiros | lista, estado, alerta de "sem data futura"                                 | editor rico, galeria         |
| Produtos | grade de variantes com disponibilidade em um toque                         | criar peça, foto, editar     |
| Caixa    | mensagens com marcar lida e responder no WhatsApp, leads com consentimento | —                            |
| Config   | leitura de tudo, template com prévia ao vivo, usuários (OWNER)             | formulário dos demais campos |

O template salva porque é o único que não depende de storage.

---

## Verificação

| O quê                          | Resultado                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `lint` · `typecheck` · `build` | limpos                                                                                          |
| `npm run test`                 | 183 testes (eram 149)                                                                           |
| Tabela de autorização          | 31 testes; nasceu falhando em 5                                                                 |
| Login → painel                 | 200, cookie `httpOnly` (invisível a `document.cookie`)                                          |
| Painel com dado real           | 2 alertas dispararam: saída em <7 dias aberta, roteiro sem data                                 |
| Disponibilidade em um toque    | `AVAILABLE → LAST_SPOTS` no banco, + `DepartureAvailabilityChange` com `userId`, + `audit_logs` |
| Celular em 375px               | barra inferior de 6 itens, alvos de 44px+, nenhuma rolagem horizontal                           |

A verificação usou um usuário temporário criado e removido no fim — a senha do
`.env` do projeto não foi lida. O estado do banco de desenvolvimento foi
restaurado.

---

## Pendências

- ~~**Cloudinary no `.env`**~~ — feito em 21/08/2026. Upload, entrega otimizada
  e remoção provados ponta a ponta; as chaves estão no `.env` e na Vercel.
- **Criar saída por formulário** — hoje só duplicando uma existente.
- **Calendário como vista alternativa**, se a operação crescer.
- Continua valendo: **nenhuma foto de expedição** foi entregue, e a galeria é
  do produto e não da variante (ver `docs/09-wear-carrinho.md`).

---

## Varredura de layout: a coluna que some

Em 19/08/2026 duas telas do CRM tinham a coluna de identificação com
**largura zero** em telas de notebook. O texto era pintado por baixo dos
botões.

| Tela            | O que sumia                        | Medido                       |
| --------------- | ---------------------------------- | ---------------------------- |
| `/crm/saidas`   | data, hora, preço, nome do roteiro | 0px em 1100 · 85px em 1280   |
| `/crm/roteiros` | nome do roteiro, cidade, duração   | 0px em 1024, nos cinco itens |

A causa é flexbox e vale para qualquer linha do sistema: `flex-1` é
`flex: 1 1 0%`, base **zero**. A coluna só existe se sobrar espaço. Quando o
irmão ao lado não declara encolhimento e tem conteúdo largo, não sobra nada, e
`min-w-0` é a permissão explícita de ir até zero.

Na tela de saídas a linha dizia "de 12, faltam 6" sem dizer de qual saída.

O conserto foi um piso, `lg:min-w-56`, nas duas colunas.

### O que é mecânico

`src/test/coluna-que-some.test.ts` varre os `.tsx` do projeto: onde existe uma
linha que vira horizontal num breakpoint (`lg:flex-row`) com uma coluna
`min-w-0 flex-1` logo abaixo, o piso de largura passa a ser obrigatório.
Aponta arquivo e linha. Tirar o piso de qualquer uma das duas telas derruba o
teste — conferido nas duas.

Hoje ela examina 2 linhas e acusa 0. Os outros quatro usos de `min-w-0 flex-1`
no projeto ficam de fora com razão: o `main` do CRM tem irmão de largura fixa,
a lista de guias e o item do carrinho têm irmão `shrink-0`, e o styleguide é a
mesma forma do carrinho.

### O que continua manual, e por quê

**Largura calculada não tem varredura mecânica aqui.** Colapso só existe
depois que o navegador faz o layout, e o projeto não tem navegador na bateria
de testes. Uma linha escrita de outro jeito pode colapsar sem a trava piscar.

Abra cada tela em **1024, 1152 e 1280** — as larguras onde a linha já deitou e
o espaço ainda é curto — e rode no console:

```js
;[...document.querySelectorAll('body *')]
  .filter((el) => {
    if (el.ownerSVGElement || el.tagName === 'svg') return false
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') return false
    if ((el.className || '').toString().includes('sr-only')) return false
    const copia = el.cloneNode(true)
    copia.querySelectorAll('.sr-only').forEach((n) => n.remove())
    const texto = (copia.textContent || '').replace(/\s+/g, ' ').trim()
    if (texto.length < 9) return false
    const r = el.getBoundingClientRect()
    return r.width < 40 && r.height > 0
  })
  .map((el) => ({ cls: el.className, w: el.getBoundingClientRect().width, txt: el.innerText }))
```

Precisa voltar **vazio**. Elemento com texto e largura perto de zero é texto
que existe no DOM, é lido por leitor de tela, e não está na tela para quem
enxerga.

As três exclusões existem porque cada uma gerou falso positivo na primeira
passada: `sr-only` é texto invisível de propósito; texto dentro de `<svg>` tem
caixa que não corresponde ao desenho; e um elemento cujo texto vem só de um
filho `sr-only` (a bolinha de cor de 16px na loja) não é defeito nenhum.

**Rodado em 19/08/2026**, em 1024, 1152 e 1280: seis telas do CRM e as dez
telas públicas, mais o carrinho com itens em 375. Só as duas linhas da tabela
acima acusaram, e as duas estão consertadas.
