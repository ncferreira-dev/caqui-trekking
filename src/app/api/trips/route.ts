import type { NextRequest } from 'next/server'

import { limitarLeituraPublica } from '@/lib/api/rate-limit'
import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { filtrosTripSchema, queryParaObjeto } from '@/lib/api/schemas'
import { listarTrips } from '@/server/services/trip-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/trips
 *
 * Roteiros publicados que têm ao menos uma saída futura, cada um com a
 * próxima saída. Filtros: dificuldade, tag, faixa de preço (em centavos).
 */
export const GET = rota(async (request: NextRequest) => {
  limitarLeituraPublica(request, 'trips')

  const url = new URL(request.url)
  const filtros = validarOuFalhar(filtrosTripSchema.safeParse(queryParaObjeto(url)))

  const { trips, total } = await listarTrips({
    dificuldade: filtros.dificuldade,
    tag: filtros.tag,
    precoMinCentavos: filtros.precoMin,
    precoMaxCentavos: filtros.precoMax,
    limit: filtros.limit,
    offset: filtros.offset,
  })

  return ok(trips, {
    meta: {
      total,
      limit: filtros.limit,
      offset: filtros.offset,
      hasMore: filtros.offset + trips.length < total,
    },
    // Catálogo muda pouco e é igual para todo mundo. 60s na CDN com janela de
    // stale generosa: um pico de tráfego não vira carga no banco.
    cache: { sMaxAge: 60, staleWhileRevalidate: 300 },
  })
})
