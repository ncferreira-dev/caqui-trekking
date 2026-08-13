# 04 — Autenticação e permissões

> Fase A, PROMPT 04. 3 rotas de auth, 10 rotas administrativas, 32 testes.
> Total do projeto: **61 testes**.

---

## Os 5 toques na logo não são autenticação

O gesto **apenas revela a rota** `/crm`. Nada mais.

`/crm` e toda rota `/api/admin/*` estão tão protegidas quanto estariam se houvesse um link
"Entrar" no menu principal. Segurança por obscuridade não é segurança — e o projeto de
referência ilustra o ponto melhor do que qualquer argumento: escondia o botão atrás de 5
cliques no copyright e, ao mesmo tempo, listava `/login`, `/dashboard`, `/clients` e
`/admin/` no `robots.txt`, público para qualquer um ler.

A barreira real é `exigirAutenticacao` / `exigirPapel`, aplicada rota a rota, e há um teste
que percorre o diretório e falha se alguma rota admin não recusar acesso sem sessão.

---

## Matriz de permissões

| Recurso            | Operação                                       | OWNER | ADMIN | Público |
| ------------------ | ---------------------------------------------- | :---: | :---: | :-----: |
| **Catálogo**       | Ler roteiros, saídas, produtos                 |   ✓   |   ✓   |    ✓    |
| **Carrinho**       | Revalidar preço e disponibilidade              |   ✓   |   ✓   |    ✓    |
| **Contato / Lead** | Enviar                                         |   ✓   |   ✓   |    ✓    |
| **Sessão**         | Login, logout, quem sou eu                     |   ✓   |   ✓   |    —    |
| **Dashboard**      | Ver próximas saídas e alertas                  |   ✓   |   ✓   |    ✗    |
| **Saídas**         | Listar (com rascunhos e `internalNotes`)       |   ✓   |   ✓   |    ✗    |
|                    | Criar                                          |   ✓   |   ✓   |    ✗    |
|                    | **Duplicar para outra data**                   |   ✓   |   ✓   |    ✗    |
|                    | **Mudar disponibilidade**                      |   ✓   |   ✓   |    ✗    |
|                    | Cancelar                                       |   ✓   |   ✓   |    ✗    |
| **Roteiros**       | Editar, publicar, destacar, reordenar          |   ✓   |   ✓   |    ✗    |
|                    | **Arquivar (soft delete)**                     |   ✓   |   ✗   |    ✗    |
| **Variantes**      | Toggle de disponibilidade                      |   ✓   |   ✓   |    ✗    |
| **Configurações**  | Ler e editar, inclusive o template do WhatsApp |   ✓   |   ✓   |    ✗    |
| **Mensagens**      | Listar, marcar como lida                       |   ✓   |   ✓   |    ✗    |
| **Leads**          | Listar                                         |   ✓   |   ✓   |    ✗    |
| **Usuários**       | **Listar e criar**                             |   ✓   |   ✗   |    ✗    |

**A regra:** ADMIN faz tudo, menos duas coisas — **gerenciar usuários** e **arquivar
roteiro**.

Usuários porque quem pode criar usuário pode criar outro OWNER e se tornar irremovível.
Arquivar roteiro porque afeta o histórico e as saídas ligadas a ele.

Tudo o que é operação de rotina — mudar disponibilidade, duplicar saída, responder
mensagem — o ADMIN faz. O CRM vai ser operado do celular, no meio do dia, entre uma
conversa e outra do WhatsApp: exigir o OWNER para tarefa diária só faria a senha do OWNER
circular.

---

## Sessão

**Cookie `httpOnly`, `Secure`, `SameSite=strict`, 8 horas.**

|                   | Projeto de referência          | Caqui                |
| ----------------- | ------------------------------ | -------------------- |
| Onde vive o token | `localStorage`                 | Cookie `httpOnly`    |
| Validade          | 7 dias                         | 8 horas              |
| Alcance de XSS    | Rouba a sessão                 | Não lê o cookie      |
| CSRF              | Sem proteção                   | `SameSite=strict`    |
| Logout            | `removeItem` local             | Invalida no servidor |
| Revogação         | Só trocando o segredo de todos | Por usuário          |

