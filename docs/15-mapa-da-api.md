# 15 · Mapa da API — autenticação, recursos, limites e o que falta

> Levantado em 18/08/2026, lendo as 37 rotas em `src/app/api/**`, a tabela de
> autorização em `src/server/autorizacao.ts` e os serviços em `src/server/`.
> Este arquivo é o retrato do que EXISTE, não do que deveria existir. A seção
> final separa o que falta.

---

## 1. Como a autenticação funciona

### O token guarda identidade, e só

```
POST /api/auth/login  →  Set-Cookie: caqui_sessao=<JWT>; HttpOnly; SameSite=strict
```

O corpo da resposta **não** contém o token. É deliberado: token no corpo é
convite para o front guardá-lo em `localStorage`, que é o vetor de XSS que o
`HttpOnly` existe para fechar.

O JWT carrega `userId` e `tokenVersion`. **Não carrega papel.** Cargo, status
ativo e versão do token são lidos do banco a cada requisição, em
`src/lib/auth/session.ts`. Custa uma leitura e compra o fato de que desativar
alguém tem efeito no mesmo segundo, sem esperar token expirar e sem lista de
revogação.

`tokenVersion` é o que faz o botão "Sair" ser verdade: o logout incrementa o
número e todo token emitido antes para de valer no servidor.

### Os dois códigos de falha, e eles significam coisas diferentes

| Código | Significado                                | Front deve              |
| ------ | ------------------------------------------ | ----------------------- |
| `401`  | não sei quem você é (sem sessão, expirada) | mandar para o login     |
| `403`  | sei quem você é, e você não pode           | mostrar "sem permissão" |

Trocar os dois manda a pessoa para a tela errada, e é erro comum o bastante
para ter teste próprio em `src/test/auth.test.ts`.

### Os dois papéis

| Papel   | O que só ele faz                                                         |
| ------- | ------------------------------------------------------------------------ |
| `OWNER` | criar/listar usuários, apagar saída de vez, arquivar roteiro, apagar tag |
| `ADMIN` | todo o resto: a operação diária                                          |

A regra escrita em `autorizacao.ts` é: **OWNER destrói e concede acesso; ADMIN
opera.** Operação de rotina é de ADMIN porque é ela que roda todo dia, do
celular, no meio da trilha.

### A tabela declarativa é o mecanismo, não o comentário

`src/server/autorizacao.ts` mapeia rota → método → papéis. `src/test/autorizacao.test.ts`
compara essa tabela com o que existe no disco e falha quando:

- nasce uma rota admin sem entrada na tabela
- some uma rota que a tabela ainda declara
- alguma rota admin não chama guarda nenhuma

É uma busca que precisa voltar vazia, não um teste que afirma sucesso.

### O bloqueio de login (corrigido em 18/08/2026)

Cinco senhas erradas gravam `lockedUntil` no **banco** (não no navegador). Desde
18/08/2026, o bloqueio barra **apenas quem erra a senha**: quem acerta entra e
o bloqueio some junto.

A versão anterior respondia `423 ACCOUNT_LOCKED` e barrava até a senha certa.
Isso tinha dois efeitos, e os dois eram sérios: o status revelava quais e-mails
têm conta (e-mail sem conta responde 401 sempre), e cinco requisições a cada
quinze minutos mantinham a Caqui permanentemente fora do próprio CRM, usando o
e-mail que o site publica no rodapé.

---

## 2. Os recursos

### Público, sem sessão

| Rota                   | Método | O que faz                                  | Limite de taxa |
| ---------------------- | ------ | ------------------------------------------ | -------------- |
| `/api/trips`           | GET    | vitrine de roteiros                        | não            |
| `/api/trips/[slug]`    | GET    | detalhe do roteiro                         | não            |
| `/api/departures`      | GET    | agenda cronológica                         | não            |
| `/api/departures/[id]` | GET    | detalhe da saída                           | não            |
| `/api/products`        | GET    | catálogo da Caqui Wear                     | não            |
| `/api/products/[slug]` | GET    | detalhe da peça                            | não            |
| `/api/guides`          | GET    | equipe (só `active` e não arquivado)       | não            |
| `/api/settings`        | GET    | WhatsApp, Instagram, textos institucionais | não            |
| `/api/health`          | GET    | sonda de saúde                             | não            |
| `/api/cart/validate`   | POST   | revalida preço e disponibilidade           | **sim**        |
| `/api/contact`         | POST   | mensagem de contato                        | **sim**        |
| `/api/leads`           | POST   | newsletter e "avise-me"                    | **sim**        |

