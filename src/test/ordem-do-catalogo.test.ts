import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { PATCH as reordenarGuias } from '@/app/api/admin/guides/reorder/route'
import { PATCH as reordenarProdutos } from '@/app/api/admin/products/reorder/route'
import { PATCH as reordenarRoteiros } from '@/app/api/admin/trips/reorder/route'
import { PATCH as editarRoteiro } from '@/app/api/admin/trips/[id]/route'
import { GET as roteirosPublicos } from '@/app/api/trips/route'
import { prisma } from '@/lib/prisma'
import { criarFixtures, get, limparBanco, post, type Fixtures } from './fixtures'
import { criarUsuarios, prepararCookies } from './sessao'

/**
 * A ORDEM DA VITRINE.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O BURACO, MEDIDO EM 18/08/2026
 * ════════════════════════════════════════════════════════════════════════════
 * `/trekking` e `/wear` ordenam por `featured` e depois por `sortOrder`. Os
 * dois campos existem no schema desde o primeiro dia e o site os obedece.
 *
 * Nenhuma tela do CRM escrevia nenhum dos dois. A lista de roteiros até
 * imprimia a etiqueta "destaque", só de leitura. Ou seja: a Caqui não
 * escolhia o que aparece primeiro em nenhuma das duas vitrines, e a ordem era
 * a que o seed deixou.
 *
 * Nasceu falhando: as rotas de reordenar não existiam.
 */
