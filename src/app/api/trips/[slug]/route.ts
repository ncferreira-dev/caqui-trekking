import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { slugSchema } from '@/lib/api/schemas'
import { buscarTripPorSlug } from '@/server/services/trip-service'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ slug: string }> }

/**
 * GET /api/trips/:slug
 *
 * Detalhe do roteiro com as saídas futuras publicadas e os guias
 * responsáveis. 404 com `TRIP_NOT_FOUND` quando não existe ou não está
 * publicado.
 */
export const GET = rota(async (_request: Request, contexto: Contexto) => {
  const { slug } = await contexto.params
  const slugValido = validarOuFalhar(slugSchema.safeParse(slug))

  const trip = await buscarTripPorSlug(slugValido)

  return ok(trip, { cache: { sMaxAge: 60, staleWhileRevalidate: 300 } })
})
