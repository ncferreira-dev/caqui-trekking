import { beforeEach, describe, expect, it } from 'vitest'

import { prisma } from '@/lib/prisma'
import { buscarDeparturePorId, listarDepartures } from '@/server/services/departure-service'
import { buscarTripPorSlug } from '@/server/services/trip-service'
import { listarGuias } from '@/server/services/institucional-service'
import { criarFixtures, limparBanco, type Fixtures } from './fixtures'

/**
 * GUIA FORA DA EQUIPE NÃO APARECE EM LUGAR NENHUM DA API PÚBLICA.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O DEFEITO, ENCONTRADO EM 18/08/2026
 * ════════════════════════════════════════════════════════════════════════════
 * `/api/guides` sempre filtrou `active` e `deletedAt`. Os JOINS de saída e de
 * roteiro não filtravam nada.
 *
 * O efeito é traiçoeiro justamente porque metade funcionava: desativar um guia
 * o tirava da página institucional, e quem desativou via a tela mudar e
 * acreditava ter resolvido. Enquanto isso, o mesmo guia continuava sendo
 * servido com NOME COMPLETO, BIO, CADASTUR e CREDENCIAL PESM em
 * `GET /api/trips/:slug` e em `GET /api/departures/:id`, e portanto na página
 * pública de todo roteiro em que já guiou. Rota anônima, cacheada na CDN.
 *
 * Cadastur e PESM são registro profissional NOMINAL de uma pessoa que saiu da
 * equipe. Não é dado de catálogo; é dado pessoal de alguém que não trabalha
 * mais ali.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE O TESTE VARRE OS TRÊS CAMINHOS
 * ════════════════════════════════════════════════════════════════════════════
 * O defeito nasceu de UM caminho ter o filtro e os outros dois não. Testar só o
 * caminho consertado reproduziria exatamente a situação anterior, com um teste
 * verde por cima.
 */
describe('guia arquivado ou desativado some da API pública', () => {
  let f: Fixtures

  beforeEach(async () => {
    await limparBanco()
    f = await criarFixtures()
  })

  /** Procura o nome do guia em qualquer lugar da estrutura devolvida. */
  function contem(valor: unknown, agulha: string): boolean {
    return JSON.stringify(valor).includes(agulha)
  }

  it('DESATIVADO some dos três caminhos de uma vez', async () => {
    const nome = 'Guia Que Saiu Da Equipe'
    await prisma.guide.update({ where: { id: f.guia.id }, data: { name: nome } })

    // Antes: aparece em tudo.
    expect(contem(await listarGuias(), nome)).toBe(true)
    expect(contem(await buscarTripPorSlug(f.trip.slug), nome)).toBe(true)
    expect(contem(await buscarDeparturePorId(f.saidaDisponivel.id), nome)).toBe(true)

    await prisma.guide.update({ where: { id: f.guia.id }, data: { active: false } })

    expect(contem(await listarGuias(), nome), 'lista institucional').toBe(false)
    expect(contem(await buscarTripPorSlug(f.trip.slug), nome), 'detalhe do roteiro').toBe(false)
    expect(contem(await buscarDeparturePorId(f.saidaDisponivel.id), nome), 'detalhe da saída').toBe(
      false,
    )
    expect(
      contem(await listarDepartures({ incluirEncerradas: true, limit: 50, offset: 0 }), nome),
      'agenda',
    ).toBe(false)
  })

  it('ARQUIVADO (soft delete) some dos três caminhos de uma vez', async () => {
    const nome = 'Guia Arquivado Com Cadastur'
    await prisma.guide.update({
      where: { id: f.guia.id },
      data: { name: nome, cadasturNumber: '11.111111.11-1' },
    })

    await prisma.guide.update({ where: { id: f.guia.id }, data: { deletedAt: new Date() } })

    expect(contem(await listarGuias(), nome), 'lista institucional').toBe(false)
    expect(contem(await buscarTripPorSlug(f.trip.slug), nome), 'detalhe do roteiro').toBe(false)
    expect(contem(await buscarDeparturePorId(f.saidaDisponivel.id), nome), 'detalhe da saída').toBe(
      false,
    )

    // E o número de registro profissional junto, que é o que mais importa.
    expect(
      contem(await buscarTripPorSlug(f.trip.slug), '11.111111.11-1'),
      'o Cadastur não pode sobrar em lugar nenhum',
    ).toBe(false)
  })

  it('guia ATIVO continua aparecendo, para o filtro não ter apagado a equipe', async () => {
    // Uma varredura que esconde tudo passa nos dois casos acima por vacuidade.
    const nome = 'Guia Da Casa'
    await prisma.guide.update({ where: { id: f.guia.id }, data: { name: nome } })

    expect(contem(await buscarTripPorSlug(f.trip.slug), nome)).toBe(true)
    expect(contem(await buscarDeparturePorId(f.saidaDisponivel.id), nome)).toBe(true)
  })
})