describe('reordenar catálogo', () => {
  let f: Fixtures
  let cookieAdmin: string

  beforeAll(async () => {
    cookieAdmin = (await prepararCookies()).ADMIN
  })

  beforeEach(async () => {
    await limparBanco()
    await criarUsuarios()
    f = await criarFixtures()
  })

  /**
   * Publica o segundo roteiro E dá data futura a ele.
   *
   * ════════════════════════════════════════════════════════════════════════
   * A DATA MANDA MAIS QUE O DESTAQUE, E ISSO NÃO ESTAVA ESCRITO EM LUGAR NENHUM
   * ════════════════════════════════════════════════════════════════════════
   * `listarTrips` ordena no banco por `featured` e `sortOrder`, e DEPOIS
   * reordena em JS pondo quem tem saída futura na frente. Essa terceira regra
   * vence as duas primeiras.
   *
   * É a decisão certa (roteiro sem data não dá para comprar), e ela tem um
   * efeito que a interface precisa contar: marcar destaque num roteiro sem
   * data não muda nada na tela. Ver o aviso em `lista-de-roteiros.tsx`.
   */
  async function publicarComData(tripId: number): Promise<void> {
    await prisma.trip.update({ where: { id: tripId }, data: { status: 'PUBLISHED' } })
    await prisma.departure.create({
      data: {
        tripId,
        startAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        priceCents: 10_000,
        status: 'PUBLISHED',
      },
    })
  }

  async function ordemPublicaDeRoteiros(): Promise<string[]> {
    const res = await roteirosPublicos(get('/api/trips') as never)
    const corpo = (await res.json()) as { data: { slug: string }[] }
    return corpo.data.map((t) => t.slug)
  }

  it('a ordem enviada é a ordem que o site mostra', async () => {
    // Os dois precisam de data futura, senão a regra "quem tem data vem
    // primeiro" decide sozinha e o teste mediria outra coisa.
    await publicarComData(f.tripRascunho.id)

    expect(await ordemPublicaDeRoteiros()).toEqual(['trilha-de-teste', 'trilha-rascunho'])

    const res = await reordenarRoteiros(
      post(
        '/api/admin/trips/reorder',
        { ids: [f.tripRascunho.id, f.trip.id] },
        { cookie: cookieAdmin },
      ) as never,
    )
    expect(res.status).toBe(200)

    expect(await ordemPublicaDeRoteiros()).toEqual(['trilha-rascunho', 'trilha-de-teste'])
  })

  it('destaque manda mais que a ordem', async () => {
    // É o contrato do `orderBy` do site: `featured` desc, depois `sortOrder`.
    // Sem este teste, alguém poderia "consertar" a ordenação invertendo os dois
    // e nada quebraria até a Caqui reclamar que o destaque não destaca.
    await publicarComData(f.tripRascunho.id)
    await reordenarRoteiros(
      post(
        '/api/admin/trips/reorder',
        { ids: [f.trip.id, f.tripRascunho.id] },
        { cookie: cookieAdmin },
      ) as never,
    )

    await editarRoteiro(
      post(
        `/api/admin/trips/${f.tripRascunho.id}`,
        { featured: true },
        { cookie: cookieAdmin },
      ) as never,
      { params: Promise.resolve({ id: String(f.tripRascunho.id) }) } as never,
    )

    expect(await ordemPublicaDeRoteiros()).toEqual(['trilha-rascunho', 'trilha-de-teste'])
  })

  it('roteiro SEM data futura vai para o fim, mesmo em destaque', async () => {
    // A precedência real, pinada: data > destaque > ordem manual. Sem este
    // teste, alguém "consertaria" a ordenação um dia e ninguém notaria até a
    // vitrine passar a liderar por um roteiro que não dá para comprar.
    //
    // É também a razão do aviso no CRM: marcar destaque num roteiro sem data
    // não muda nada na tela, e a pessoa precisa saber disso na hora de marcar.
    await prisma.trip.update({ where: { id: f.tripRascunho.id }, data: { status: 'PUBLISHED' } })

    await editarRoteiro(
      post(
        `/api/admin/trips/${f.tripRascunho.id}`,
        { featured: true },
        { cookie: cookieAdmin },
      ) as never,
      { params: Promise.resolve({ id: String(f.tripRascunho.id) }) } as never,
    )

    // Em destaque e sem data: continua atrás de quem tem data.
    expect(await ordemPublicaDeRoteiros()).toEqual(['trilha-de-teste', 'trilha-rascunho'])
  })

  it('a lista precisa estar COMPLETA, e recusa manifesto pela metade', async () => {
    // Mesma regra do reordenar de mídia: uma chamada, o manifesto inteiro. Uma
    // lista parcial deixaria metade do catálogo com a ordem antiga e a outra
    // metade renumerada a partir do zero, embaralhando as duas.
    const res = await reordenarRoteiros(
      post('/api/admin/trips/reorder', { ids: [f.trip.id] }, { cookie: cookieAdmin }) as never,
    )
    expect(res.status).toBe(409)
  })

  it('recusa id repetido, mesmo com o conjunto completo', async () => {
    // A lista tem os dois roteiros E uma repetição. Em CONJUNTO ela está
    // completa, então a checagem de completude não pega — só a de repetição.
    // Sem ela, o laço gravaria o mesmo item duas vezes e a última posição
    // venceria, embaralhando a ordem em silêncio.
    const res = await reordenarRoteiros(
      post(
        '/api/admin/trips/reorder',
        { ids: [f.trip.id, f.tripRascunho.id, f.trip.id] },
        { cookie: cookieAdmin },
      ) as never,
    )
    expect(res.status).toBe(409)
  })

  it('recusa id que não é do catálogo', async () => {
    const res = await reordenarRoteiros(
      post(
        '/api/admin/trips/reorder',
        { ids: [f.trip.id, f.tripRascunho.id, 99_999] },
        { cookie: cookieAdmin },
      ) as never,
    )
    expect(res.status).toBe(409)
  })

  it('roteiro arquivado não entra na conta', async () => {
    // Arquivado sai da tela e sai do manifesto. Exigi-lo na lista obrigaria a
    // interface a mandar um id que ela não mostra.
    await prisma.trip.update({ where: { id: f.tripRascunho.id }, data: { deletedAt: new Date() } })

    const res = await reordenarRoteiros(
      post('/api/admin/trips/reorder', { ids: [f.trip.id] }, { cookie: cookieAdmin }) as never,
    )
    expect(res.status).toBe(200)
  })

  it('reordena peças da loja', async () => {
    const outra = await prisma.product.create({
      data: { slug: 'boné-de-teste', name: 'Boné', category: 'BONE', priceCents: 7000 },
    })

    const res = await reordenarProdutos(
      post(
        '/api/admin/products/reorder',
        { ids: [outra.id, f.produto.id] },
        { cookie: cookieAdmin },
      ) as never,
    )
    expect(res.status).toBe(200)

    const salvos = await prisma.product.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    })
    expect(salvos.map((p) => p.id)).toEqual([outra.id, f.produto.id])
  })

  it('reordena guias', async () => {
    const outro = await prisma.guide.create({ data: { name: 'Segundo Guia' } })

    const res = await reordenarGuias(
      post(
        '/api/admin/guides/reorder',
        { ids: [outro.id, f.guia.id] },
        { cookie: cookieAdmin },
      ) as never,
    )
    expect(res.status).toBe(200)

    const salvos = await prisma.guide.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    })
    expect(salvos.map((g) => g.id)).toEqual([outro.id, f.guia.id])
  })

  it('sem sessão, 401 e a ordem fica como estava', async () => {
    const res = await reordenarRoteiros(
      post('/api/admin/trips/reorder', { ids: [f.tripRascunho.id, f.trip.id] }) as never,
    )
    expect(res.status).toBe(401)

    const salvo = await prisma.trip.findUniqueOrThrow({ where: { id: f.trip.id } })
    expect(salvo.sortOrder).toBe(0)
  })
})
