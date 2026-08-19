import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { exigirPapel } from '@/lib/auth/guard'
import { criarGuia, listarGuias } from '@/server/services/admin/guide-admin-service'
import { ipDaRequest } from '@/server/services/audit-service'

export const dynamic = 'force-dynamic'

/**
 * Os guias — a entidade que o site publica como prova de regularidade e que
 * o painel não sabia editar.
 *
 * Cadastur e credencial do PESM são os números que dizem ao cliente que a
 * operação é legal. Eles mudam: renovam, entram guias novos, gente sai. Até
 * 18/08/2026 a única forma de mexer neles era escrever no banco à mão.
 */
export const criarSchema = z
  .object({
    nome: z.string().trim().min(2, 'O nome é obrigatório.').max(150),
    bio: z.string().trim().max(2000).nullable().optional(),
    cadastur: z.string().trim().max(50).nullable().optional(),
    pesm: z.string().trim().max(100).nullable().optional(),
    ativo: z.boolean().optional(),
    ordem: z.number().int().min(0).max(999).optional(),
  })
  .strict()

/** GET /api/admin/guides — inclui os desativados; exclui os arquivados. */
export const GET = rota(async (request: Request) => {
  await exigirPapel(request, ['OWNER', 'ADMIN'])
  return ok(await listarGuias())
})

export const POST = rota(async (request: NextRequest) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const corpo: unknown = await request.json().catch(() => null)
  const dados = validarOuFalhar(criarSchema.safeParse(corpo))

  return ok(await criarGuia(dados, { userId: usuario.userId, ip: ipDaRequest(request) }))
})