**O `tokenVersion` é o que faz "Sair" ser verdade.** O logout incrementa o número no banco,
e todo token emitido antes para de valer — inclusive o do celular roubado que ficou com a
sessão aberta. Sem isso, "Sair" apenas limpa o próprio navegador: no projeto de referência,
o token do aparelho perdido continuava abrindo a lista de clientes por até uma semana.

**O papel vem do banco, não do token.** Rebaixar alguém de OWNER para ADMIN passa a valer
na requisição seguinte, sem esperar o token expirar. O mesmo vale para desativar a conta.

**O token nunca aparece no corpo da resposta** — há um teste que verifica isso. Se
aparecesse, o front seria tentado a guardá-lo, e voltaríamos ao `localStorage`.

---

## Força bruta: duas defesas independentes

|                        | Onde                | O que barra                                   |
| ---------------------- | ------------------- | --------------------------------------------- |
| **Rate limit por IP**  | Memória do processo | Um IP martelando o login                      |
| **Bloqueio por conta** | **Banco**           | Ataque distribuído contra uma conta conhecida |

5 tentativas erradas → **conta bloqueada por 15 minutos**, com o contador em
`failedLoginAttempts` e `lockedUntil` na tabela de usuários. Durante o bloqueio, **nem a
senha certa passa** — testado.

O bloqueio precisa estar no banco, não em memória: em serverless a instância seguinte não
saberia de nada, e um restart zeraria o contador.

O projeto de referência anunciava "3 tentativas → bloqueio de 10 min" com o contador em
`localStorage`. Um `curl` em loop nunca o via, e `localStorage.clear()` no DevTools o
zerava. **A tela mostrava "Bloqueado · tente em 9:47" sem oferecer proteção nenhuma** — o
que é pior que não ter, porque ninguém volta para consertar o que parece resolvido.

**Regra que sai daqui: se o controle pode ser apagado com `localStorage.clear()`, ele não é
um controle.**

### Enumeração de e-mail

Login com e-mail inexistente e login com senha errada devolvem **o mesmo código, a mesma
mensagem e o mesmo status** — e gastam o mesmo tempo, porque quando o usuário não existe a
aplicação queima o tempo de um bcrypt de propósito.

Sem isso, dá para descobrir quais e-mails têm conta só cronometrando a resposta. Há teste
comparando as duas respostas campo a campo.

---

## 401 e 403 são coisas diferentes

| Código                | Status  | Significado                      | O que o front faz                    |
| --------------------- | ------- | -------------------------------- | ------------------------------------ |
| `UNAUTHENTICATED`     | **401** | Sem sessão, expirada ou revogada | Desloga e manda para o login         |
| `FORBIDDEN`           | **403** | Autenticado, sem permissão       | Mostra "sem acesso", **não desloga** |
| `INVALID_CREDENTIALS` | 401     | E-mail ou senha incorretos       | Erro no formulário                   |
| `ACCOUNT_LOCKED`      | 423     | Conta bloqueada temporariamente  | Mostra o tempo restante              |

No projeto de referência os dois primeiros devolviam **403**, e por isso o front limpava o
token em qualquer falha — incluindo banco fora do ar. Era também o motivo de precisar de
uma chamada `/auth/validate-session` a cada página montada.

---

## Auditoria

**Toda mutação em Trip, Departure, Product, ProductVariant e SiteSetting grava `AuditLog`
com `before` e `after`, na mesma transação da escrita.**

A transação é o ponto: no projeto de referência o saldo de estoque e o registro do ledger
eram duas escritas soltas. Se a segunda falhasse, o número mudava sem rastro — exatamente
o que a auditoria existe para impedir.

O que **não** entra na auditoria: senha e hash. O registro guarda o que aconteceu, não a
credencial.

