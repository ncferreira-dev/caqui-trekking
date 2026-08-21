# 11 — SEO, performance e deploy

> Fase B, PROMPT 11. O fechamento: dados estruturados, metadata, analytics e a
> ida para produção. Este documento é o procedimento de deploy e de rollback.

---

## O que já está no ar (no código)

| Entrega                                                                     | Onde                                            |
| --------------------------------------------------------------------------- | ----------------------------------------------- |
| JSON-LD (`LocalBusiness`, `Event`, `Product`, `BreadcrumbList`, `ItemList`) | `src/lib/seo/json-ld.ts`                        |
| Sitemap dinâmico                                                            | `src/app/sitemap.ts`                            |
| robots.txt                                                                  | `src/app/robots.ts`                             |
| Metadata base, Open Graph e canônica por página                             | `src/app/layout.tsx`, `src/lib/seo/metadata.ts` |
| Vercel Analytics + eventos de conversão                                     | `src/app/layout.tsx`, `src/lib/analytics.ts`    |

O **Open Graph com imagem** e o **upload de fotos** ficam de fora até o
Cloudinary ter credencial — ver a seção "Bloqueios" no fim.

---

## Pré-requisitos (o que exige uma conta, e não código)

### 1. Banco de produção

O Postgres de desenvolvimento é local e a Vercel não o enxerga. Antes do deploy
existe um banco hospedado, e a `DATABASE_URL` dele entra nas variáveis do
projeto na Vercel — **nunca no repositório**.

Decisão tomada: **Neon**, provisionado pela própria Vercel (Storage → Create →
Neon Postgres). Ele injeta a `DATABASE_URL` no projeto sozinho.

### 2. Cloudinary

As três variáveis (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
`CLOUDINARY_API_SECRET`) vêm do Dashboard do Cloudinary. São **opcionais em
conjunto**: sem elas o site sobe e funciona, só o upload de imagem responde 503.
Com elas, a galeria e o Open Graph com foto destravam.

### 3. As variáveis de ambiente na Vercel

Project → Settings → Environment Variables. Todas em **Production** (e
**Preview**, se quiser testar antes):

| Variável                                             | Valor                                                                        |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| `DATABASE_URL`                                       | injetada pelo Neon, ou colada à mão                                          |
| `NODE_ENV`                                           | `production`                                                                 |
| `NEXT_PUBLIC_SITE_URL`                               | o domínio real, **sem barra final** (ex.: `https://caquitrekking.com.br`)    |
| `AUTH_SECRET`                                        | gere um novo, **diferente do de desenvolvimento**: `openssl rand -base64 48` |
| `SEED_OWNER_EMAIL`                                   | o e-mail da dona                                                             |
| `SEED_OWNER_PASSWORD`                                | uma senha forte, só para o primeiro acesso                                   |
| `CLOUDINARY_CLOUD_NAME` · `_API_KEY` · `_API_SECRET` | do Cloudinary, ou as três em branco                                          |

> `NEXT_PUBLIC_SITE_URL` errado é o erro que passa despercebido: o site sobe, mas
> canônica, sitemap e o preview de link no WhatsApp apontam para `localhost` ou
> para o domínio `.vercel.app` de teste. Confira este valor antes de divulgar.

---

## O procedimento de deploy

O build de produção roda `vercel-build` (`package.json`), que é
`prisma migrate deploy && next build`: aplica as migrações pendentes no banco de
produção **antes** de compilar. É `migrate deploy`, não `migrate dev` — ele só
aplica o que já existe em `prisma/migrations`, nunca cria migração nova nem
apaga dados.

1. **Vincular o projeto:** `vercel link` (ou conectar o repositório do GitHub no
   painel da Vercel — o caminho recomendado, porque dá deploy a cada push).
2. **Provisionar o Neon** pelo painel (Storage) e confirmar que a `DATABASE_URL`
   entrou nas variáveis.
