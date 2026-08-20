import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { POST as criarTripRota } from '@/app/api/admin/trips/route'
import { prisma } from '@/lib/prisma'
import { limparBanco, post } from './fixtures'
import { cookieDeLogin } from './sessao'

/**
 * CRIAR A TRILHA E A PRIMEIRA DATA NO MESMO SALVAMENTO.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O PEDIDO, EM 20/08/2026
 * ════════════════════════════════════════════════════════════════════════════
 * "Se vai marcar uma saída, marca tudo como roteiros. Os dois aparecem num
 * lugar só dentro do site, na visão do cliente. Quando o cliente vê no site
 * não aparece lá saídas, e não tem que apertar em outro para ver roteiros;
 * então por que na hora de cadastrar é assim?"
 *
 * O argumento é do próprio site: `/trekking/[slug]` é a página da trilha, e as
 * datas aparecem dentro dela. `Departure` não tem página própria. A separação
 * no cadastro era a do banco vazando para quem opera.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O QUE ESTE ARQUIVO PROTEGE
 * ════════════════════════════════════════════════════════════════════════════
 * A transação única, principalmente. Roteiro e data nascem juntos ou não
 * nascem: se a data falhar depois do roteiro gravado, sobra um roteiro órfão e
 * a tela diz que deu certo. É o defeito mais caro possível aqui, porque não
 * parece defeito.
 */

function criar(cookie: string, corpo: unknown): Request {
  return post('/api/admin/trips', corpo, { cookie }) as Request
}

function trilha(extra: Record<string, unknown> = {}) {
  return {
    title: 'Pico do Urubu ao amanhecer',
    description: 'Subida curta com vista para a serra inteira, boa para começar.',
    city: 'Mogi das Cruzes',
    state: 'SP',
    difficulty: 'FACIL',
    ...extra,
  }
}

let cookie: string

beforeEach(async () => {
  await limparBanco()
  cookie = await cookieDeLogin('ADMIN')
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /api/admin/trips com primeiraSaida', () => {
  it('cria o roteiro e a data, e devolve o id da saída', async () => {
    const res = await criarTripRota(
      criar(
        cookie,
        trilha({
          primeiraSaida: { startAt: '2026-09-13T05:30', priceCents: 9000 },
        }),
      ) as never,
    )

    expect(res.status).toBe(200)
    const { data } = (await res.json()) as {
      data: { id: number; slug: string; saidaId: number | null }
    }
    expect(data.saidaId).not.toBeNull()

    const saidas = await prisma.departure.findMany({ where: { tripId: data.id } })
    expect(saidas).toHaveLength(1)
    expect(saidas[0]?.priceCents).toBe(9000)
  })

  it('grava a hora de parede de São Paulo como instante UTC', async () => {
    // 05:30 em Mogi é 08:30Z. Se isto quebrar, a agenda do site mostra a saída
    // no horário errado, e num projeto onde a data É o produto isso faz o
    // grupo perder a trilha.
    const res = await criarTripRota(
      criar(
        cookie,
        trilha({ primeiraSaida: { startAt: '2026-09-13T05:30', priceCents: 9000 } }),
      ) as never,
    )
    const { data } = (await res.json()) as { data: { id: number } }

    const saida = await prisma.departure.findFirstOrThrow({ where: { tripId: data.id } })
    expect(saida.startAt.toISOString()).toBe('2026-09-13T08:30:00.000Z')
  })

  it('a saída nasce em rascunho, como o roteiro', async () => {
    const res = await criarTripRota(
      criar(
        cookie,
        trilha({ primeiraSaida: { startAt: '2026-09-13T05:30', priceCents: 9000 } }),
      ) as never,
    )
    const { data } = (await res.json()) as { data: { id: number } }

    const trip = await prisma.trip.findUniqueOrThrow({ where: { id: data.id } })
    const saida = await prisma.departure.findFirstOrThrow({ where: { tripId: data.id } })

    // Publicar continua sendo um segundo gesto, para os dois. Nascer publicado
    // colocaria texto pela metade e sem foto na vitrine no instante do salvar.
    expect(trip.status).toBe('DRAFT')
    expect(saida.status).toBe('DRAFT')
  })

  it('leva ponto e horário de encontro quando vierem', async () => {
    const res = await criarTripRota(
      criar(
        cookie,
        trilha({
          primeiraSaida: {
            startAt: '2026-09-13T05:30',
            priceCents: 9000,
            meetingPoint: 'Portal de Extrema/MG, na Fernão Dias',
            meetingTimeLocal: '05:00',
          },
        }),
      ) as never,
    )
    const { data } = (await res.json()) as { data: { id: number } }

    const saida = await prisma.departure.findFirstOrThrow({ where: { tripId: data.id } })
    expect(saida.meetingPoint).toBe('Portal de Extrema/MG, na Fernão Dias')
    // Rótulo de parede, NÃO timestamp: é o que vai escrito no card e no
    // WhatsApp, e não pode sofrer conversão de fuso.
    expect(saida.meetingTimeLocal).toBe('05:00')
  })

  it('audita as duas criações', async () => {
    const res = await criarTripRota(
      criar(
        cookie,
        trilha({ primeiraSaida: { startAt: '2026-09-13T05:30', priceCents: 9000 } }),
      ) as never,
    )
    const { data } = (await res.json()) as { data: { id: number } }

    const acoes = await prisma.auditLog.findMany({
      where: { entityId: { in: [String(data.id)] } },
      select: { action: true },
    })

    expect(acoes.map((a) => a.action)).toContain('trip.create')

    const daSaida = await prisma.auditLog.findMany({ where: { entityType: 'Departure' } })
    expect(daSaida.map((a) => a.action)).toContain('departure.create')
  })
})

describe('POST /api/admin/trips sem primeiraSaida', () => {
  it('continua criando só o roteiro', async () => {
    // "Sob consulta" é estado legítimo do site, e às vezes o texto da trilha é
    // escrito antes de a data fechar com o guia.
    const res = await criarTripRota(criar(cookie, trilha()) as never)

    expect(res.status).toBe(200)
    const { data } = (await res.json()) as { data: { id: number; saidaId: number | null } }
    expect(data.saidaId).toBeNull()
    expect(await prisma.departure.count({ where: { tripId: data.id } })).toBe(0)
  })
})

describe('ou nascem os dois, ou não nasce nenhum', () => {
  it('data inválida não deixa o roteiro criado pela metade', async () => {
    // A prova da transação única. Sem ela, o roteiro ficaria gravado e a data
    // não — e a tela teria dito que deu certo.
    const antes = await prisma.trip.count()

    const res = await criarTripRota(
      criar(
        cookie,
        trilha({ primeiraSaida: { startAt: 'nao-e-uma-data', priceCents: 9000 } }),
      ) as never,
    )

    expect(res.status).toBe(400)
    expect(await prisma.trip.count()).toBe(antes)
  })

  it('data marcada sem preço é recusada, e nada é gravado', async () => {
    const antes = await prisma.trip.count()

    const res = await criarTripRota(
      criar(cookie, trilha({ primeiraSaida: { startAt: '2026-09-13T05:30' } })) as never,
    )

    expect(res.status).toBe(400)
    expect(await prisma.trip.count()).toBe(antes)
  })
})
