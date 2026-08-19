import { beforeEach, describe, expect, it } from 'vitest'

import { POST as criarRota } from '@/app/api/admin/trips/route'
import { prisma } from '@/lib/prisma'
import { criarFixtures, limparBanco, post, type Fixtures } from './fixtures'
import { cookieDeLogin } from './sessao'

/**
 * CRIAR ROTEIRO — a rota que faltava.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O BURACO, MEDIDO EM 18/08/2026
 * ════════════════════════════════════════════════════════════════════════════
 * `/api/admin/trips` tinha apenas GET. O CRM sabia editar, publicar, destacar e
 * arquivar roteiro, e não sabia criar nenhum: os cinco que existiam vieram do
 * seed, e a única saída seria escrever no banco à mão.
 *
 * `Trip` é a entidade central: saída, mídia, tag e mensagem penduram nela. O
 * gargalo não era uma tela faltando, era o sistema inteiro ancorado no que o
 * seed deixou.
 */
describe('POST /api/admin/trips', () => {
  let f: Fixtures
  /**
   * O cookie é obtido UMA vez por caso, e não uma vez por chamada.
   *
   * `POST /api/auth/login` tem limite de taxa por IP (10 a cada 15 min), e ele
   * é um backstop persistente no banco de propósito — em serverless o contador
   * em memória reseta a cada cold start. O caso que varre cinco campos
   * obrigatórios fazia cinco logins e batia no teto, com o teste falhando por
   * 429 em vez de pelo que ele mede.
   */
  let cookieAdmin: string

  beforeEach(async () => {
    await limparBanco()
    f = await criarFixtures()
    cookieAdmin = await cookieDeLogin('ADMIN')
  })

  const NOVO = {
    title: 'Travessia Petrópolis x Teresópolis',
    description: 'Três dias de travessia pelo Parque Nacional da Serra dos Órgãos.',
    city: 'Petrópolis',
    state: 'rj',
    difficulty: 'EXTREMO' as const,
  }

  async function criar(corpo: unknown) {
    return criarRota(post('/api/admin/trips', corpo, { cookie: cookieAdmin }) as never)
  }

  it('cria o roteiro e devolve o slug', async () => {
    const res = await criar(NOVO)
    expect(res.status).toBe(200)

    const { data } = (await res.json()) as { data: { id: number; slug: string } }
    expect(data.slug).toBe('travessia-petropolis-x-teresopolis')

    const salvo = await prisma.trip.findUniqueOrThrow({ where: { id: data.id } })
    expect(salvo.title).toBe(NOVO.title)
    expect(salvo.city).toBe('Petrópolis')
  })

  it('a sigla do estado é normalizada para maiúscula', () => {
    // O banco tem VarChar(2) e a UI mostra o valor cru. "rj" e "RJ" viram duas
    // grafias do mesmo estado numa lista ordenada.
    return criar(NOVO)
      .then((r) => r.json() as Promise<{ data: { id: number } }>)
      .then(({ data }) => prisma.trip.findUniqueOrThrow({ where: { id: data.id } }))
      .then((salvo) => expect(salvo.state).toBe('RJ'))
  })

  it('NASCE EM RASCUNHO, e não há como pedir o contrário', async () => {
    // Roteiro recém-criado não tem foto, não tem saída e tem descrição pela
    // metade. Publicar por padrão colocaria isso na vitrine no instante do
    // "salvar". Publicar é um segundo gesto.
    const { data } = (await (await criar(NOVO)).json()) as { data: { id: number } }
    const salvo = await prisma.trip.findUniqueOrThrow({ where: { id: data.id } })

    expect(salvo.status).toBe('DRAFT')
    expect(salvo.featured).toBe(false)

    // E o schema é estrito: mandar `status` é 400, não é ignorado em silêncio.
    const comStatus = await criar({ ...NOVO, status: 'PUBLISHED' })
    expect(comStatus.status).toBe(400)
  })

  it('o slug não colide com um roteiro existente', async () => {
    const existente = await prisma.trip.findUniqueOrThrow({ where: { id: f.trip.id } })

    const { data } = (await (await criar({ ...NOVO, title: existente.title })).json()) as {
      data: { slug: string }
    }

    expect(data.slug).not.toBe(existente.slug)
    expect(data.slug.startsWith(existente.slug)).toBe(true)
  })

  it('o slug não reaproveita o de um roteiro ARQUIVADO', async () => {
    // Reaproveitar roubaria a URL que o roteiro arquivado ainda pode ter em
    // link mandado no WhatsApp meses atrás.
    const arquivado = await prisma.trip.findUniqueOrThrow({ where: { id: f.trip.id } })
    await prisma.trip.update({ where: { id: f.trip.id }, data: { deletedAt: new Date() } })

    const { data } = (await (await criar({ ...NOVO, title: arquivado.title })).json()) as {
      data: { slug: string }
    }

    expect(data.slug).not.toBe(arquivado.slug)
  })

  it('grava auditoria com autor', async () => {
    await criar(NOVO)

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: 'Trip', action: 'trip.create' },
    })
    expect(log.userId).not.toBeNull()
    expect(log.after).toMatchObject({ titulo: NOVO.title })
  })

  it('recusa sem os campos que não dá para adivinhar depois', async () => {
    for (const faltando of ['title', 'description', 'city', 'state', 'difficulty'] as const) {
      const corpo: Record<string, unknown> = { ...NOVO }
      delete corpo[faltando]

      const res = await criar(corpo)
      expect(res.status, `sem ${faltando} deveria dar 400`).toBe(400)
    }
  })

  it('recusa sem sessão', async () => {
    const res = await criarRota(post('/api/admin/trips', NOVO) as never)
    expect(res.status).toBe(401)
  })
})
