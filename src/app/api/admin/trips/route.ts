import type { NextRequest } from 'next/server'

import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { paginacaoSchema, queryParaObjeto } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/trips
 *
 * A listagem administrativa dos roteiros. Diferente da pública em três coisas,
 * e as três são o motivo de ela existir:
 *
 *  1. **Traz rascunho e arquivado.** A vitrine mostra só `PUBLISHED`; o painel
 *     precisa mostrar o que ainda não foi ao ar, senão não há como publicar.
 *  2. **Conta as saídas futuras.** É o número que responde "este roteiro está
 *     vendável?" — roteiro publicado com zero saídas futuras está no ar sem
 *     ninguém poder comprar, e é um dos alertas do dashboard.
 *  3. **Não devolve descrição nem galeria.** A lista não desenha isso, e
 *     trazer `description` de 30 roteiros para renderizar 30 títulos é peso
 *     puro numa tela que a Caqui abre do celular.
 *
 * `deletedAt` é o único filtro que permanece: arquivar é soft delete, e
 * ressuscitar roteiro é operação de banco, não de tela.
 */
export const GET = rota(async (request: NextRequest) => {
  await exigirPapel(request, ['OWNER', 'ADMIN'])

  const url = new URL(request.url)
  const { limit, offset } = validarOuFalhar(paginacaoSchema.safeParse(queryParaObjeto(url)))

  const agora = new Date()

  const where = { deletedAt: null }

  const [roteiros, total] = await Promise.all([
    prisma.trip.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        city: true,
        state: true,
        difficulty: true,
        durationMinutes: true,
        status: true,
        featured: true,
        sortOrder: true,
        activityTags: { select: { activityTag: { select: { slug: true, label: true } } } },
        images: { select: { url: true, alt: true }, orderBy: { sortOrder: 'asc' }, take: 1 },
        // `_count` com filtro: o Postgres conta, e não vêm 40 linhas de saída
        // por roteiro só para o front descobrir um número.
        _count: {
          select: {
            departures: { where: { status: 'PUBLISHED', startAt: { gte: agora } } },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { title: 'asc' }],
      take: limit,
      skip: offset,
    }),
    prisma.trip.count({ where }),
  ])

  const dados = roteiros.map((t) => ({
    id: t.id,
    slug: t.slug,
    titulo: t.title,
    cidade: t.city,
    estado: t.state,
    dificuldade: t.difficulty,
    duracaoMinutos: t.durationMinutes,
    status: t.status,
    destaque: t.featured,
    ordem: t.sortOrder,
    tags: t.activityTags.map((r) => r.activityTag),
    capa: t.images[0] ?? null,
    saidasFuturas: t._count.departures,
  }))

  return ok(dados, { meta: { total, limit, offset, hasMore: offset + dados.length < total } })
})
