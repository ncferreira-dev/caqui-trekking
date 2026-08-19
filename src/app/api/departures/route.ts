import type { NextRequest } from 'next/server'

import { limitarLeituraPublica } from '@/lib/api/rate-limit'
import { ok } from '@/lib/api/respond'
import { intervaloDoMes } from '@/lib/datetime'
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
  limitarLeituraPublica(request, 'departures')

  const url = new URL(request.url)
  const filtros = validarOuFalhar(filtrosDepartureSchema.safeParse(queryParaObjeto(url)))

  // `mes` é açúcar para o par `de`/`ate`, resolvido no fuso de São Paulo. Quem
  // manda os dois vence com o par explícito — o parâmetro mais específico não
  // deve ser sobrescrito pelo atalho.
  const janela = filtros.mes ? intervaloDoMes(filtros.mes) : null

  const { saidas, total } = await listarDepartures({
    de: filtros.de ?? janela?.de,
    ate: filtros.ate ?? janela?.ate,
    dificuldade: filtros.dificuldade,
    tag: filtros.tag,
    precoMinCentavos: filtros.precoMin,
    precoMaxCentavos: filtros.precoMax,
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
