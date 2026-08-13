import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { idSchema, paginacaoSchema, queryParaObjeto } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** GET /api/admin/messages — mensagens de contato, não lidas primeiro. */
export const GET = rota(async (request: NextRequest) => {
  await exigirPapel(request, ['OWNER', 'ADMIN'])

  const url = new URL(request.url)
  const { limit, offset } = validarOuFalhar(paginacaoSchema.safeParse(queryParaObjeto(url)))

  const [mensagens, total] = await Promise.all([
    prisma.contactMessage.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        message: true,
        read: true,
        createdAt: true,
        trip: { select: { slug: true, title: true } },
      },
      orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    }),
    prisma.contactMessage.count(),
  ])

  return ok(mensagens, {
    meta: { total, limit, offset, hasMore: offset + mensagens.length < total },
  })
})

const marcarSchema = z.object({ id: idSchema, lida: z.boolean() })

/** PATCH /api/admin/messages — marca como lida. */
export const PATCH = rota(async (request: NextRequest) => {
  await exigirPapel(request, ['OWNER', 'ADMIN'])

  const corpo: unknown = await request.json().catch(() => null)
  const { id, lida } = validarOuFalhar(marcarSchema.safeParse(corpo))

  const atualizada = await prisma.contactMessage.update({
    where: { id },
    data: { read: lida },
    select: { id: true, read: true },
  })

  return ok({ id: atualizada.id, lida: atualizada.read })
})
