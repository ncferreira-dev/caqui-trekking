import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { idSchema } from '@/lib/api/schemas'
import { exigirOwner, exigirPapel } from '@/lib/auth/guard'
import { arquivarGuia, atualizarGuia } from '@/server/services/admin/guide-admin-service'
import { ipDaRequest } from '@/server/services/audit-service'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ id: string }> }

const atualizarSchema = z
  .object({
    nome: z.string().trim().min(2).max(150).optional(),
    bio: z.string().trim().max(2000).nullable().optional(),
    cadastur: z.string().trim().max(50).nullable().optional(),
    pesm: z.string().trim().max(100).nullable().optional(),
    /** Desativar é reversível e some do site na hora. Não é o mesmo que arquivar. */
    ativo: z.boolean().optional(),
    ordem: z.number().int().min(0).max(999).optional(),
  })
  .strict()

export const PATCH = rota(async (request: NextRequest, contexto: Contexto) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const { id } = await contexto.params
  const guideId = validarOuFalhar(idSchema.safeParse(id))

  const corpo: unknown = await request.json().catch(() => null)
  const dados = validarOuFalhar(atualizarSchema.safeParse(corpo))

  return ok(
    await atualizarGuia(guideId, dados, { userId: usuario.userId, ip: ipDaRequest(request) }),
  )
})

/**
 * DELETE = ARQUIVAR, e é só do OWNER.
 *
 * Mesma régua de `trips/[id]`: destruir conteúdo que o site publica é decisão
 * de quem responde pela empresa. E "destruir" aqui é soft delete — as saídas
 * já realizadas guardam quem guiou, e essa é a prova de que a trilha teve guia
 * credenciado.
 */
export const DELETE = rota(async (request: NextRequest, contexto: Contexto) => {
  const owner = await exigirOwner(request)

  const { id } = await contexto.params
  const guideId = validarOuFalhar(idSchema.safeParse(id))

  return ok(await arquivarGuia(guideId, { userId: owner.userId, ip: ipDaRequest(request) }))
})
