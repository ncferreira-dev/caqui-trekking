# Caqui Trekking

Site da **Caqui Trekking** — ecoturismo e aventura em Mogi das Cruzes, SP.
Guias Cadastur, monitores credenciados PESM.

O site vende duas coisas: **expedições** (trilha, rapel, tirolesa, escalaminhada) e
**Caqui Wear** (roupas e acessórios da marca).

> **O site não processa pagamento.** A pessoa monta um carrinho e clica em finalizar,
> que abre o WhatsApp com o pedido escrito. A venda fecha na conversa. Não existe
> checkout, pedido, gateway, frete, cupom nem estoque — e isso é decisão de produto,
> não escopo pendente.

---

## Stack

| Camada    | Escolha                                          |
| --------- | ------------------------------------------------ |
| Framework | Next.js 16.3 (App Router)                        |
| Linguagem | TypeScript, `strict`                             |
| UI        | React 19.2 + Tailwind CSS 4                      |
| Banco     | PostgreSQL 16                                    |
| ORM       | Prisma 7.9 (driver adapter `@prisma/adapter-pg`) |
| Validação | Zod 4                                            |
| Qualidade | ESLint 9 + Prettier 3                            |

A escolha da stack está justificada em [`docs/00-analise-dalia.md`](docs/00-analise-dalia.md),
seção 10.1.

---

## Pré-requisitos

- **Node.js 22+** — o projeto foi desenvolvido em v26
- **PostgreSQL 16** rodando localmente

No macOS com Homebrew:

```bash
brew install postgresql@16 && brew services start postgresql@16
```

---

## Setup local

**1. Instale as dependências** (o `postinstall` gera o cliente Prisma automaticamente):

```bash
npm install
```

**2. Crie os bancos:**

```bash
createdb caqui_trekking_dev && createdb caqui_trekking_test
```

**3. Configure o ambiente:**

```bash
cp .env.example .env
```

Abra o `.env` e ajuste a `DATABASE_URL` com o seu usuário do Postgres.
**Nenhuma variável tem valor padrão no código** — se faltar alguma, a aplicação não sobe e
diz exatamente qual falta. Isso é intencional (ver `src/lib/env.ts`).

**4. Suba o servidor:**

```bash
npm run dev
```

**5. Confirme que está tudo de pé:**

```bash
curl http://localhost:3000/api/health
```

Resposta esperada — HTTP 200:

```json
{
  "status": "ok",
  "ambiente": "development",
  "servicos": {
    "app": { "status": "ok" },
    "banco": { "status": "ok", "latenciaMs": 67 }
  }
}
```

Se o banco estiver fora, o mesmo endpoint responde **503** com `status: "erro"` — o health
check não mente sobre o estado real. O detalhe técnico da falha vai para o log do servidor,
nunca para a resposta.

---

## Comandos

| Comando                           | O que faz                                                          |
| --------------------------------- | ------------------------------------------------------------------ |
| `npm run dev`                     | Servidor de desenvolvimento                                        |
| `npm run build`                   | Build de produção                                                  |
| `npm run start`                   | Serve o build                                                      |
| `npm run check`                   | **lint + typecheck + format + testes** — rode antes de todo commit |
| `npm test` / `test:watch`         | Testes de integração (banco `caqui_trekking_test`)                 |
| `npm run db:test:setup`           | Aplica as migrations no banco de teste                             |
| `npm run lint` / `lint:fix`       | ESLint                                                             |
| `npm run typecheck`               | `tsc --noEmit`                                                     |
| `npm run format` / `format:check` | Prettier                                                           |
| `npm run db:migrate`              | Cria e aplica migration (dev)                                      |
| `npm run db:deploy`               | Aplica migrations pendentes (produção)                             |
| `npm run db:generate`             | Regenera o cliente Prisma                                          |
| `npm run db:studio`               | Prisma Studio                                                      |

---

## Fases do projeto

**Fase A — Backend** _(banco e API fechados antes de encostar no frontend)_

- [x] **00** — Análise do projeto de referência → [`docs/00-analise-dalia.md`](docs/00-analise-dalia.md)
- [x] **01** — Bootstrap → [`docs/01-estrutura.md`](docs/01-estrutura.md)
- [x] **02** — Schema e seed → [`docs/02-modelagem.md`](docs/02-modelagem.md)
- [x] **03** — API do catálogo → [`docs/03-api.md`](docs/03-api.md)
- [ ] **04** — Auth e API do CRM
- [ ] **05** — Mídia e uploads

**Fase B — Frontend** _(só começa com a Fase A validada)_

- [ ] **06** — Design system · **07** — Shell e navegação · **08** — Catálogo Trekking
- [ ] **09** — Caqui Wear, carrinho e handoff pro WhatsApp
- [ ] **10** — CRM · **11** — SEO, performance e deploy

---

## Convenções que não se negociam

Todas vêm de um problema medido no projeto de referência. O contexto completo de cada uma
está em [`docs/00-analise-dalia.md`](docs/00-analise-dalia.md).

1. **Dinheiro é `Int` de centavos.** Nunca float. No projeto de referência, o helper de
   arredondamento errava sistematicamente acima de R$ 8.192 — 11.470 falhas em 199.999 casos
   testados. O ESLint bloqueia `toFixed` para forçar o helper único de moeda.
2. **Datas em UTC no banco, exibidas em `America/Sao_Paulo`.** No Dália, `grep timeZone`
   retornava zero e a formatação dependia do fuso do aparelho. Aqui a data **é** o produto:
   errar o dia da saída não é cosmético.
3. **O servidor recalcula todo valor.** O cliente manda `[{ departureId, qty }]`; o backend
   devolve preço e total. O carrinho em `localStorage` guarda apenas referência e quantidade —
   **nunca preço, nome ou disponibilidade.**
4. **Nenhuma variável de ambiente tem fallback.** Faltou, o processo não sobe.
5. **Os 5 toques na logo apenas revelam a rota do CRM.** Não são autenticação. A proteção
   real é middleware no backend, em toda rota — como se houvesse um link "Entrar" no menu.
6. **`.env` nunca é commitado.** O `.env.example` sempre é.

---

## Documentação

| Documento                                              | Conteúdo                                                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| [`docs/00-analise-dalia.md`](docs/00-analise-dalia.md) | Análise do projeto de referência: stack, modelagem, carrinho, auth, imagens, SEO, e as decisões arquiteturais que saíram dela |
| [`docs/01-estrutura.md`](docs/01-estrutura.md)         | Estrutura de pastas e a convenção por trás dela                                                                               |
| [`docs/02-modelagem.md`](docs/02-modelagem.md)         | Trip vs Departure, disponibilidade manual, MediaAsset, e o bug de fuso que o seed revelou                                     |
| [`docs/03-api.md`](docs/03-api.md)                     | Os 11 endpoints públicos, códigos de erro e o contrato de `POST /api/cart/validate`                                           |
