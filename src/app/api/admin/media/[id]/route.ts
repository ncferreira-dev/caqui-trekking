import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { atualizarAltSchema, corDaFotoSchema, idSchema } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { ipDaRequest } from '@/server/services/audit-service'
import {
  atualizarAlt,
  definirCorDaFoto,
  removerMidia,
} from '@/server/services/admin/media-admin-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Contexto = { params: Promise<{ id: string }> }

/**
 * PATCH /api/admin/media/:id — corrige o texto alternativo OU a cor.
 *
 * Dois campos, dois corpos possíveis, e não um corpo com os dois opcionais: são
 * gestos diferentes, em momentos diferentes, e cada um tem a sua auditoria
 * (`media.alt`, `media.cor`). Um corpo único gravaria "mudou a imagem" sem
 * dizer o quê.
 */
export const PATCH = rota(async (request: Request, contexto: Contexto) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const { id } = await contexto.params
  const midiaId = validarOuFalhar(idSchema.safeParse(id))
  const ctx = { userId: usuario.userId, ip: ipDaRequest(request) }

  const corpo: unknown = await request.json().catch(() => null)

  // A presença da chave decide. `cor: null` é um valor legítimo ("serve para
  // qualquer cor"), então testar `corpo.cor` truthy engoliria a limpeza.
  if (corpo !== null && typeof corpo === 'object' && 'cor' in corpo) {
    const { cor } = validarOuFalhar(corDaFotoSchema.safeParse(corpo))
    return ok(await definirCorDaFoto(midiaId, cor, ctx))
  }

  const { alt } = validarOuFalhar(atualizarAltSchema.safeParse(corpo))
  return ok(await atualizarAlt(midiaId, alt, ctx))
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
