import { limitarLeituraPublica } from '@/lib/api/rate-limit'
import { ok } from '@/lib/api/respond'
import { rota } from '@/lib/api/route-handler'
import { listarGuias } from '@/server/services/institucional-service'

export const dynamic = 'force-dynamic'

/** GET /api/guides — guias ativos, com credenciais Cadastur e PESM. */
export const GET = rota(async (request: Request) => {
  limitarLeituraPublica(request, 'guides')

  const guias = await listarGuias()

  return ok(guias, { cache: { sMaxAge: 300, staleWhileRevalidate: 3600 } })
})
