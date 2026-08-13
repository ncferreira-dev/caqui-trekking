import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Cria o driver adapter do Postgres com a sessão FIXADA EM UTC.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE O `-c TimeZone=UTC` NÃO É OPCIONAL
 * ────────────────────────────────────────────────────────────────────────────
 * Sem ele, o instante gravado fica 3 horas errado — e o erro é invisível pela
 * aplicação, que é o que o torna perigoso.
 *
 * Medido neste projeto, com a sessão do Postgres herdando `America/Sao_Paulo`
 * da máquina:
 *
 *   quis gravar        2026-08-15T09:00:00Z   (06:00 em São Paulo)
 *   gravado no banco   2026-08-15T12:00:00Z   ← 3 horas à frente
 *   lido pelo Prisma   2026-08-15T09:00:00Z   ← o desvio inverso, na leitura
 *
 * O Prisma aplica o mesmo desvio nas duas pontas, então ele é autoconsistente
 * e nada quebra visivelmente. Mas o valor no banco está errado: qualquer coisa
 * que leia por SQL — relatório, job de sitemap, feed, um `psql` de plantão, um
 * segundo serviço — enxerga a saída três horas depois do horário real.
 *
 * Para a Caqui isso não é detalhe cosmético: a data e a hora de encontro SÃO o
 * produto. Uma saída de nascer do sol às 03:00 vira 06:00 no relatório, e o
 * grupo perde o nascer do sol.
 *
 * Com a sessão em UTC, escrita e leitura passam a concordar com o banco.
 * Verificado com o driver `pg` puro, fora do Prisma.
 */
export function createPgAdapter(connectionString: string): PrismaPg {
  return new PrismaPg({
    connectionString,
    options: '-c TimeZone=UTC',
  })
}
