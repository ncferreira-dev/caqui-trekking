# Relatório da Fase A — estado do backend

> Fecha os PROMPTs 01 a 05. Escrito para ser lido antes de começar a Fase B.

---

## O que existe

|                            |                                                        |
| -------------------------- | ------------------------------------------------------ |
| Rotas de API               | **30** (13 públicas, 14 administrativas, auth, health) |
| Models / enums             | 15 / 7                                                 |
| Migrations                 | 2, com CHECK constraints escritos à mão                |
| Serviços                   | 13                                                     |
| Testes                     | **110**, todos passando                                |
| Linhas de TypeScript nosso | ~7.750 (fora o cliente gerado pelo Prisma)             |
| Documentos                 | 6, em `docs/`                                          |

`npm run check` roda lint + typecheck + formatação + testes. Verde.
`npm run build` compila e lista as 30 rotas.

### Por prompt

|        | Entrega                                                                           | Doc                |
| ------ | --------------------------------------------------------------------------------- | ------------------ |
| **01** | Next 16 + Postgres 16 + Prisma 7 + TS estrito; env validado no boot, sem fallback | `01-estrutura.md`  |
| **02** | Schema, migration com CHECKs, seed idempotente                                    | `02-modelagem.md`  |
| **03** | API pública do catálogo e revalidação de carrinho                                 | `03-api.md`        |
| **04** | Autenticação, 10 rotas de CRM, auditoria                                          | `04-permissoes.md` |
| **05** | Upload, galeria, tags, importação em lote                                         | `05-midia.md`      |

---

## O que foi verificado, não só escrito

Cada item abaixo tem teste correspondente.

**Dinheiro** — `Int` de centavos em todo lugar; o ESLint recusa `toFixed`, sem
escapatória. No projeto de referência o helper de arredondamento errava
sistematicamente acima de R$ 8.192.

**Fuso** — a sessão do Postgres é forçada a UTC no adapter
(`src/lib/db-adapter.ts`). Sem isso, o instante gravado ficava 3 horas adiante
para qualquer consumidor SQL — relatório, sitemap, feed, JSON-LD — e o erro era
invisível pela aplicação, porque o Prisma aplicava o deslocamento inverso na
leitura.

**`internalNotes` nunca vaza** — duas camadas: o `select` não busca, e o mapper
é lista de permissão. Há um teste companheiro provando que o dado _está_ no
banco, para o primeiro não passar por vacuidade.

**Carrinho não confia no cliente** — preço sempre do banco. Cliente alegando
R$ 1,00 numa saída de R$ 90,00 recebe de volta `precoCentavos: 9000`,
`motivo: PRICE_CHANGED`, `podeFinalizar: false`.

**Sessão** — cookie `httpOnly` + `SameSite=strict`, 8 h, e o `tokenVersion` faz
"Sair" invalidar no servidor. 5 erros de senha travam a conta por 15 min **no
banco**, e durante o bloqueio nem a senha certa passa. E-mail inexistente
devolve resposta idêntica, gastando o mesmo tempo.

**Toda rota admin exige sessão** — teste que percorre o diretório, importa cada
`route.ts` e exige 401. Rota nova sem guard quebra a suíte sozinha. Foi ele que
cobriu as 5 rotas do PROMPT 05 sem eu escrever nada.

**Imagem apagada some dos dois lados** — e, se o storage recusar, o registro
**não** some do banco.

---

## O que NÃO existe, de propósito

Não é dívida. É escopo.

- **Pagamento.** Nenhum checkout, gateway, pedido, frete, cupom. O carrinho
  monta uma mensagem e abre o WhatsApp; a venda fecha na conversa.
- **Estoque.** Disponibilidade é manual — `AVAILABLE`, `LAST_SPOTS`,
  `SOLD_OUT` —, sem contagem. O projeto de referência tinha decremento
  automático desligado por flag e um método dormente que nunca rodou.
- **Página por saída.** `Departure` não tem URL própria: 12 saídas do mesmo
  roteiro seriam 12 páginas quase idênticas se canibalizando no Google.
- **Estado "encerrada".** É derivado de `startAt < now()`. Um campo gravado
  exigiria alguém atualizando toda semana, e a primeira vez que esquecessem o
  site mentiria.

---

## Dívida técnica consciente

Ordenada por quando precisa ser paga.

### 1. Rate limit por IP vive na memória do processo — pagar no deploy

Em serverless, o limite efetivo vira `limite × instâncias`, e um restart zera o
contador.

O bloqueio por conta (esse sim no banco) cobre o caso crítico, que é força
bruta no login. O que fica descoberto é abuso genérico das rotas públicas.

