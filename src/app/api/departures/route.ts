import type { NextRequest } from 'next/server'

import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { filtrosDepartureSchema, queryParaObjeto } from '@/lib/api/schemas'
import { listarDepartures } from '@/server/services/departure-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/departures
 *
 * A agenda. Cronológica, filtrável por intervalo de data.
 *
 * Por padrão devolve só as saídas futuras. Com `?incluirEncerradas=true`, as
 * passadas voltam marcadas com `encerrada: true` — elas não somem da página:
 * servem de prova social e histórico.
 */
export const GET = rota(async (request: NextRequest) => {
  const url = new URL(request.url)
  const filtros = validarOuFalhar(filtrosDepartureSchema.safeParse(queryParaObjeto(url)))

  const { saidas, total } = await listarDepartures({
    de: filtros.de,
    ate: filtros.ate,
    incluirEncerradas: filtros.incluirEncerradas,
    limit: filtros.limit,
    offset: filtros.offset,
  })

  return ok(saidas, {
    meta: {
      total,
      limit: filtros.limit,
      offset: filtros.offset,
      hasMore: filtros.offset + saidas.length < total,
    },
    cache: { sMaxAge: 60, staleWhileRevalidate: 300 },
  })
})
