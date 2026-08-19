-- =============================================================================
-- VAGAS E FECHAMENTO DE SAÍDA
-- =============================================================================
-- A disponibilidade deixa de ser um campo digitado à mão e passa a ser uma
-- conta sobre dois números que o operador já anotava de qualquer jeito.
--
-- O comentário do schema descrevia `availability` como "o campo mais mexido do
-- sistema". Campo mais mexido do sistema é a descrição de uma conta que alguém
-- está fazendo de cabeça, várias vezes por semana, sem rede.
-- =============================================================================

-- ── Capacidade e livro de vagas ──────────────────────────────────────────────
ALTER TABLE "departures" ADD COLUMN "capacity" INTEGER;
ALTER TABLE "departures" ADD COLUMN "seatsTaken" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "departures" ADD COLUMN "lastSpotsAt" INTEGER NOT NULL DEFAULT 3;

-- ── Fechamento, preenchido depois de a saída acontecer ───────────────────────
ALTER TABLE "departures" ADD COLUMN "closedAt" TIMESTAMPTZ(3);
ALTER TABLE "departures" ADD COLUMN "attendeeCount" INTEGER;
ALTER TABLE "departures" ADD COLUMN "revenueCents" INTEGER;
ALTER TABLE "departures" ADD COLUMN "costCents" INTEGER;
ALTER TABLE "departures" ADD COLUMN "closingNotes" TEXT;

-- ── A exceção declarada ──────────────────────────────────────────────────────
ALTER TABLE "departures" ADD COLUMN "availabilityOverride" "Availability";

-- A MIGRAÇÃO DO DADO, e ela não é uma cópia cega.
--
-- `AVAILABLE` era o estado "nada de especial": é exatamente o que a conta
-- devolve quando há vaga sobrando, e é o padrão da coluna antiga. Copiá-lo para
-- a exceção transformaria TODA saída já cadastrada em exceção permanente, e a
-- contagem de vagas nunca mais valeria para nenhuma delas.
--
-- `LAST_SPOTS` e `SOLD_OUT` eram decisões humanas de verdade: alguém abriu o
-- CRM e marcou. Essas viram exceção declarada, que é o que elas sempre foram.
UPDATE "departures"
SET "availabilityOverride" = "availability"
WHERE "availability" <> 'AVAILABLE';

-- A COLUNA VELHA FICA. De propósito.
--
-- O build da Vercel roda `prisma migrate deploy` ANTES de trocar o código no
-- ar (vercel-build: "prisma migrate deploy && next build"). Se essa migração
-- derrubasse `availability` aqui, e o `next build` falhasse por qualquer
-- motivo depois, o código ANTIGO ficaria servindo tráfego contra um banco sem
-- a coluna que ele lê em `SELECT_DEPARTURE_PUBLICA` — inclusive na validação
-- de carrinho/checkout — sem rollback automático possível (Vercel reverte
-- código, não schema).
--
-- `availability` não é mais lida por nenhum caminho do código novo (a conta
-- virou `disponibilidade`, calculada a partir de `seatsTaken`/`capacity`).
-- Mantê-la parada não custa nada e não atrapalha ninguém. Ela sai numa
-- migração separada, futura, só depois que este deploy estiver confirmado
-- estável em produção.
-- DROP INDEX IF EXISTS "departures_availability_idx";
-- ALTER TABLE "departures" DROP COLUMN "availability";

-- ── Integridade que a tela não pode garantir sozinha ─────────────────────────
-- Vaga negativa e capacidade zero não são estados possíveis do negócio.
-- Overbooking (`seatsTaken` > `capacity`) É possível e continua permitido: dois
-- guias vendendo ao mesmo tempo acontece, e um banco que recusa o lançamento
-- faz a pessoa mentir o número para conseguir salvar.
ALTER TABLE "departures" ADD CONSTRAINT "departures_seatsTaken_nao_negativo" CHECK ("seatsTaken" >= 0);
ALTER TABLE "departures" ADD CONSTRAINT "departures_capacity_positiva" CHECK ("capacity" IS NULL OR "capacity" > 0);
ALTER TABLE "departures" ADD CONSTRAINT "departures_lastSpotsAt_nao_negativo" CHECK ("lastSpotsAt" >= 0);
ALTER TABLE "departures" ADD CONSTRAINT "departures_attendeeCount_nao_negativo" CHECK ("attendeeCount" IS NULL OR "attendeeCount" >= 0);
-- Receita e custo podem ser zero; negativo é erro de digitação, não estorno.
ALTER TABLE "departures" ADD CONSTRAINT "departures_revenueCents_nao_negativa" CHECK ("revenueCents" IS NULL OR "revenueCents" >= 0);
ALTER TABLE "departures" ADD CONSTRAINT "departures_costCents_nao_negativo" CHECK ("costCents" IS NULL OR "costCents" >= 0);

-- ── A fila do fechamento ─────────────────────────────────────────────────────
-- Saída publicada, com data no passado e sem `closedAt`. É a consulta que o
-- painel faz toda vez que abre, e ela precisa ser uma busca que volta vazia.
CREATE INDEX "departures_status_closedAt_startAt_idx" ON "departures"("status", "closedAt", "startAt");
