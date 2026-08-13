import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { donoDeMidiaSchema, reordenarMidiaSchema } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { ipDaRequest } from '@/server/services/audit-service'
import { reordenarMidias } from '@/server/services/admin/media-admin-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * PATCH /api/admin/media/reorder
 *
 * Corpo: `{ tripId | productId | guideId, ids: [12, 9, 30] }`
 *
 * É o endpoint do arrastar-e-soltar. Uma chamada por soltura, com o manifesto
 * COMPLETO — não um `PATCH` por imagem, que deixaria a galeria em estado
 * intermediário se a rede caísse no meio da sequência.
 *
 * **O primeiro id da lista é a imagem principal.** A regra é essa, e está
 * escrita aqui, na resposta (`principal: true`) e em `docs/05-midia.md`.
 */
export const PATCH = rota(async (request: Request) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const corpo: unknown = await request.json().catch(() => null)
  const { ids, ...donoBruto } = validarOuFalhar(reordenarMidiaSchema.safeParse(corpo))
  const dono = validarOuFalhar(donoDeMidiaSchema.safeParse(donoBruto))

  return ok(await reordenarMidias(dono, ids, { userId: usuario.userId, ip: ipDaRequest(request) }))
})
