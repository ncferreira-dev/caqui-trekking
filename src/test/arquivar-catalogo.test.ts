import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { DELETE as arquivarProdutoRota } from '@/app/api/admin/products/[id]/route'
import { DELETE as arquivarRoteiroRota } from '@/app/api/admin/trips/[id]/route'
import { GET as produtosPublicos } from '@/app/api/products/route'
import { GET as roteirosPublicos } from '@/app/api/trips/route'
import { prisma } from '@/lib/prisma'
import { criarFixtures, get, limparBanco, post, type Fixtures } from './fixtures'
import { criarUsuarios, prepararCookies } from './sessao'

/**
 * ARQUIVAR ROTEIRO E PEÇA.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O BURACO, MEDIDO EM 18/08/2026
 * ════════════════════════════════════════════════════════════════════════════
 * `DELETE /api/admin/trips/:id` existia, estava correta, e nenhuma tela a
 * chamava. `DELETE /api/admin/products/:id` não existia: `Product.deletedAt`
 * estava no schema, era respeitado em toda leitura pública, e nenhum caminho
 * do sistema conseguia escrevê-lo.
 *
 * Dava para esconder os dois pondo em rascunho. Só que rascunho significa
 * "ainda não está pronto", e a peça descontinuada ficava para sempre no meio
 * da tela de quem opera com a cara de algo que vai ser publicado.
 */
describe('arquivar catálogo', () => {
  let f: Fixtures
  let cookieOwner: string
  let cookieAdmin: string

  beforeAll(async () => {
    const c = await prepararCookies()
    cookieOwner = c.OWNER
    cookieAdmin = c.ADMIN
  })

  beforeEach(async () => {
    await limparBanco()
    await criarUsuarios()
    f = await criarFixtures()
  })

  const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) }) as never

  it('roteiro arquivado some do site e a linha continua no banco', async () => {
    const res = await arquivarRoteiroRota(
      post(`/api/admin/trips/${f.trip.id}`, {}, { cookie: cookieOwner }) as never,
      ctx(f.trip.id),
    )
    expect(res.status).toBe(200)

    const salvo = await prisma.trip.findUniqueOrThrow({ where: { id: f.trip.id } })
    expect(salvo.deletedAt).not.toBeNull()
    expect(salvo.status).toBe('ARCHIVED')

    const publicos = (await (await roteirosPublicos(get('/api/trips') as never)).json()) as {
      data: { slug: string }[]
    }
    expect(publicos.data.map((t) => t.slug)).not.toContain('trilha-de-teste')
  })

  it('as saídas do roteiro arquivado continuam registradas', async () => {
    // É o motivo de ser soft delete: um `delete` de verdade levaria as saídas
    // por cascade e reescreveria o histórico do que já aconteceu.
    const antes = await prisma.departure.count({ where: { tripId: f.trip.id } })
    expect(antes).toBeGreaterThan(0)

    await arquivarRoteiroRota(
      post(`/api/admin/trips/${f.trip.id}`, {}, { cookie: cookieOwner }) as never,
      ctx(f.trip.id),
    )

    expect(await prisma.departure.count({ where: { tripId: f.trip.id } })).toBe(antes)
  })

  it('peça arquivada some da loja e as variantes ficam', async () => {
    const variantes = await prisma.productVariant.count({ where: { productId: f.produto.id } })
    expect(variantes).toBeGreaterThan(0)

    const res = await arquivarProdutoRota(
      post(`/api/admin/products/${f.produto.id}`, {}, { cookie: cookieOwner }) as never,
      ctx(f.produto.id),
    )
    expect(res.status).toBe(200)

    const salvo = await prisma.product.findUniqueOrThrow({ where: { id: f.produto.id } })
    expect(salvo.deletedAt).not.toBeNull()
    expect(salvo.status).toBe('ARCHIVED')
    // Arquivar tira do destaque: uma peça fora da loja em "destaque" é um
    // estado que não significa nada e volta a atrapalhar se ela for reativada.
    expect(salvo.featured).toBe(false)

    expect(await prisma.productVariant.count({ where: { productId: f.produto.id } })).toBe(
      variantes,
    )

    const publicos = (await (await produtosPublicos(get('/api/products') as never)).json()) as {
      data: { slug: string }[]
    }
    expect(publicos.data.map((p) => p.slug)).not.toContain('camiseta-de-teste')
  })

  it('ADMIN não arquiva nem roteiro nem peça', async () => {
    const r = await arquivarRoteiroRota(
      post(`/api/admin/trips/${f.trip.id}`, {}, { cookie: cookieAdmin }) as never,
      ctx(f.trip.id),
    )
    const p = await arquivarProdutoRota(
      post(`/api/admin/products/${f.produto.id}`, {}, { cookie: cookieAdmin }) as never,
      ctx(f.produto.id),
    )

    expect(r.status).toBe(403)
    expect(p.status).toBe(403)
    expect((await prisma.trip.findUniqueOrThrow({ where: { id: f.trip.id } })).deletedAt).toBeNull()
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: f.produto.id } })).deletedAt,
    ).toBeNull()
  })

  it('arquivar duas vezes devolve 404, e não apaga duas vezes', async () => {
    await arquivarProdutoRota(
      post(`/api/admin/products/${f.produto.id}`, {}, { cookie: cookieOwner }) as never,
      ctx(f.produto.id),
    )
    const segunda = await arquivarProdutoRota(
      post(`/api/admin/products/${f.produto.id}`, {}, { cookie: cookieOwner }) as never,
      ctx(f.produto.id),
    )
    expect(segunda.status).toBe(404)
  })
})
