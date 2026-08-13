import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { atualizarAltSchema, idSchema } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { ipDaRequest } from '@/server/services/audit-service'
import { atualizarAlt, removerMidia } from '@/server/services/admin/media-admin-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Contexto = { params: Promise<{ id: string }> }

/** PATCH /api/admin/media/:id — corrige o texto alternativo. */
export const PATCH = rota(async (request: Request, contexto: Contexto) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const { id } = await contexto.params
  const midiaId = validarOuFalhar(idSchema.safeParse(id))

  const corpo: unknown = await request.json().catch(() => null)
  const { alt } = validarOuFalhar(atualizarAltSchema.safeParse(corpo))

  return ok(await atualizarAlt(midiaId, alt, { userId: usuario.userId, ip: ipDaRequest(request) }))
})

/**
 * DELETE /api/admin/media/:id — apaga do banco E do storage.
 *
 * Não é soft delete. Imagem não tem histórico a preservar, e mantê-la marcada
 * como apagada guardaria o arquivo pago no provedor por tempo indeterminado —
 * que é justamente o que este prompt existe para não repetir.
 */
export const DELETE = rota(async (request: Request, contexto: Contexto) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const { id } = await contexto.params
  const midiaId = validarOuFalhar(idSchema.safeParse(id))

  return ok(await removerMidia(midiaId, { userId: usuario.userId, ip: ipDaRequest(request) }))
})
