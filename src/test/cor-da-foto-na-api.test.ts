import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { PATCH as editarMidia } from '@/app/api/admin/media/[id]/route'
import { GET as produtoPublico } from '@/app/api/products/[slug]/route'
import { prisma } from '@/lib/prisma'
import { criarFixtures, get, limparBanco, post, type Fixtures } from './fixtures'
import { criarUsuarios, prepararCookies } from './sessao'

/**
 * LIGAR FOTO A COR, PELA API.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * A CONFERÊNCIA É DO SERVIDOR, E ISSO NÃO É PARANOIA
 * ════════════════════════════════════════════════════════════════════════════
 * A tela oferece um `<select>` com as cores que a peça tem. `<select>` é
 * cortesia: o `fetch` continua chamável do console.
 *
 * Um `colorName` que não bate com variante nenhuma produz o pior estado
 * possível deste campo: a foto não é da cor de ninguém e também não é neutra,
 * então ela some da galeria para SEMPRE, sem erro e sem aviso.
 */
describe('PATCH /api/admin/media/:id — a cor', () => {
  let f: Fixtures
  let cookie: string

  beforeAll(async () => {
    cookie = (await prepararCookies()).ADMIN
  })

  beforeEach(async () => {
    await limparBanco()
    await criarUsuarios()
    f = await criarFixtures()
  })

  const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) }) as never

  async function fotoDaPeca(cor: string | null = null) {
    return prisma.mediaAsset.create({
      data: {
        url: 'https://exemplo.test/foto.jpg',
        publicId: 'caqui/produto/1/teste',
        alt: 'Camiseta de teste',
        width: 1200,
        height: 1200,
        sortOrder: 0,
        productId: f.produto.id,
        colorName: cor,
      },
    })
  }

  async function definir(midiaId: number, corpo: unknown) {
    return editarMidia(
      post(`/api/admin/media/${midiaId}`, corpo, { cookie }) as never,
      ctx(midiaId),
    )
  }

  it('aceita uma cor que a peça tem', async () => {
    const foto = await fotoDaPeca()

    const res = await definir(foto.id, { cor: 'Preto' })
    expect(res.status).toBe(200)

    const salva = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: foto.id } })
    expect(salva.colorName).toBe('Preto')
  })

  it('RECUSA cor que a peça não tem', async () => {
    // Sem esta trava, a foto vira invisível: nem da cor, nem neutra.
    const foto = await fotoDaPeca()

    const res = await definir(foto.id, { cor: 'Verde-limão' })
    expect(res.status).toBe(400)

    const salva = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: foto.id } })
    expect(salva.colorName).toBeNull()
  })

  it('a conferência ignora caixa e espaço, como a loja', () => {
    // Se a validação e o filtro da loja divergissem, a foto gravaria "ok" e
    // sumiria da vitrine. As duas passam por `normalizarCor`.
    return fotoDaPeca()
      .then((foto) => definir(foto.id, { cor: ' preto ' }))
      .then((res) => expect(res.status).toBe(200))
  })

  it('`cor: null` limpa a associação, e não é ignorado', async () => {
    // `null` é VALOR: "serve para qualquer cor". Uma rota que testasse
    // `if (corpo.cor)` engoliria a limpeza em silêncio.
    const foto = await fotoDaPeca('Preto')

    const res = await definir(foto.id, { cor: null })
    expect(res.status).toBe(200)

    const salva = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: foto.id } })
    expect(salva.colorName).toBeNull()
  })

  it('foto de ROTEIRO não aceita cor', async () => {
    const doRoteiro = await prisma.mediaAsset.create({
      data: {
        url: 'https://exemplo.test/trilha.jpg',
        publicId: 'caqui/roteiro/1/teste',
        alt: 'Trilha',
        width: 1200,
        height: 800,
        tripId: f.trip.id,
      },
    })

    const res = await definir(doRoteiro.id, { cor: 'Preto' })
    expect(res.status).toBe(400)
  })

  it('o alt continua sendo editável pelo mesmo PATCH', async () => {
    // Dois gestos, dois corpos, uma rota. Um não pode ter quebrado o outro.
    const foto = await fotoDaPeca()

    const res = await definir(foto.id, { alt: 'Outro texto' })
    expect(res.status).toBe(200)

    const salva = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: foto.id } })
    expect(salva.alt).toBe('Outro texto')
  })

  it('a loja recebe a cor de cada foto', async () => {
    await fotoDaPeca('Preto')

    // A rota pública é por SLUG, não por id: o contexto tem outra forma.
    const res = await produtoPublico(
      get('/api/products/camiseta-de-teste') as never,
      {
        params: Promise.resolve({ slug: 'camiseta-de-teste' }),
      } as never,
    )
    const corpo = (await res.json()) as { data: { imagens: { cor: string | null }[] } }

    expect(corpo.data.imagens[0]?.cor).toBe('Preto')
  })

  it('sem sessão, a cor não muda', async () => {
    const foto = await fotoDaPeca()
    const res = await editarMidia(
      post(`/api/admin/media/${foto.id}`, { cor: 'Preto' }) as never,
      ctx(foto.id),
    )
    expect(res.status).toBe(401)
    expect(
      (await prisma.mediaAsset.findUniqueOrThrow({ where: { id: foto.id } })).colorName,
    ).toBeNull()
  })
})
