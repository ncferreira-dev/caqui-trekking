import { z } from 'zod'

import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { idSchema } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { alternarVariante } from '@/server/services/admin/content-admin-service'
import { ipDaRequest } from '@/server/services/audit-service'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ id: string }> }

const corpoSchema = z.object({ disponivel: z.boolean() })

/**
 * PATCH /api/admin/variants/:id
 *
 * Toggle rápido de disponibilidade por tamanho/cor, direto da tabela de
 * variantes. Endpoint dedicado pelo mesmo motivo do `availability` da saída:
 * é operação de um toque, feita muitas vezes.
 *
 * Não existe quantidade. `disponivel` é um booleano manual.
 */
export const PATCH = rota(async (request: Request, contexto: Contexto) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const { id } = await contexto.params
  const variantId = validarOuFalhar(idSchema.safeParse(id))

  const corpo: unknown = await request.json().catch(() => null)
  const { disponivel } = validarOuFalhar(corpoSchema.safeParse(corpo))

  const resultado = await alternarVariante(variantId, disponivel, {
    userId: usuario.userId,
    ip: ipDaRequest(request),
  })

  return ok(resultado)
})