**Como pagar:** contador compartilhado (Upstash Redis ou equivalente), no
PROMPT 11. A interface em `src/lib/api/rate-limit.ts` já isola isso.

### 2. `onDelete: Cascade` pode gerar arquivo órfão — mitigado, não resolvido

Apagar um Trip ou Product **de verdade** apaga as linhas de `media_assets` em
cascata, e o provedor não fica sabendo.

Hoje isso não acontece: o projeto só arquiva (soft delete). Mas "hoje não
acontece" não é garantia, e o custo de um vazamento é permanente.

**Mitigação atual:** `npm run media:orfaos` compara os dois lados e lista.
**Como pagar:** rodar o script no fim de cada mês, ou mover a remoção para um
hook de exclusão. Enquanto não houver hard delete, o script basta.

### 3. Sem refresh token

A sessão dura 8 h e expira. Não há renovação silenciosa. Para um CRM operado em
turnos é aceitável, e menos superfície é menos coisa para errar.

### 4. Sem troca nem recuperação de senha

O OWNER cria usuários com senha definida. "Esqueci minha senha" exige envio de
e-mail, que não estava no escopo da Fase A.

**Consequência prática:** se a Caqui esquecer a senha do OWNER, hoje a saída é
rodar um script. Vale resolver antes de entregar o CRM.

### 5. HEIC entra sem `blurDataUrl`

O binário do `sharp` lê o cabeçalho mas não decodifica os pixels. A UI cai no
fundo sólido. Detalhado em `05-midia.md`.

**Como pagar, se incomodar:** buscar uma miniatura derivada do provedor depois
do upload. Um GET pequeno, ~10 linhas.

### 6. Sem CRUD de produto e de guia nas rotas admin

Existe update de Trip, toggle de variante, tudo de saída, mídia e tags. **Criar
produto, criar guia e criar Trip do zero** ainda não têm rota — o seed cobriu o
catálogo inicial.

**Quando pagar:** junto da tela correspondente do CRM, na Fase B. Cadastrar às
cegas uma rota que ninguém vai chamar é o tipo de previdência que vira código
morto.

### 7. Cliente Prisma logando query em desenvolvimento

Polui a saída dos scripts de CLI. Cosmético; anotado para não ser esquecido.

---

## Uma decisão que precisa ser sua antes da Fase B

**Como uma foto diz de que cor ela é?**

O material real da Caqui tem uma foto **por cor**: baby look fúcsia, laranja,
cinza prata; camiseta azul, azul marinho, cinza chumbo. O catálogo modela cor
como **variante de um produto só** — `baby-look-dry-fit-caqui` com várias
`ProductVariant`.

Hoje `MediaAsset` pertence a `Product`, não a `ProductVariant`. Então a galeria
do baby look guarda as três cores **sem saber qual é qual**. Quando o cliente
clicar em "fúcsia" na página do produto (PROMPT 09), não há como trocar a foto.

É exatamente a armadilha do projeto de referência em roupa nova: lá,
`imagesGoldCount` resolvia isso por posição, sem declarar em lugar nenhum, e
apagar uma foto no meio fazia o seletor mostrar a cor errada — até um cliente
reclamar que recebeu a peça errada.

Três saídas:

|                                                          | O que muda                                                                | Custo | Risco                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------- |
| **A. Campo `colorName` em `MediaAsset`** _(recomendada)_ | migration aditiva, validado contra as cores do produto                    | baixo | vínculo por texto, precisa de validação                                    |
| **B. FK para `ProductVariant`**                          | mais um dono possível; o CHECK "exatamente um dono" precisa ser reescrito | médio | uma cor tem várias variantes (P, M, G) — a foto ficaria presa a um tamanho |
| **C. Um produto por cor**                                | nenhum código muda                                                        | zero  | infla o catálogo e quebra o seletor de cor da página de produto            |

Recomendo **A**. Mas é decisão de produto, e a hora de tomar é agora: ela muda
o schema, e schema depois de ter dado em produção custa mais.

Enquanto não decidir, a importação em lote funciona renomeando os arquivos para
os slugs que já existem no catálogo — as fotos entram na galeria certa, só sem
associação de cor.

---

## Para rodar

```bash
npm run check     # lint + typecheck + formatação + 110 testes
npm run build     # compila e lista as 30 rotas
npm run dev
```

Antes do primeiro `npm run dev`: `cp .env.example .env` e preencher. O processo
não sobe com variável faltando, e a mensagem diz qual.

Cloudinary é opcional para desenvolver — só o upload precisa dele.
