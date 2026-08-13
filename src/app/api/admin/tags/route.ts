import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { criarTagSchema } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { ipDaRequest } from '@/server/services/audit-service'
import { criarTag, listarTags } from '@/server/services/admin/tag-admin-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/tags — com a contagem de roteiros por tag.
 *
 * A contagem não é enfeite: é ela que diz se a tag pode ser apagada, e evita
 * a viagem "tenta apagar → 409 → volta".
 */
export const GET = rota(async (request: Request) => {
  await exigirPapel(request, ['OWNER', 'ADMIN'])
  return ok(await listarTags())
})

/** POST /api/admin/tags */
export const POST = rota(async (request: Request) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const corpo: unknown = await request.json().catch(() => null)
  const dados = validarOuFalhar(criarTagSchema.safeParse(corpo))

  return ok(await criarTag(dados, { userId: usuario.userId, ip: ipDaRequest(request) }))
})
