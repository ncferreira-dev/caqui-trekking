import { beforeEach, describe, expect, it } from 'vitest'

import { PATCH as atualizarRota } from '@/app/api/admin/trips/[id]/route'
import { prisma } from '@/lib/prisma'
import { criarFixtures, limparBanco, post, type Fixtures } from './fixtures'
import { cookieDeLogin } from './sessao'

/**
 * LIGAR ATIVIDADE A ROTEIRO.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O QUE ESTAVA FALTANDO, MEDIDO EM 18/08/2026
 * ════════════════════════════════════════════════════════════════════════════
 * `ActivityTag` tinha CRUD completo na API e `TripActivityTag` não tinha
 * NENHUMA rota. Dava para criar a tag "Rapel" e não existia caminho, em
 * lugar nenhum do sistema, para dizer que a trilha do Escalavrado tem rapel.
 *
 * Não é detalhe de catalogação: a tag é o filtro "Atividade" da agenda e do
 * índice de roteiros, e é ela que responde "o que dá para fazer aqui". Sem a
 * ligação, o filtro só oferece o que o seed deixou pronto.
 *
 * Nasceu falhando: `atualizarSchema` é `.strict()`, então `activityTagIds`
 * chegava como campo desconhecido e virava 400.
 */
describe('PATCH /api/admin/trips/:id — activityTagIds', () => {
  let f: Fixtures
  let cookieAdmin: string

  beforeEach(async () => {
    await limparBanco()
    f = await criarFixtures()
    cookieAdmin = await cookieDeLogin('ADMIN')
  })

  async function patch(id: number, corpo: unknown) {
    const req = post(`/api/admin/trips/${id}`, corpo, { cookie: cookieAdmin })
    return atualizarRota(req as never, { params: Promise.resolve({ id: String(id) }) } as never)
  }

  async function tagsDo(tripId: number): Promise<string[]> {
    const linhas = await prisma.tripActivityTag.findMany({
      where: { tripId },
      select: { activityTag: { select: { slug: true } } },
      orderBy: { activityTagId: 'asc' },
    })
    return linhas.map((l) => l.activityTag.slug)
  }

  it('liga uma atividade ao roteiro', async () => {
    const cachoeira = await prisma.activityTag.create({
      data: { slug: 'cachoeira', label: 'Cachoeira' },
    })

    const res = await patch(f.trip.id, { activityTagIds: [f.tag.id, cachoeira.id] })
    expect(res.status).toBe(200)
    expect(await tagsDo(f.trip.id)).toEqual(['rapel', 'cachoeira'])
  })

  it('a lista é o estado final, não um acréscimo', async () => {
    // Semântica de SUBSTITUIÇÃO. Se fosse acréscimo, desmarcar uma caixa no
    // formulário não teria efeito nenhum, e a pessoa só descobriria isso
    // olhando o site depois.
    expect(await tagsDo(f.trip.id)).toEqual(['rapel'])

    const res = await patch(f.trip.id, { activityTagIds: [] })
    expect(res.status).toBe(200)
    expect(await tagsDo(f.trip.id)).toEqual([])
  })

  it('não duplica quando a mesma tag vem repetida', async () => {
    // O par (tripId, activityTagId) é único no banco. Sem deduplicar antes de
    // gravar, um `createMany` com repetição estoura e o PATCH inteiro falha
    // por causa de um clique duplo na interface.
    const res = await patch(f.trip.id, { activityTagIds: [f.tag.id, f.tag.id] })
    expect(res.status).toBe(200)
    expect(await tagsDo(f.trip.id)).toEqual(['rapel'])
  })

  it('recusa id de tag que não existe, em vez de gravar pela metade', async () => {
    const res = await patch(f.trip.id, { activityTagIds: [f.tag.id, 99_999] })
    expect(res.status).toBeGreaterThanOrEqual(400)
    // E o que já estava ligado continua como estava: nada de meia-gravação.
    expect(await tagsDo(f.trip.id)).toEqual(['rapel'])
  })

  it('sem o campo, as atividades ficam intactas', async () => {
    // O PATCH é parcial. Salvar só o título não pode desligar as atividades.
    const res = await patch(f.trip.id, { title: 'Outro nome para a trilha' })
    expect(res.status).toBe(200)
    expect(await tagsDo(f.trip.id)).toEqual(['rapel'])
  })

  it('registra na auditoria o que mudou', async () => {
    await patch(f.trip.id, { activityTagIds: [] })
    const registro = await prisma.auditLog.findFirst({
      // `entityId` é String no schema: a auditoria guarda id de entidades com
      // chave de tipos diferentes na mesma coluna.
      where: { entityType: 'Trip', entityId: String(f.trip.id), action: 'trip.update' },
      orderBy: { id: 'desc' },
    })
    expect(registro).not.toBeNull()
    // O antes e o depois precisam mostrar a MUDANÇA: sem as tags no registro,
    // a auditoria diria "roteiro atualizado" sem dizer o quê.
    const antes = registro?.before as { activityTags?: number[] } | null
    const depois = registro?.after as { activityTags?: number[] } | null
    expect(antes?.activityTags).toEqual([f.tag.id])
    expect(depois?.activityTags).toEqual([])
  })
})
