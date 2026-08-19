import { AppError, ErrorCode } from '@/lib/api/errors'
import { limitarLeituraPublica } from '@/lib/api/rate-limit'
import { ok } from '@/lib/api/respond'
import { rota } from '@/lib/api/route-handler'
import { buscarSettings } from '@/server/services/institucional-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/settings
 *
 * Configurações públicas, incluindo o template da mensagem do WhatsApp — que
 * é editável no CRM justamente para o texto do pedido não exigir deploy.
 */
export const GET = rota(async (request: Request) => {
  limitarLeituraPublica(request, 'settings')

  const settings = await buscarSettings()

  if (!settings) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Configurações do site não encontradas.', {
      status: 404,
    })
  }

  return ok(settings, { cache: { sMaxAge: 300, staleWhileRevalidate: 3600 } })
})
