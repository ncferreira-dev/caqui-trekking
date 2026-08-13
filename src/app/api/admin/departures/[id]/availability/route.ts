import { z } from 'zod'

import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { idSchema } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { alterarDisponibilidade } from '@/server/services/admin/departure-admin-service'
import { ipDaRequest } from '@/server/services/audit-service'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ id: string }> }

const corpoSchema = z.object({
  disponibilidade: z.enum(['AVAILABLE', 'LAST_SPOTS', 'SOLD_OUT']),
  motivo: z.string().trim().max(300).optional(),
})

/**
 * PATCH /api/admin/departures/:id/availability
 *
 * Endpoint dedicado, de propósito: a UI é UM toque na listagem (três botões:
 * Abertas / Últimas / Esgotado), não um formulário. É o campo mais alterado do
 * sistema e a pessoa mexe nele do celular, no meio do dia.
 *
 * O update genérico da saída NÃO aceita este campo — é a mesma disciplina do
 * "caminho único de escrita" que o projeto de referência acertou no estoque:
 * fechar a porta lateral é o que faz o histórico valer alguma coisa.
 *
 * ADMIN pode. É operação de rotina, não de configuração.
 */
export const PATCH = rota(async (request: Request, contexto: Contexto) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const { id } = await contexto.params
  const departureId = validarOuFalhar(idSchema.safeParse(id))

  const corpo: unknown = await request.json().catch(() => null)
  const { disponibilidade, motivo } = validarOuFalhar(corpoSchema.safeParse(corpo))

  const resultado = await alterarDisponibilidade(departureId, disponibilidade, motivo, {
    userId: usuario.userId,
    ip: ipDaRequest(request),
  })

  return ok(resultado)
})
