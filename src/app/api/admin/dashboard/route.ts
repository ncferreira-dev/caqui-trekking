import { ok } from '@/lib/api/respond'
import { rota } from '@/lib/api/route-handler'
import { exigirPapel } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000

/**
 * GET /api/admin/dashboard
 *
 * Os alertas são o ponto: eles SINALIZAM, não decidem. "Pode ser real, pode
 * ser esquecimento" — quem sabe é a pessoa que guia.
 *
 * A agregação é feita no SERVIDOR e devolve listas curtas. No projeto de
 * referência, a tela de relatórios baixava três coleções inteiras e calculava
 * tudo no navegador — e o CRM da Caqui vai ser operado do celular.
 */
export const GET = rota(async (request: Request) => {
  await exigirPapel(request, ['OWNER', 'ADMIN'])

  const agora = new Date()
  const emSeteDias = new Date(agora.getTime() + SETE_DIAS_MS)

  const [proximas, saidasProximasAindaAbertas, roteirosSemAgenda, mensagensNaoLidas, leads] =
    await Promise.all([
      prisma.departure.findMany({
        where: { status: 'PUBLISHED', startAt: { gte: agora } },
        select: {
          id: true,
          startAt: true,
          priceCents: true,
          capacity: true,
          seatsTaken: true,
          lastSpotsAt: true,
          availabilityOverride: true,
          trip: { select: { slug: true, title: true } },
        },
        orderBy: { startAt: 'asc' },
        take: 10,
      }),

      // Alerta 1: saída publicada, faltando menos de 7 dias, ainda como
      // "vagas abertas". Pode ser verdade, pode ser esquecimento.
      prisma.departure.findMany({
        // O selo virou CONTA em 18/08/2026, e conta não vira `where`. A janela
        // de sete dias continua no banco, que é onde o índice ajuda; o filtro
        // do selo roda depois, sobre poucas dezenas de linhas.
        where: { status: 'PUBLISHED', startAt: { gte: agora, lte: emSeteDias } },
        select: {
          id: true,
          startAt: true,
          trip: { select: { slug: true, title: true } },
        },
        orderBy: { startAt: 'asc' },
      }),

      // Alerta 2: roteiro publicado sem nenhuma saída futura publicada.
      // Ele está no ar e não tem como ninguém comprar.
      prisma.trip.findMany({
        where: {
          status: 'PUBLISHED',
          deletedAt: null,
          departures: { none: { status: 'PUBLISHED', startAt: { gte: agora } } },
        },
        select: { id: true, slug: true, title: true },
        orderBy: { title: 'asc' },
      }),

      prisma.contactMessage.count({ where: { read: false } }),
      prisma.lead.count(),
    ])

  return ok({
    proximasSaidas: proximas,
    alertas: {
      saidasProximasAindaAbertas,
      roteirosSemAgenda,
    },
    contadores: {
      mensagensNaoLidas,
      leads,
    },
  })
})
