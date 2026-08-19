import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { idSchema } from '@/lib/api/schemas'
import { exigirOwner } from '@/lib/auth/guard'
import { atualizarUsuario } from '@/server/services/admin/user-admin-service'
import { ipDaRequest } from '@/server/services/audit-service'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ id: string }> }

/**
 * PATCH /api/admin/users/:id — **exclusiva do OWNER**, como toda a gestão de
 * acesso.
 *
 * O e-mail NÃO entra: ele é a identidade de login e o alvo da auditoria. Trocar
 * o e-mail de um acesso existente é criar outro acesso com o histórico do
 * anterior pendurado. Quem mudou de e-mail ganha um acesso novo e o antigo é
 * desativado — dois gestos explícitos, e o rastro continua legível.
 */
const atualizarSchema = z
  .object({
    nome: z.string().trim().min(2).max(150).optional(),
    ativo: z.boolean().optional(),
    role: z.enum(['OWNER', 'ADMIN']).optional(),
    senha: z.string().min(12, 'A senha precisa ter pelo menos 12 caracteres.').max(200).optional(),
  })
  .strict()

export const PATCH = rota(async (request: NextRequest, contexto: Contexto) => {
  const owner = await exigirOwner(request)

  const { id } = await contexto.params
  const usuarioId = validarOuFalhar(idSchema.safeParse(id))

  const corpo: unknown = await request.json().catch(() => null)
  const dados = validarOuFalhar(atualizarSchema.safeParse(corpo))

  return ok(
    await atualizarUsuario(usuarioId, dados, {
      userId: owner.userId,
      ip: ipDaRequest(request),
    }),
  )
})