Mudança de disponibilidade grava **dois** registros: o `AuditLog` genérico e um
`DepartureAvailabilityChange` com estado anterior, novo e motivo. Quando a Caqui perguntar
"por que essa saída ficou esgotada no dia 3?", a resposta existe.

---

## As duas operações que a UI precisa tornar triviais

### Duplicar saída — `POST /api/admin/departures/:id/duplicate`

A operação mais repetida do sistema: a Caqui abre a agenda do mês seguinte a cada virada de
mês.

Sem corpo, a data sugerida é a **equivalente**: mesmo dia da semana, mesma posição no mês.
"3º sábado de agosto" → "3º sábado de setembro", **não** "+30 dias", que jogaria um sábado
numa segunda — e a Caqui só opera em fim de semana. O horário local é preservado: uma saída
de nascer do sol às 03:00 continua às 03:00.

Se a 5ª ocorrência não existir no mês seguinte, recua para a última.

A cópia herda preço, ponto de encontro, horário e guias. **Não herda a disponibilidade**:
nasce `AVAILABLE`, porque herdar `SOLD_OUT` faria a agenda nova aparecer esgotada — o pior
default possível. Nasce em `DRAFT`, para conferência antes de publicar.

Duplicar duas vezes para a mesma data devolve **409 CONFLICT** com mensagem clara, não um
erro de constraint do banco vazando.

### Mudar disponibilidade — `PATCH /api/admin/departures/:id/availability`

Endpoint dedicado, de propósito. A UI é **um toque** na listagem — três botões, Abertas /
Últimas / Esgotado —, não um formulário. É o campo mais alterado do sistema.

O update genérico da saída **não aceita este campo**. É a mesma disciplina do "caminho único
de escrita" que o projeto de referência acertou no estoque: fechar a porta lateral é o que
faz o histórico valer alguma coisa.

Tocar no botão do estado que já está ativo não é erro nem gera histórico de uma mudança que
não houve.

---

## Testes

**32 casos**, além dos 29 do PROMPT 03.

O mais importante é a **varredura de diretório**: o teste percorre `src/app/api/admin` no
disco, importa cada `route.ts`, chama cada método HTTP exportado sem sessão e exige 401.

É o teste que o projeto de referência não tinha. Lá, uma rota nova nascia pública por
esquecimento e ninguém descobria até vazar. Aqui, esquecer o guard em qualquer rota futura
faz o teste falhar sozinho — sem depender de alguém lembrar em code review.

Os outros cobrem: bloqueio de conta persistido, resposta idêntica para e-mail inexistente,
cookie `httpOnly` sem token no corpo, logout invalidando token válido, sessão de usuário
desativado morrendo na hora, token com assinatura falsa recusado, ADMIN barrado em usuários
com 403, `passwordHash` nunca na resposta, auditoria com before/after, data equivalente na
duplicação, e o template do WhatsApp recusando placeholder desconhecido.

---

## Pendências conscientes

1. **Rate limit por IP ainda é em memória.** Em serverless, o limite efetivo é
   `limite × instâncias`. O bloqueio por conta (no banco) cobre o caso crítico do login; a
   troca por contador compartilhado (Upstash Redis) fica para o deploy, no PROMPT 11.
2. **Sem refresh token.** A sessão dura 8 horas e expira; não há renovação silenciosa. Para
   um CRM operado em turnos, é aceitável — e mais simples significa menos superfície.
3. **Sem CRUD de galeria e de tags** nas rotas admin. Entra no PROMPT 05, junto com o upload
   de mídia, que é onde a galeria faz sentido.
4. **Sem troca de senha nem recuperação.** O OWNER cria usuários com senha definida. Fluxo
   de "esqueci minha senha" exige envio de e-mail, que não está no escopo da Fase A.

---

## Estado da Fase A

- [x] **00** — Análise do Dália
- [x] **01** — Bootstrap
- [x] **02** — Schema e seed
- [x] **03** — API do catálogo
- [x] **04** — Auth e API do CRM _(este documento)_
- [ ] **05** — Mídia e uploads
