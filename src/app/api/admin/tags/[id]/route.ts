import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { atualizarTagSchema, idSchema } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { ipDaRequest } from '@/server/services/audit-service'
import { atualizarTag, removerTag } from '@/server/services/admin/tag-admin-service'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ id: string }> }

/**
 * PATCH /api/admin/tags/:id
 *
 * `label` e `icone` são editáveis; `slug` NÃO. O slug vai para a URL de filtro
 * (`/expedicoes?tag=rapel`) — mesma disciplina do slug do roteiro.
 */
export const PATCH = rota(async (request: Request, contexto: Contexto) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const { id } = await contexto.params
  const tagId = validarOuFalhar(idSchema.safeParse(id))

  const corpo: unknown = await request.json().catch(() => null)
  const dados = validarOuFalhar(atualizarTagSchema.safeParse(corpo))

  return ok(await atualizarTag(tagId, dados, { userId: usuario.userId, ip: ipDaRequest(request) }))
})

/** DELETE /api/admin/tags/:id — recusa com 409 se a tag estiver em uso. */
export const DELETE = rota(async (request: Request, contexto: Contexto) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const { id } = await contexto.params
  const tagId = validarOuFalhar(idSchema.safeParse(id))

  return ok(await removerTag(tagId, { userId: usuario.userId, ip: ipDaRequest(request) }))
})
