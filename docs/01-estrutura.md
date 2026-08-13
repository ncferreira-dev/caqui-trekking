# 01 — Estrutura de pastas

> Fase A, PROMPT 01. Só infraestrutura: zero domínio, zero UI além do health check.
> As decisões abaixo derivam de [`00-analise-dalia.md`](./00-analise-dalia.md) — cada uma
> corrige um problema concreto medido no projeto de referência.

---

## A árvore

```
caqui-trekking/
├── prisma/
│   ├── schema.prisma          # generator + datasource. Sem model ainda (PROMPT 02)
│   └── migrations/            # criado na primeira migration
├── prisma.config.ts           # Prisma 7: a connection string vive AQUI, não no schema
├── docs/
│   ├── 00-analise-dalia.md    # análise do projeto de referência
│   └── 01-estrutura.md        # este arquivo
├── public/
├── src/
│   ├── app/
│   │   ├── (loja)/            # rotas públicas — catálogo, agenda, carrinho
│   │   ├── (crm)/             # painel administrativo
│   │   ├── api/
│   │   │   └── health/route.ts
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   └── ui/                # primitivos SEM domínio (Button, Input, Modal…)
│   ├── lib/
│   │   ├── env.ts             # validação das variáveis de ambiente no boot
│   │   └── prisma.ts          # cliente Prisma singleton
│   ├── server/
│   │   └── services/          # lógica de domínio — a camada que o Dália acertou
│   └── generated/prisma/      # cliente gerado (NÃO versionado)
├── .env                       # NUNCA versionado
├── .env.example               # versionado, comentado por categoria
└── .claude/launch.json        # config do dev server
```

---

## A convenção, e o que a justifica

### 1. Separação física entre loja e CRM, na raiz da árvore

`src/app/(loja)/` e `src/app/(crm)/` são route groups — os parênteses não entram na URL,
mas separam os dois públicos fisicamente, com layouts independentes.

**Por quê:** no Dália, `pages/` despejava as 10 telas do painel junto com as 7 da loja, sem
nenhuma separação. Medido: **~10.294 de 16.952 linhas do `src/` eram CRM (61%)**, e como não
havia uma única ocorrência de `React.lazy` em todo o projeto, **tudo isso ia no mesmo bundle
de 811 KB que a visitante da loja baixava** para ver um brinco.

Para a Caqui isso seria pior que desperdício: o CRM é revelado por 5 toques na logo. **Se o
código dele está no bundle público, você entrega ao mundo exatamente aquilo que o gesto
secreto deveria esconder.** Com route groups, o Next separa os chunks por padrão.

A regra que decorre disso, e que deve ser respeitada em code review:
**`(loja)/` nunca importa de `(crm)/`.**

### 2. `components/ui/` só para primitivo sem domínio

`Button`, `Input`, `Modal`, `Badge`. Componente **com** domínio (`CardDeSaida`,
`SeletorDeDeparture`) mora ao lado da feature que o usa.

**Por quê:** o Dália dividia `components/` por forma visual — `layout`, `modules`,
`navigation`, `ui`, `skeletons`. O critério não sobreviveu ao próprio código: `ui/Charts.jsx`
eram 163 linhas de gráfico usadas só pela tela de relatórios, e `layout/` guardava o `Header`
da loja ao lado do `AdminHeader` do painel. Nada na árvore dizia a que público um arquivo
pertencia.

### 3. `server/services/` — a camada que o Dália acertou

Route handlers e server actions são a borda HTTP: validam entrada, chamam um service,
devolvem resposta. **Nenhuma regra de negócio dentro deles.**

**Por quê:** essa é a peça mais bem resolvida do projeto de referência — 9 de 10 controllers
respeitavam a camada de service. Onde ela vazou, doeu: o `feed-controller.js` tinha 144
linhas das quais só ~35 eram HTTP, e o identificador público de produto era gerado com
`Math.random()` dentro do controller.

### 4. `lib/env.ts` é a única porta para `process.env`

Nenhum outro arquivo lê `process.env` diretamente. O `env.ts` valida tudo com Zod no boot e
**derruba o processo com mensagem legível** se faltar alguma variável.

**Por quê:** o Dália tinha `const JWT_SECRET = process.env.JWT_SECRET || 'production'`. Se a
variável faltasse no deploy, a API subia normalmente assinando tokens com um segredo que está
no código-fonte — e nada no log indicava isso. Qualquer pessoa com acesso ao repositório
forjava um token administrativo válido com uma linha.

**Zero fallback. Um app que sobe com segredo default é pior que um app que não sobe.**

Verificado: com `DATABASE_URL` vazia, a aplicação responde 500 e imprime qual variável falta
e por quê, em vez de subir quebrada.

### 5. `lib/prisma.ts` é singleton

**Por quê:** sem o cache no `globalThis`, o hot reload do Next cria um `PrismaClient` novo a
cada alteração, cada um com seu pool. Em poucos minutos o Postgres recusa conexão com
"too many clients already" — e o sintoma (o app "para sozinho") não aponta para a causa.

### 6. Nomes de código em inglês; conteúdo em português

`Trip`, `Departure`, `priceCents`, `availability`. Texto exibido, em pt-BR.

**Por quê:** o Dália tinha `name`, `price`, `stock` ao lado de `custo`, `custoEmbalagem`,
`hipoalergenico` e `dalia_id` — **três convenções dentro do mesmo documento de 30 linhas**.
O domínio da Caqui já nasceu em inglês no briefing (Trip/Departure/AVAILABLE/LAST_SPOTS),
então misturar agora repetiria a fratura. O que não pode existir é o meio-termo.

---

## Divergências conscientes em relação ao PROMPT 01

| Item do prompt                                                 | O que foi feito                                                                              | Motivo                                                                                                                                                                                                                                               |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "docker-compose com Postgres 16 e volume nomeado"              | **Postgres 16.14 local (Homebrew)**                                                          | Docker não está instalado na máquina; o Postgres 16 já estava rodando. Decisão sua. Se o projeto ganhar mais de um dev, o `docker-compose` volta — e aí com volume nomeado, como o prompt pede.                                                      |
| "Mesma stack do Dália, salvo onde o doc 00 justificar mudança" | **Next.js 16 + Postgres + Prisma + TypeScript**, em vez de Vite SPA + Express + MongoDB + JS | O doc 00 justifica em 10.1, com cinco razões. A mais decisiva: SSR elimina as 241 linhas do `prerender.js` do Dália e os três furos dele, e o preview de link no WhatsApp — que é a peça de venda da Caqui — passa a funcionar sem engenharia extra. |

---

## Estado da Fase A

- [x] **PROMPT 00** — análise do Dália → `docs/00-analise-dalia.md`
- [x] **PROMPT 01** — bootstrap → este documento
- [ ] **PROMPT 02** — schema e seed _(o schema.prisma ainda não tem nenhum model)_
- [ ] **PROMPT 03** — API do catálogo
- [ ] **PROMPT 04** — auth e API do CRM
- [ ] **PROMPT 05** — mídia e uploads
