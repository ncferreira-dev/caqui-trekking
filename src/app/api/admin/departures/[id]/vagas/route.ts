import { z } from 'zod'

import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { idSchema } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { lancarVagas } from '@/server/services/admin/departure-admin-service'
import { ipDaRequest } from '@/server/services/audit-service'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ id: string }> }

const corpoSchema = z
  .object({
    /**
     * O TOTAL, não um incremento.
     *
     * Delta ("+2") exige que a pessoa lembre do valor anterior e transforma
     * dois toques rápidos em quatro vagas. Total é o número que ela tem na
     * cabeça depois de desligar o telefone: "são cinco agora".
     *
     * O teto de 999 não é regra de negócio, é barreira contra dedo escorregado
     * no teclado numérico do celular.
     */
    vagasFechadas: z.number().int().min(0).max(999),
    /** Quantas cabem. `null` remove o limite e devolve o selo ao modo manual. */
    capacidade: z.number().int().positive().max(999).nullable().optional(),
    /** A partir de quantas restantes o selo vira "últimas vagas". */
    limiarUltimasVagas: z.number().int().min(0).max(99).optional(),
  })
  .strict()

/**
 * PATCH /api/admin/departures/:id/vagas
 *
 * O LIVRO DO OPERADOR.
 *
 * A Caqui não vende no site: o pedido termina numa conversa de WhatsApp. Então
 * não existe reserva para decrementar, e este número é lançado por quem fechou
 * a venda. É a operação mais frequente do CRM depois de criar a saída.
 *
 * ⚠️ OVERBOOKING É ACEITO de propósito. Dois guias vendendo ao mesmo tempo
 * acontece, e um sistema que recusa o lançamento faz a pessoa mentir o número
 * para conseguir salvar, e aí o relatório de lucro nasce errado. O excedente
 * aparece como alerta no painel.
 *
 * ADMIN pode: é rotina, não configuração.
 */
export const PATCH = rota(async (request: Request, contexto: Contexto) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const { id } = await contexto.params
  const departureId = validarOuFalhar(idSchema.safeParse(id))

  const corpo: unknown = await request.json().catch(() => null)
  const { vagasFechadas, capacidade, limiarUltimasVagas } = validarOuFalhar(
    corpoSchema.safeParse(corpo),
  )

  const resultado = await lancarVagas(
    departureId,
    {
      seatsTaken: vagasFechadas,
      ...(capacidade !== undefined ? { capacity: capacidade } : {}),
      ...(limiarUltimasVagas !== undefined ? { lastSpotsAt: limiarUltimasVagas } : {}),
    },
    { userId: usuario.userId, ip: ipDaRequest(request) },
  )

  return ok(resultado)
})
