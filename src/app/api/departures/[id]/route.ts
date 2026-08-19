import { limitarLeituraPublica } from '@/lib/api/rate-limit'
import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { idSchema } from '@/lib/api/schemas'
import { buscarDeparturePorId } from '@/server/services/departure-service'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ id: string }> }

/**
 * GET /api/departures/:id
 *
 * Id malformado é 400 `VALIDATION_FAILED`, não 500. No projeto de referência,
 * um id inválido virava 500 com a mensagem crua do driver do banco.
 */
export const GET = rota(async (request: Request, contexto: Contexto) => {
  limitarLeituraPublica(request, 'departure')

  const { id } = await contexto.params
  const idValido = validarOuFalhar(idSchema.safeParse(id))

  const saida = await buscarDeparturePorId(idValido)

  return ok(saida, { cache: { sMaxAge: 60, staleWhileRevalidate: 300 } })
})