Toda rota pública de ESCRITA tem limite de taxa; nenhuma de leitura tem. O
limite vive em `src/lib/api/rate-limit.ts`, com contador em memória mais um
backstop persistente em `rate_limit_buckets` — porque em serverless o contador
em memória reseta a cada cold start e o limite efetivo vira
`limite × nº de instâncias`.

### Administrativo, com sessão

| Rota                                      | Métodos       | Papel |
| ----------------------------------------- | ------------- | ----- |
| `/api/admin/dashboard`                    | GET           | ambos |
| `/api/admin/departures`                   | GET, POST     | ambos |
| `/api/admin/departures/[id]`              | PATCH         | ambos |
| `/api/admin/departures/[id]`              | DELETE        | OWNER |
| `/api/admin/departures/[id]/vagas`        | PATCH         | ambos |
| `/api/admin/departures/[id]/availability` | PATCH         | ambos |
| `/api/admin/departures/[id]/fechar`       | POST          | ambos |
| `/api/admin/departures/[id]/cancel`       | POST          | ambos |
| `/api/admin/departures/[id]/duplicate`    | POST          | ambos |
| `/api/admin/trips`                        | GET           | ambos |
| `/api/admin/trips/[id]`                   | PATCH         | ambos |
| `/api/admin/trips/[id]`                   | DELETE        | OWNER |
| `/api/admin/products`                     | GET, POST     | ambos |
| `/api/admin/products/[id]`                | PATCH         | ambos |
| `/api/admin/variants/[id]`                | PATCH         | ambos |
| `/api/admin/media`                        | GET, POST     | ambos |
| `/api/admin/media/[id]`                   | PATCH, DELETE | ambos |
| `/api/admin/media/reorder`                | PATCH         | ambos |
| `/api/admin/tags`                         | GET, POST     | ambos |
| `/api/admin/tags/[id]`                    | PATCH, DELETE | ambos |
| `/api/admin/messages`                     | GET, PATCH    | ambos |
| `/api/admin/leads`                        | GET           | ambos |
| `/api/admin/settings`                     | GET, PUT      | ambos |
| `/api/admin/users`                        | GET, POST     | OWNER |

### O contrato de resposta

Sucesso: `{ data: ... }`. Erro: `{ error: { code, message, campos? } }`, com
`code` de um enum fechado em `src/lib/api/errors.ts`.

Entrada é **estrita**: todo schema Zod usa `.strict()`, então campo desconhecido
vira 400 em vez de ser ignorado em silêncio. Isso é o que faz a porta lateral
ficar fechada — `PATCH /api/admin/departures/:id` recusa `vagasFechadas`, que
tem rota própria com histórico.

Erro de validação devolve **todos** os campos problemáticos de uma vez, não o
primeiro. Formulário que corrige um erro por vez é o que faz alguém desistir.

---

## 3. Limitações reais (o que a API não faz)

### 3.1 Não dá para criar um roteiro

`/api/admin/trips` tem **apenas GET**. Não existe `POST`, não existe
`criarTrip` em `content-admin-service.ts`. O CRM edita roteiro que já existe
(veio do seed) e não tem como acrescentar um.

É a limitação mais séria do conjunto: **Trip é a entidade central**. Saída,
mídia, tag e mensagem penduram nela. Sem criar roteiro, o CRM não atende o
primeiro roteiro novo que a Caqui abrir.

### 3.2 Guia não tem CRUD nenhum

`Guide` aparece em zero rotas administrativas. A equipe só entra por seed ou
escrita direta no banco. `/sobre` e a página de cada roteiro exibem essa lista,
com nome, bio, Cadastur e PESM.

### 3.3 Tag existe na API e não existe na tela

`/api/admin/tags` tem CRUD completo e **nenhuma tela do CRM chama**. Além
disso, não há rota para LIGAR uma tag a um roteiro: `TripActivityTag` só é
escrita pelo seed. As tags que a agenda filtra são as cinco do seed, para
sempre.

### 3.4 Produto não pode ser arquivado

`/api/admin/products/[id]` só tem PATCH. `Product.deletedAt` existe no schema e
nada o escreve. Tirar uma peça do ar exige mudar `status` para `ARCHIVED`, que
é outra coisa (e funciona), mas o soft delete modelado nunca é usado.

### 3.5 Criar usuário não tem porta na interface

`POST /api/admin/users` está completo e correto. A tela de Configurações
**apenas lista**. Para entrar um segundo operador é preciso rodar seed ou
escrever no banco, e nesse caminho o `passwordHash` sai do fluxo que garante o
custo certo do bcrypt.

