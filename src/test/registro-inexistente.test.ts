import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { PATCH as marcarMensagem } from '@/app/api/admin/messages/route'
import { _resetRateLimit } from '@/lib/api/rate-limit'
import { prisma } from '@/lib/prisma'
import { limparBanco } from '@/test/fixtures'
import { cookieDeLogin } from '@/test/sessao'

/**
 * Nasceu falhando em 14/08/2026. O PATCH de mensagens faz `prisma.update`
 * inline; um id válido mas inexistente faz o Prisma lançar P2025, que antes caía
 * no fallback e virava 500. O handler central agora mapeia P2025 → 404 para a
 * CLASSE toda (route-handler.ts), então qualquer update inline em id apagado
 * responde 404. Este teste prova o mapeamento.
 */

function patchMensagem(cookie: string, corpo: unknown): Request {
  return new Request('http://localhost:3000/api/admin/messages', {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  })
}

beforeEach(async () => {
  await limparBanco()
  _resetRateLimit()
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('update inline em registro inexistente → 404 (P2025)', () => {
  it('marcar mensagem que não existe devolve 404 NOT_FOUND, não 500', async () => {
    const cookie = await cookieDeLogin('OWNER')

    const res = await marcarMensagem(patchMensagem(cookie, { id: 999_999, lida: true }) as never)

    expect(res.status).toBe(404)
    const corpo = (await res.json()) as { error: { code: string } }
    expect(corpo.error.code).toBe('NOT_FOUND')
  })
})
