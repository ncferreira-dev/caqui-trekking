import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { GET as guiasPublicos } from '@/app/api/guides/route'
import { POST as criarRota } from '@/app/api/admin/guides/route'
import { DELETE as arquivarRota, PATCH as editarRota } from '@/app/api/admin/guides/[id]/route'
import { prisma } from '@/lib/prisma'
import { criarFixtures, get, limparBanco, post, type Fixtures } from './fixtures'
import { criarUsuarios, prepararCookies } from './sessao'

/**
 * OS GUIAS, NO PAINEL.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O BURACO, MEDIDO EM 18/08/2026
 * ════════════════════════════════════════════════════════════════════════════
 * `Guide` tinha apenas `GET /api/guides`, público. Nome, Cadastur e credencial
 * do PESM eram imutáveis pelo painel — e são exatamente os números que o site
 * publica como prova de que a operação é regular. Renovar um Cadastur, trocar
 * de guia ou tirar do ar quem saiu da equipe exigia escrever no banco à mão.
 *
 * Nasceu falhando: as rotas não existiam.
 */
describe('guias no painel', () => {
  let f: Fixtures
  let cookieAdmin: string
  let cookieOwner: string

  // Dois logins para o ARQUIVO inteiro, e não dois por caso: o rate limit do
  // login é em memória e vale para a suíte toda. Ver `sessao.ts`.
  beforeAll(async () => {
    const cookies = await prepararCookies()
    cookieOwner = cookies.OWNER
    cookieAdmin = cookies.ADMIN
  })

  beforeEach(async () => {
    await limparBanco()
    // Recria com os MESMOS ids (RESTART IDENTITY + ordem fixa), o que mantém
    // os cookies acima válidos: eles carregam só identidade.
    await criarUsuarios()
    f = await criarFixtures()
  })

  const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) }) as never

  async function listarPublicos(): Promise<{ id: number; nome: string }[]> {
    // Desde o teto de leitura pública, a rota recebe a Request para extrair o
    // IP do balde. Ver `limitarLeituraPublica`.
    const res = await guiasPublicos(get('/api/guides') as never)
    const corpo = (await res.json()) as { data: { id: number; nome: string }[] }
    return corpo.data
  }

  it('cria um guia com Cadastur e PESM', async () => {
    const res = await criarRota(
      post(
        '/api/admin/guides',
        { nome: 'Nova Guia', cadastur: '11.111111.11-1', pesm: 'PESM-0001' },
        { cookie: cookieAdmin },
      ) as never,
    )
    expect(res.status).toBe(200)

    const { data } = (await res.json()) as { data: { id: number } }
    const salvo = await prisma.guide.findUniqueOrThrow({ where: { id: data.id } })
    expect(salvo.name).toBe('Nova Guia')
    expect(salvo.cadasturNumber).toBe('11.111111.11-1')
    expect(salvo.pesmCredential).toBe('PESM-0001')
    expect(salvo.active).toBe(true)
  })

  it('o novo entra no FIM da ordem, não na frente de quem já está lá', async () => {
    // `sortOrder: 0` por padrão jogaria o recém-cadastrado para o topo da
    // página "Quem guia", passando na frente da equipe, sem ninguém pedir.
    await prisma.guide.update({ where: { id: f.guia.id }, data: { sortOrder: 5 } })

    const res = await criarRota(
      post('/api/admin/guides', { nome: 'Ultimo' }, { cookie: cookieAdmin }) as never,
    )
    const { data } = (await res.json()) as { data: { id: number; ordem: number } }
    expect(data.ordem).toBe(6)
  })

  it('desativar tira do site na hora, e é reversível', async () => {
    expect((await listarPublicos()).map((g) => g.id)).toContain(f.guia.id)

    await editarRota(
      post(`/api/admin/guides/${f.guia.id}`, { ativo: false }, { cookie: cookieAdmin }) as never,
      ctx(f.guia.id),
    )
    expect((await listarPublicos()).map((g) => g.id)).not.toContain(f.guia.id)

    await editarRota(
      post(`/api/admin/guides/${f.guia.id}`, { ativo: true }, { cookie: cookieAdmin }) as never,
      ctx(f.guia.id),
    )
    expect((await listarPublicos()).map((g) => g.id)).toContain(f.guia.id)
  })

  it('arquivar é SOFT DELETE: a linha fica, e a escala da saída passada também', async () => {
    // As saídas já realizadas guardam quem guiou, e é essa a prova de que a
    // trilha teve guia credenciado. Um DELETE de verdade levaria as linhas de
    // `DepartureGuide` por cascade e reescreveria o passado.
    const antes = await prisma.departureGuide.count({ where: { guideId: f.guia.id } })
    expect(antes).toBeGreaterThan(0)

    const res = await arquivarRota(
      post(`/api/admin/guides/${f.guia.id}`, {}, { cookie: cookieOwner }) as never,
      ctx(f.guia.id),
    )
    expect(res.status).toBe(200)

    const salvo = await prisma.guide.findUniqueOrThrow({ where: { id: f.guia.id } })
    expect(salvo.deletedAt).not.toBeNull()
    expect(salvo.active).toBe(false)
    expect(await prisma.departureGuide.count({ where: { guideId: f.guia.id } })).toBe(antes)
    expect((await listarPublicos()).map((g) => g.id)).not.toContain(f.guia.id)
  })

  it('ADMIN não arquiva guia', async () => {
    // Mesma régua de `trips/[id]`: tirar do ar quem o site apresenta como
    // equipe é decisão de quem responde pela empresa.
    const res = await arquivarRota(
      post(`/api/admin/guides/${f.guia.id}`, {}, { cookie: cookieAdmin }) as never,
      ctx(f.guia.id),
    )
    expect(res.status).toBe(403)

    const salvo = await prisma.guide.findUniqueOrThrow({ where: { id: f.guia.id } })
    expect(salvo.deletedAt).toBeNull()
  })

  it('sem sessão, nada acontece', async () => {
    const res = await criarRota(post('/api/admin/guides', { nome: 'Intruso' }) as never)
    expect(res.status).toBe(401)
    expect(await prisma.guide.count({ where: { name: 'Intruso' } })).toBe(0)
  })

  it('recusa campo desconhecido em vez de ignorar', async () => {
    const res = await criarRota(
      post(
        '/api/admin/guides',
        { nome: 'X', cadasturNumber: '1' },
        { cookie: cookieAdmin },
      ) as never,
    )
    expect(res.status).toBe(400)
  })
})
