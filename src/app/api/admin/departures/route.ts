import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { instanteLocal } from '@/lib/datetime'
import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { idSchema, paginacaoSchema, queryParaObjeto } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import { criarSaida } from '@/server/services/admin/departure-admin-service'
import { ipDaRequest } from '@/server/services/audit-service'

export const dynamic = 'force-dynamic'

// `startAt` chega como parede local ("2026-08-15T06:00"), o que o
// `<input type="datetime-local">` produz e o que a Caqui pensa. A conversão
// para o instante UTC certo é feita por `instanteLocal`, respeitando o horário
// de verão da DATA escolhida — não o de hoje.
const PAREDE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

const criarSchema = z.object({
  tripId: idSchema,
  startAt: z.string().regex(PAREDE, 'Data e hora em formato inválido.'),
  priceCents: z.number().int().min(0).max(100_000_00),
  compareAtPriceCents: z.number().int().min(0).max(100_000_00).nullable().optional(),
  meetingPoint: z.string().trim().max(300).optional(),
  meetingTimeLocal: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Use o formato HH:MM.')
    .optional(),
  meetingLat: z.number().min(-90).max(90).nullable().optional(),
  meetingLng: z.number().min(-180).max(180).nullable().optional(),
  internalNotes: z.string().trim().max(2000).optional(),
})

/**
 * GET /api/admin/departures
 *
 * Listagem administrativa: traz rascunhos, canceladas e passadas — tudo o que
 * a rota pública esconde. E traz `internalNotes`, que aqui É permitido.
 */
export const GET = rota(async (request: NextRequest) => {
  await exigirPapel(request, ['OWNER', 'ADMIN'])

  const url = new URL(request.url)
  const { limit, offset } = validarOuFalhar(paginacaoSchema.safeParse(queryParaObjeto(url)))

  const [saidas, total] = await Promise.all([
    prisma.departure.findMany({
      select: {
        id: true,
        startAt: true,
        priceCents: true,
        availability: true,
        status: true,
        internalNotes: true,
        trip: { select: { id: true, slug: true, title: true } },
      },
      orderBy: { startAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.departure.count(),
  ])

  return ok(saidas, { meta: { total, limit, offset, hasMore: offset + saidas.length < total } })
})

/** POST /api/admin/departures — cria uma saída a partir de um roteiro. */
export const POST = rota(async (request: NextRequest) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const corpo: unknown = await request.json().catch(() => null)
  const { startAt, ...dados } = validarOuFalhar(criarSchema.safeParse(corpo))

  const nova = await criarSaida(
    { ...dados, startAt: instanteLocal(startAt) },
    { userId: usuario.userId, ip: ipDaRequest(request) },
  )

  return ok(nova)
})
