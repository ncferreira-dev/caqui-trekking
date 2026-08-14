import { z } from 'zod'

import { instanteLocal } from '@/lib/datetime'
import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { idSchema } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { atualizarSaida } from '@/server/services/admin/departure-admin-service'
import { ipDaRequest } from '@/server/services/audit-service'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ id: string }> }

/**
 * A data chega como parede local ("2026-08-15T06:00"), não como instante UTC.
 *
 * É o que o `<input type="datetime-local">` produz, e é o que a Caqui pensa:
 * "sábado, 6 da manhã". A conversão para o instante UTC certo — respeitando o
 * horário de verão da data escolhida, não o de hoje — é feita por
 * `instanteLocal`, a função inversa de `isoComOffsetLocal`. Mandar um `Z` aqui
 * gravaria a saída três horas adiantada.
 */
const PAREDE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

const atualizarSchema = z.object({
  startAt: z.string().regex(PAREDE, 'Data e hora em formato inválido.').optional(),
  priceCents: z.number().int().min(0).max(100_000_00).optional(),
  compareAtPriceCents: z.number().int().min(0).max(100_000_00).nullable().optional(),
  meetingPoint: z.string().trim().max(300).nullable().optional(),
  meetingTimeLocal: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Horário em formato HH:MM.')
    .nullable()
    .optional(),
  meetingLat: z.number().min(-90).max(90).nullable().optional(),
  meetingLng: z.number().min(-180).max(180).nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
})

/**
 * PATCH /api/admin/departures/:id — editar data, preço, ponto e status.
 *
 * A disponibilidade tem rota própria (`/availability`), de propósito: ela é o
 * toque de rotina da lista e não pode depender de abrir este formulário.
 */
export const PATCH = rota(async (request: Request, contexto: Contexto) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const { id } = await contexto.params
  const departureId = validarOuFalhar(idSchema.safeParse(id))

  const corpo: unknown = await request.json().catch(() => null)
  const dados = validarOuFalhar(atualizarSchema.safeParse(corpo))

  const { startAt, ...resto } = dados
  const resultado = await atualizarSaida(
    departureId,
    { ...resto, ...(startAt ? { startAt: instanteLocal(startAt) } : {}) },
    { userId: usuario.userId, ip: ipDaRequest(request) },
  )

  return ok(resultado)
})
