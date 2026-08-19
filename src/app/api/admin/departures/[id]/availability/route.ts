import { z } from 'zod'

import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { idSchema } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { declararDisponibilidade } from '@/server/services/admin/departure-admin-service'
import { ipDaRequest } from '@/server/services/audit-service'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ id: string }> }

const corpoSchema = z
  .object({
    /**
     * `null` DEVOLVE O CONTROLE PARA A CONTA DE VAGAS.
     *
     * Era a operação que faltava no sistema antigo: com um campo só, não havia
     * como dizer "esqueça o que eu marquei" — a pessoa tinha que adivinhar
     * qual valor recolocar, e adivinhava errado.
     */
    disponibilidade: z.enum(['AVAILABLE', 'LAST_SPOTS', 'SOLD_OUT']).nullable(),
    motivo: z.string().trim().max(300).optional(),
  })
  .strict()

/**
 * PATCH /api/admin/departures/:id/availability
 *
 * A EXCEÇÃO, não a rotina.
 *
 * Até 18/08/2026 esta rota gravava o único campo que decidia o selo do site, e
 * era o mais mexido do sistema. Desde a chegada da contagem de vagas, o selo é
 * derivado de `capacity - seatsTaken` e esta rota grava apenas o OVERRIDE:
 * fechar por chuva, por interdição do parque, por decisão do guia na véspera.
 * Nenhuma dessas razões aparece na conta de vagas.
 *
 * O lançamento do dia a dia ("fechei mais duas") mora em
 * `PATCH /api/admin/departures/:id/vagas`.
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

  const resultado = await declararDisponibilidade(departureId, disponibilidade, motivo, {
    userId: usuario.userId,
    ip: ipDaRequest(request),
  })

  return ok(resultado)
})