### 3.6 O histórico de disponibilidade é só de escrita

`DepartureAvailabilityChange` é gravado em toda mudança e **nenhuma tela, rota
ou serviço lê**. A pergunta que ele existe para responder ("por que essa saída
ficou esgotada no dia 3?") não tem caminho no produto.

### 3.7 Não há paginação em nenhuma tela

As rotas aceitam `limit`/`offset`. As telas do CRM consultam o Prisma direto,
com `take` fixo (200 em saídas, 8 no painel), e não oferecem próxima página.
Funciona com 6 saídas; não funciona com 600.

### 3.8 Não há recuperação de senha

Nenhuma rota. Se o OWNER esquecer a senha, a saída é o banco.

### 3.9 Leitura pública não tem limite de taxa

Um raspador leva o catálogo inteiro sem esbarrar em nada. Não é urgente (o dado
é público de propósito), mas é uma porta aberta para custo de banco.

---

## 4. Melhorias práticas, em ordem de valor

### Primeiro: fechar o que já está pela metade

1. ~~**`POST /api/admin/trips` + tela de criar roteiro.**~~ **Feito em
   18/08/2026.** A rota entrou primeiro; o botão "+ Novo roteiro" entrou em
   seguida, com os cinco campos sem os quais o roteiro não é nada. O resto do
   trabalho editorial continua no "Editar", que é onde ele cabe.
2. ~~**A ligação `TripActivityTag`**~~ **Feita em 18/08/2026.**
   `PATCH /api/admin/trips/:id` aceita `activityTagIds` com semântica de
   substituição, e a tela de Roteiros ganhou o painel de atividades (criar,
   renomear, apagar) mais as caixas de seleção dentro do editor.
   **CRUD de guia também entrou em 18/08/2026:**
   `GET/POST /api/admin/guides` e `PATCH/DELETE /api/admin/guides/:id`, com o
   painel "Quem guia" em Configurações. `DELETE` é arquivar (soft delete) e é
   só do OWNER: as saídas já realizadas guardam quem guiou, e essa é a prova
   de que a trilha teve guia credenciado.
3. ~~**Formulário de criar usuário**~~ **Feito em 18/08/2026.** Botão "+ Novo
   acesso" no painel "Quem tem acesso", só para OWNER.
4. ~~**Ler o histórico de disponibilidade**~~ **Feito em 18/08/2026**, junto
   com a trilha de auditoria. Ver
   [19-acesso-ordem-e-tetos.md](19-acesso-ordem-e-tetos.md).

### Depois: o que o cliente pediu (docs 13 e 14)

5. ~~**Fila de fechamento e relatório de resultado**~~ **Feito em 18/08/2026.**
   Ver [17-vagas-e-fechamento.md](17-vagas-e-fechamento.md).
6. ~~**Agenda de calendário**, no CRM e na loja.~~ **Feita em 18/08/2026.** Ver
   [18-agenda-de-calendario.md](18-agenda-de-calendario.md).
7. **`MediaAsset.colorName`**, ligando foto a cor da variante. **Pendente**, ver
   [14-cadastro-de-produto.md](14-cadastro-de-produto.md).

### Estrutural, quando o volume pedir

8. ~~**Paginação de verdade** nas telas do CRM.~~ **Feita em 18/08/2026.**
9. ~~**Recuperação de senha**~~ **Feita em 18/08/2026**: o dono troca a senha de
   qualquer pessoa pelo painel, e `scripts/resetar-senha.ts` cobre o caso do
   dono único trancado para fora, com as cinco travas de operação destrutiva.
10. ~~**Limite de taxa nas leituras públicas**, por IP, generoso.~~ **Feito em
    18/08/2026**: 240 por minuto por IP, com varredura provando que nenhuma
    rota pública de GET fica de fora.

Tudo em [19-acesso-ordem-e-tetos.md](19-acesso-ordem-e-tetos.md).

### O que NÃO vale a pena

- **Versionar a API (`/v1`).** Cliente único, mesmo repositório, deploy junto.
  Versão existe para quem não controla o consumidor.
- **GraphQL ou tRPC.** As telas do CRM leem Prisma direto no servidor; a
  camada HTTP existe para as escritas e para o front público. Trocar o
  transporte não resolve nenhum problema que este projeto tenha.
- **Webhook de saída.** Não há integração externa pedida.

---

## 5. O que este mapa deixou fora, de propósito

- Os campos de cada schema Zod: eles mudam junto com a tela, e duplicá-los aqui
  cria documentação que envelhece. A fonte é o próprio `route.ts`.
- A modelagem: ela é assunto do documento seguinte.
