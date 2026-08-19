import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { reordenarSchema } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { ipDaRequest } from '@/server/services/audit-service'
import { reordenarCatalogo } from '@/server/services/admin/ordem-service'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/products/reorder
 *
 * Corpo: `{ ids: [12, 9, 30] }` — o manifesto COMPLETO de peças, na ordem
 * em que devem aparecer. Uma chamada por reordenação, numa transação só. Ver
 * `ordem-service.ts` para o porquê de não ser um PATCH por item.
 *
 * Reordenar vitrine é rotina de conteúdo, então é de ADMIN.
 */
export const PATCH = rota(async (request: Request) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const corpo: unknown = await request.json().catch(() => null)
  const { ids } = validarOuFalhar(reordenarSchema.safeParse(corpo))

  return ok(
    await reordenarCatalogo('products', ids, { userId: usuario.userId, ip: ipDaRequest(request) }),
  )
})