3. **Preencher as demais variáveis** da tabela acima.
4. **Primeiro deploy em Preview:** `vercel` (sem `--prod`). Sai numa URL
   `*.vercel.app` de teste, já com o banco de produção. O `vercel-build` aplica
   as migrações no primeiro deploy — o banco novo nasce vazio e as migrações o
   estruturam.
5. **Semear o primeiro usuário e o conteúdo:** com a `DATABASE_URL` de produção
   no ambiente, `npx prisma db seed`. Isso cria a dona (OWNER) e o catálogo
   inicial. **Rode uma vez só** — a seed usa chaves naturais e não duplica, mas
   confira antes.
6. **Conferir o Preview:** abrir a URL, testar login no `/crm`, ver a agenda,
   finalizar um pedido de teste no WhatsApp.
7. **Promover para produção:** `vercel --prod`, ou promover o deploy no painel.
8. **Domínio:** Project → Domains, apontar o domínio real e deixar a Vercel
   emitir o SSL. Configurar o redirect de `www` → apex (ou o contrário), um só
   canônico. Atualizar `NEXT_PUBLIC_SITE_URL` para o domínio final e
   **redeployar** — a variável é lida no build.

---

## Rollback

A Vercel guarda todo deploy anterior imutável. Reverter o **código** é instantâneo
e não toca no banco:

1. Project → Deployments, achar o último deploy bom.
2. **Promote to Production** nele. O tráfego volta na hora.

O que **não** volta sozinho é o **banco**: uma migração que rodou continua
aplicada depois do rollback do código. Por isso:

- Toda migração destrutiva (dropar coluna, renomear) precisa ser compatível com
  a versão anterior do código por um deploy — a regra de "expand, migrate,
  contract". Nunca dropar e trocar o código no mesmo deploy.
- Antes de uma migração de risco, **backup do banco**. No Neon, o
  point-in-time-restore cobre isso; confirme a janela de retenção do plano.

---

## Monitoramento e backup

- **Erro em runtime:** os logs da Vercel (Project → Logs) mostram o `requestId`
  que o `route-handler` emite em todo 500 — o mesmo id que o cliente recebe, para
  cruzar o relato com o log.
- **Backup do banco:** Neon faz snapshot contínuo. Confirme a retenção e, se o
  plano for o gratuito, considere um `pg_dump` agendado à parte para os dados que
  não podem sumir (saídas, produtos, mensagens de contato).
- **Analytics:** o painel da Vercel mostra Web Vitals reais e os eventos
  `adicionar_a_mochila` e `finalizar_no_whatsapp` assim que houver tráfego.

---

## Bloqueios que dependem do cliente, não de código

1. ~~**Cloudinary**~~ — resolvido em 21/08/2026. Conta própria da Caqui (não a
   do projeto de referência), as três variáveis no `.env` local e em
   Production e Preview na Vercel. **Elas só valem a partir do próximo
   deploy:** variável nova não entra num build que já aconteceu.
2. **Fotos de expedição** — nenhuma foi entregue; a loja usa o grafismo da serra
   no lugar. Ver `docs/10-crm.md`.
3. **Domínio e hospedagem** — quem registra, quem paga, quem renova.
4. **Conteúdo real** — descrições, números de Cadastur e PESM, política de
   cancelamento. O CRM já edita tudo isso (ver `docs/10-crm.md`); falta o texto.

---

## Checklist antes de divulgar o link

- [ ] `NEXT_PUBLIC_SITE_URL` é o domínio real, sem barra final
- [ ] `AUTH_SECRET` de produção é diferente do de desenvolvimento
- [ ] `SEED_OWNER_PASSWORD` foi trocada depois do primeiro login
- [ ] Login no `/crm` funciona no domínio final
- [ ] `robots.txt` e `sitemap.xml` abrem no domínio final
- [ ] Um pedido de teste abre o WhatsApp com a mensagem certa
- [ ] Redirect de `www` resolve para um canônico só
