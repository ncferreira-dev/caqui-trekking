import { beforeEach, describe, expect, it } from 'vitest'

import { POST as criarSaidaRota } from '@/app/api/admin/departures/route'
import { rota } from '@/lib/api/route-handler'
import { criarFixtures, limparBanco, post, type Fixtures } from './fixtures'
import { cookieDeLogin } from './sessao'

/**
 * COLISÃO DE DADO ÚNICO → 409, NUNCA 500.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O DEFEITO, ENCONTRADO NA AUDITORIA DE 20/08/2026 (docs/20-auditoria-do-crm.md)
 * ════════════════════════════════════════════════════════════════════════════
 * O tratador central já mapeava P2025 do Prisma para 404. P2002 — violação de
 * restrição única — não era mapeado, e caía no ramo do desconhecido: 500 com
 * "Erro interno. Tente novamente." e um requestId.
 *
 * As rotas conferem antes de inserir, então o caminho tranquilo sempre deu 409
 * com texto próprio. O buraco era a CORRIDA: duas requisições passando pela
 * conferência no mesmo instante, e quem barra sendo o índice do banco.
 *
 * O sintoma para quem opera: duplo clique em "duplicar para o mês seguinte"
 * devolvia erro de sistema. A pessoa tentava de novo, via o registro lá, e
 * ficava sem saber se tinha criado dois.
 *
 * Nasceu falhando: sem o ramo P2002 em `route-handler.ts`, o primeiro caso
 * responde 500.
 */

describe('rota() mapeia P2002 do Prisma', () => {
  // Direto no tratador, e não por uma rota real, de propósito: forçar a corrida
  // de verdade num teste seria disputa de agendamento, e o que precisa ser
  // provado aqui é o MAPEAMENTO. A corrida real está no bloco de baixo.
  function erroDoPrisma(meta: unknown) {
    return Object.assign(new Error('Unique constraint failed'), { code: 'P2002', meta })
  }

  it('devolve 409 CONFLICT, não 500', async () => {
    const handler = rota(async () => {
      throw erroDoPrisma({ target: ['email'] })
    })

    const res = await handler()

    expect(res.status).toBe(409)
    const corpo = (await res.json()) as { error: { code: string; requestId?: string } }
    expect(corpo.error.code).toBe('CONFLICT')
    // Sem requestId: requestId é a marca do erro que ninguém previu, e este
    // passou a ser previsto.
    expect(corpo.error.requestId).toBeUndefined()
  })

  it('diz qual campo colidiu, quando o Prisma informa', async () => {
    const handler = rota(async () => {
      throw erroDoPrisma({ target: ['email'] })
    })

    const corpo = (await (await handler()).json()) as {
      error: { details?: { field: string; code: string }[] }
    }

    expect(corpo.error.details).toEqual([
      { field: 'email', code: 'unique', message: 'Já está em uso.' },
    ])
  })

  it('aceita o alvo como string única, e não só como lista', async () => {
    // O formato de `meta.target` varia conforme o caminho do Prisma. Tratar só
    // o array faria o outro formato cair no ramo do desconhecido de novo —
    // exatamente o defeito que este arquivo existe para fechar.
    const handler = rota(async () => {
      throw erroDoPrisma({ target: 'departures_tripId_startAt_key' })
    })

    const res = await handler()
    const corpo = (await res.json()) as { error: { details?: { field: string }[] } }

    expect(res.status).toBe(409)
    expect(corpo.error.details?.[0]?.field).toBe('departures_tripId_startAt_key')
  })

  it('sem meta utilizável, ainda é 409 — só sem detalhe de campo', async () => {
    const handler = rota(async () => {
      throw erroDoPrisma(undefined)
    })

    const res = await handler()
    const corpo = (await res.json()) as { error: { code: string; details?: unknown } }

    expect(res.status).toBe(409)
    expect(corpo.error.code).toBe('CONFLICT')
    expect(corpo.error.details).toBeUndefined()
  })

  it('não sequestra outros códigos do Prisma', async () => {
    // A escada de `if` é fácil de quebrar num refactor. P2025 continua 404.
    const handler = rota(async () => {
      throw Object.assign(new Error('não achou'), { code: 'P2025' })
    })

    expect((await handler()).status).toBe(404)
  })
})

describe('duas criações simultâneas da mesma saída', () => {
  let f: Fixtures
  let cookieAdmin: string

  beforeEach(async () => {
    await limparBanco()
    f = await criarFixtures()
    cookieAdmin = await cookieDeLogin('ADMIN')
  })

  it('uma passa, a outra recebe 409 — e nenhuma recebe 500', async () => {
    // O cenário real do duplo clique. Qual das duas barreiras pega — a
    // conferência da rota ou o índice do banco — depende do agendamento, e o
    // teste de propósito NÃO se importa: as duas precisam responder 409.
    //
    // É por isso que a asserção é sobre o conjunto, e não sobre a ordem. Um
    // teste que exigisse "a segunda dá 409" seria instável sem provar mais
    // nada.
    const corpo = {
      tripId: f.trip.id,
      startAt: '2026-12-25T06:00',
      priceCents: 9000,
      meetingPoint: null,
      meetingTimeLocal: null,
      meetingLat: null,
      meetingLng: null,
    }

    const [a, b] = await Promise.all([
      criarSaidaRota(post('/api/admin/departures', corpo, { cookie: cookieAdmin }) as never),
      criarSaidaRota(post('/api/admin/departures', corpo, { cookie: cookieAdmin }) as never),
    ])

    const status = [a.status, b.status].sort((x, y) => x - y)

    expect(status).toEqual([200, 409])
    expect(status).not.toContain(500)
  })
})
