import { z } from 'zod'

import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { idSchema } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { cancelarSaida } from '@/server/services/admin/departure-admin-service'
import { ipDaRequest } from '@/server/services/audit-service'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ id: string }> }

const corpoSchema = z.object({
  /** Vai para a auditoria, não para o cliente. Ninguém cancela "por nada". */
  motivo: z.string().trim().max(300).optional(),
})

/**
 * POST /api/admin/departures/:id/cancel
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CANCELAR NÃO É APAGAR
 * ────────────────────────────────────────────────────────────────────────────
 * A saída vira `status: CANCELLED` e continua no banco, com auditoria de quem
 * cancelou, quando e por quê. Apagar a linha destruiria o histórico de uma
 * data que gente comprou — e é justamente a data sobre a qual alguém vai
 * perguntar depois.
 *
 * Efeito imediato: ela some da agenda pública (o serviço só lista `PUBLISHED`)
 * e `POST /api/cart/validate` passa a devolver `DEPARTURE_NOT_FOUND` para quem
 * tiver a vaga na mochila. Ninguém consegue finalizar um pedido de saída
 * cancelada — a rede está no servidor, não na interface.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POST, E NÃO DELETE
 * ────────────────────────────────────────────────────────────────────────────
 * `DELETE` diria "removi o recurso", e não é o que acontece. O verbo aqui
 * descreve uma transição de estado com corpo (o motivo) — e `DELETE` com corpo
 * é território cinzento em proxy e em cache.
 *
 * ADMIN pode: é operação de rotina, e chove na Serra do Mar. Exigir o OWNER
 * para cancelar num sábado de manhã faria a senha do OWNER virar senha de
 * todo mundo. Quem avisa o grupo é a conversa do WhatsApp; a interface exige
 * confirmação escrita antes de chamar isto.
 */
export const POST = rota(async (request: Request, contexto: Contexto) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const { id } = await contexto.params
  const departureId = validarOuFalhar(idSchema.safeParse(id))

  const corpo: unknown = await request.json().catch(() => null)
  const { motivo } = validarOuFalhar(corpoSchema.safeParse(corpo ?? {}))

  const cancelada = await cancelarSaida(departureId, motivo, {
    userId: usuario.userId,
    ip: ipDaRequest(request),
  })

  return ok(cancelada)
})
