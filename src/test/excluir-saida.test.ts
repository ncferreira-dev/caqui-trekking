import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { DELETE as excluirRota } from '@/app/api/admin/departures/[id]/route'
import { _resetRateLimit } from '@/lib/api/rate-limit'
import { prisma } from '@/lib/prisma'
import { criarFixtures, limparBanco, type Fixtures } from '@/test/fixtures'
import { cookieDeLogin } from '@/test/sessao'

/**
 * Nasceu falhando em 14/08/2026, junto com a lixeira de saídas do CRM. Prova as
 * três cercas do excluir, que a UI sozinha não garante (o `fetch` é chamável do
 * console): só OWNER, só saída passada ou cancelada, e o resto barrado com o
 * código certo.
 */

function reqExcluir(id: number, cookie: string): Request {
  return new Request(`http://localhost:3000/api/admin/departures/${id}`, {
    method: 'DELETE',
    headers: { cookie },
  })
}

function ctx(id: number): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: String(id) }) }
}

let f: Fixtures

beforeEach(async () => {
  await limparBanco()
  _resetRateLimit()
  f = await criarFixtures()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('DELETE /api/admin/departures/:id — excluir saída', () => {
  it('OWNER exclui uma saída que já passou', async () => {
    const cookie = await cookieDeLogin('OWNER')
    const res = await excluirRota(
      reqExcluir(f.saidaPassada.id, cookie) as never,
      ctx(f.saidaPassada.id),
    )

    expect(res.status).toBe(200)
    expect(await prisma.departure.findUnique({ where: { id: f.saidaPassada.id } })).toBeNull()
  })

  it('recusa excluir saída futura ainda no ar (409) — cancele antes', async () => {
    const cookie = await cookieDeLogin('OWNER')
    const res = await excluirRota(
      reqExcluir(f.saidaDisponivel.id, cookie) as never,
      ctx(f.saidaDisponivel.id),
    )

    expect(res.status).toBe(409)
    // Continua no banco: uma data que alguém ainda pode reservar não some.
    expect(
      await prisma.departure.findUnique({ where: { id: f.saidaDisponivel.id } }),
    ).not.toBeNull()
  })

  it('ADMIN não pode excluir (403) — é ação de dono', async () => {
    const cookie = await cookieDeLogin('ADMIN')
    const res = await excluirRota(
      reqExcluir(f.saidaPassada.id, cookie) as never,
      ctx(f.saidaPassada.id),
    )

    expect(res.status).toBe(403)
    expect(await prisma.departure.findUnique({ where: { id: f.saidaPassada.id } })).not.toBeNull()
  })

  it('sem sessão, 401', async () => {
    const res = await excluirRota(
      reqExcluir(f.saidaPassada.id, '') as never,
      ctx(f.saidaPassada.id),
    )
    expect(res.status).toBe(401)
  })

  it('deixa rastro na auditoria', async () => {
    const cookie = await cookieDeLogin('OWNER')
    await excluirRota(reqExcluir(f.saidaPassada.id, cookie) as never, ctx(f.saidaPassada.id))

    const log = await prisma.auditLog.findFirst({ where: { action: 'departure.delete' } })
    expect(log).not.toBeNull()
    expect(log?.before).not.toBeNull()
  })
})
