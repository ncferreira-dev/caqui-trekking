import { beforeEach, describe, expect, it } from 'vitest'

import { POST as criarRota } from '@/app/api/admin/departures/route'
import { prisma } from '@/lib/prisma'
import { criarFixtures, limparBanco, post, type Fixtures } from './fixtures'
import { cookieDeLogin } from './sessao'

/**
 * CRIAR SAÍDA pelo CRM.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O DEFEITO, MEDIDO EM 18/08/2026 AO LIGAR O CALENDÁRIO DO PAINEL
 * ════════════════════════════════════════════════════════════════════════════
 * O formulário de saída manda `meetingPoint: ponto.trim() || null`. Campo
 * vazio vira `null`, que é a forma certa: no banco a coluna é opcional.
 *
 * O schema do POST aceitava `z.string().optional()` — ausente OU string, nunca
 * `null`. Com `.strict()` no objeto, o resultado era 400 "Dados inválidos." em
 * todo cadastro que não preenchesse ponto de encontro E horário de encontro,
 * que são justamente os dois campos que o formulário marca como opcionais.
 *
 * Ou seja: o botão "+ Nova saída", o caminho principal do CRM, recusava a
 * operação normal e explicava com a mensagem genérica de validação. O PATCH da
 * mesma entidade já estava certo (`.nullable().optional()`), o que mostra que
 * foi esquecimento e não decisão.
 *
 * Nasceu falhando: sem `.nullable()` no schema, o primeiro caso devolve 400.
 */
describe('POST /api/admin/departures', () => {
  let f: Fixtures
  // Um login por caso, não um por chamada: `/api/auth/login` tem limite de
  // taxa por IP e o teste falharia por 429 em vez de pelo que ele mede.
  let cookieAdmin: string

  beforeEach(async () => {
    await limparBanco()
    f = await criarFixtures()
    cookieAdmin = await cookieDeLogin('ADMIN')
  })

  async function criar(corpo: unknown) {
    return criarRota(post('/api/admin/departures', corpo, { cookie: cookieAdmin }) as never)
  }

  function corpoDoFormulario(extra: Record<string, unknown> = {}) {
    // Exatamente o que `editor-de-saida.tsx` monta com os campos opcionais em
    // branco. Se este objeto e o do componente divergirem, o teste para de
    // medir o caminho real.
    return {
      tripId: f.trip.id,
      startAt: '2026-08-20T06:00',
      priceCents: 9000,
      meetingPoint: null,
      meetingTimeLocal: null,
      meetingLat: null,
      meetingLng: null,
      ...extra,
    }
  }

  it('aceita ponto de encontro e horário em branco', async () => {
    const res = await criar(corpoDoFormulario())
    expect(res.status).toBe(200)

    const { data } = (await res.json()) as { data: { id: number } }
    const salva = await prisma.departure.findUniqueOrThrow({ where: { id: data.id } })
    expect(salva.meetingPoint).toBeNull()
    expect(salva.meetingTimeLocal).toBeNull()
  })

  it('grava a parede local como o instante certo de São Paulo', async () => {
    // 6 da manhã em Mogi é 09:00Z. Mandar `toISOString()` do navegador
    // gravaria três horas adiantado, e o grupo perderia a trilha.
    const { data } = (await (await criar(corpoDoFormulario())).json()) as {
      data: { id: number }
    }
    const salva = await prisma.departure.findUniqueOrThrow({ where: { id: data.id } })
    expect(salva.startAt.toISOString()).toBe('2026-08-20T09:00:00.000Z')
  })

  it('nasce em rascunho', async () => {
    // Saída recém-criada ainda não tem vagas nem guia. Publicar por padrão a
    // colocaria na agenda do site no instante do "salvar".
    const { data } = (await (await criar(corpoDoFormulario())).json()) as {
      data: { id: number }
    }
    const salva = await prisma.departure.findUniqueOrThrow({ where: { id: data.id } })
    expect(salva.status).toBe('DRAFT')
  })

  it('aceita o formulário preenchido por inteiro', async () => {
    const res = await criar(
      corpoDoFormulario({
        meetingPoint: 'Praça de Quatinga',
        meetingTimeLocal: '05:30',
        meetingLat: -23.5,
        meetingLng: -46.2,
      }),
    )
    expect(res.status).toBe(200)

    const { data } = (await res.json()) as { data: { id: number } }
    const salva = await prisma.departure.findUniqueOrThrow({ where: { id: data.id } })
    expect(salva.meetingPoint).toBe('Praça de Quatinga')
    expect(salva.meetingTimeLocal).toBe('05:30')
  })

  it('recusa campo desconhecido, em vez de ignorar', async () => {
    // Entrada estrita: um campo com nome errado precisa doer no cadastro, não
    // sumir em silêncio e a pessoa descobrir na tela que o dado não gravou.
    const res = await criar(corpoDoFormulario({ preco: 9000 }))
    expect(res.status).toBe(400)
  })

  it('recusa data em formato de instante UTC', async () => {
    // A rota fala parede local. Aceitar `Z` aqui reabriria o defeito de fuso
    // pela porta dos fundos.
    const res = await criar(corpoDoFormulario({ startAt: '2026-08-20T09:00:00.000Z' }))
    expect(res.status).toBe(400)
  })
})
