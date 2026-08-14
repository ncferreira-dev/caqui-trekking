import { z } from 'zod'

import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { idSchema } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { duplicarSaida } from '@/server/services/admin/departure-admin-service'
import { ipDaRequest } from '@/server/services/audit-service'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ id: string }> }

const corpoSchema = z
  .object({
    /** Omitido = usa a data equivalente sugerida no mês seguinte. */
    novaData: z.coerce.date().optional(),
  })
  .strict()

/**
 * POST /api/admin/departures/:id/duplicate
 *
 * A operação mais repetida do sistema: a Caqui abre a agenda do mês seguinte a
 * cada virada de mês. Precisa ser um clique.
 *
 * Sem corpo, a data sugerida é a **equivalente**: mesmo dia da semana, mesma
 * posição no mês. "3º sábado de agosto" → "3º sábado de setembro", e não
 * "+30 dias", que jogaria um sábado numa segunda — e a Caqui só opera em fim
 * de semana. O horário local é preservado.
 *
 * A cópia nasce em DRAFT e com disponibilidade AVAILABLE. Herdar SOLD_OUT da
 * saída anterior seria o pior default possível: a agenda nova apareceria
 * esgotada.
 */
export const POST = rota(async (request: Request, contexto: Contexto) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const { id } = await contexto.params
  const departureId = validarOuFalhar(idSchema.safeParse(id))

  const corpo: unknown = await request.json().catch(() => ({}))
  const { novaData } = validarOuFalhar(corpoSchema.safeParse(corpo ?? {}))

  const nova = await duplicarSaida(departureId, novaData, {
    userId: usuario.userId,
    ip: ipDaRequest(request),
  })

  return ok(nova)
})
