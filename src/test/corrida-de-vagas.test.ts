import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { PATCH as lancarRota } from '@/app/api/admin/departures/[id]/vagas/route'
import { prisma } from '@/lib/prisma'
import { criarFixtures, limparBanco, type Fixtures } from './fixtures'
import { cookieDeLogin } from './sessao'

/**
 * A CORRIDA DO LIVRO DE VAGAS.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O DEFEITO, ACHADO NA AUDITORIA DE 20/08/2026 (docs/20, A1)
 * ════════════════════════════════════════════════════════════════════════════
 * `vagasFechadas` é um TOTAL, e continua sendo: é o número que a pessoa tem na
 * cabeça depois de desligar o telefone. Só que total é, por definição, escrita
 * cega — quem manda "são cinco" não sabe se alguém mandou "são seis" um
 * segundo antes.
 *
 * `lancarVagas` lia a saída FORA da transação e gravava o valor absoluto
 * dentro. Dois guias lançando ao mesmo tempo, ou a mesma pessoa com duas abas,
 * e o segundo PATCH sobrescrevia o primeiro. Uma venda sumia do livro, sem
 * erro, sem log, sem ninguém perceber — e o selo do site passava a anunciar
 * vaga que não existia.
 *
 * A ironia é que o `schema.prisma` cita EXATAMENTE esse cenário ("dois guias
 * vendendo ao mesmo tempo") para justificar aceitar overbooking. A decisão de
 * produto estava certa; a implementação é que tinha a janela.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE A CONDIÇÃO PRECISA ESTAR NO PRÓPRIO UPDATE
 * ════════════════════════════════════════════════════════════════════════════
 * Mover a leitura para dentro da transação corrige o HISTÓRICO, e só. No
 * isolamento padrão do Postgres as duas transações leem o mesmo 6 e as duas
 * gravam 7 do mesmo jeito.
 *
 * Por isso o `updateMany` filtra por `seatsTaken` esperado: a segunda encontra
 * 7 onde esperava 6, casa zero linhas, e vira 409.
 */

function patch(
  cookie: string,
  id: number,
  corpo: unknown,
): [Request, { params: Promise<{ id: string }> }] {
  return [
    new Request(`http://localhost:3000/api/admin/departures/${id}/vagas`, {
      method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
    }),
    { params: Promise.resolve({ id: String(id) }) },
  ]
}

let f: Fixtures
let cookie: string
let saidaId: number

beforeEach(async () => {
  await limparBanco()
  f = await criarFixtures()
  cookie = await cookieDeLogin('ADMIN')

  const saida = await prisma.departure.create({
    data: {
      tripId: f.trip.id,
      startAt: new Date('2026-12-20T09:00:00.000Z'),
      priceCents: 9000,
      capacity: 12,
      seatsTaken: 6,
      status: 'PUBLISHED',
    },
    select: { id: true },
  })
  saidaId = saida.id
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('lançar vagas declarando o valor que estava na tela', () => {
  it('grava quando a linha ainda está no valor esperado', async () => {
    const res = await lancarRota(
      ...patch(cookie, saidaId, { vagasFechadas: 7, vagasFechadasAnteriores: 6 }),
    )

    expect(res.status).toBe(200)
    const linha = await prisma.departure.findUniqueOrThrow({ where: { id: saidaId } })
    expect(linha.seatsTaken).toBe(7)
  })

  it('recusa com 409 quando alguém mudou no meio, e NÃO sobrescreve', async () => {
    // O outro guia já lançou: são 8 agora.
    await prisma.departure.update({ where: { id: saidaId }, data: { seatsTaken: 8 } })

    // Esta aba ainda mostrava 6 e tenta gravar 7.
    const res = await lancarRota(
      ...patch(cookie, saidaId, { vagasFechadas: 7, vagasFechadasAnteriores: 6 }),
    )

    expect(res.status).toBe(409)

    // O ponto todo: o lançamento do outro continua de pé.
    const linha = await prisma.departure.findUniqueOrThrow({ where: { id: saidaId } })
    expect(linha.seatsTaken).toBe(8)
  })

  it('a mensagem do 409 diz quanto é agora, para a pessoa decidir', async () => {
    await prisma.departure.update({ where: { id: saidaId }, data: { seatsTaken: 8 } })

    const res = await lancarRota(
      ...patch(cookie, saidaId, { vagasFechadas: 7, vagasFechadasAnteriores: 6 }),
    )
    const corpo = (await res.json()) as { error: { code: string; message: string } }

    expect(corpo.error.code).toBe('CONFLICT')
    // "Erro ao gravar" mandaria a pessoa adivinhar. O número resolve.
    expect(corpo.error.message).toContain('8')
  })

  it('sem declarar o valor anterior, continua gravando como antes', async () => {
    // Compatibilidade: script e seed lançam número absoluto e não têm valor
    // anterior para declarar. Exigir um faria inventarem.
    const res = await lancarRota(...patch(cookie, saidaId, { vagasFechadas: 9 }))

    expect(res.status).toBe(200)
    const linha = await prisma.departure.findUniqueOrThrow({ where: { id: saidaId } })
    expect(linha.seatsTaken).toBe(9)
  })
})

describe('o histórico do selo conta a verdade', () => {
  it('grava o selo de ANTES lido dentro da transação', async () => {
    // 6 de 12, limiar 3: sobram 6, então o selo é "abertas". Indo para 11,
    // sobra 1 e vira "últimas vagas".
    await lancarRota(...patch(cookie, saidaId, { vagasFechadas: 11, vagasFechadasAnteriores: 6 }))

    const historico = await prisma.departureAvailabilityChange.findMany({
      where: { departureId: saidaId },
      orderBy: { createdAt: 'desc' },
    })

    expect(historico).toHaveLength(1)
    // O `from` sai da leitura feita DENTRO da transação. Lido fora, ele podia
    // registrar um estado que nunca existiu — e é justamente este registro que
    // responde "por que essa saída ficou esgotada no dia 3?".
    expect(historico[0]?.from).toBe('AVAILABLE')
    expect(historico[0]?.to).toBe('LAST_SPOTS')
  })
})

describe('overbooking continua aceito', () => {
  it('lançar mais que a capacidade grava, e não vira erro', async () => {
    // Decisão de produto do schema: recusar faria a pessoa mentir o número
    // para conseguir salvar, e aí o relatório de lucro nasce errado. O
    // excedente é alerta no painel, não barreira.
    const res = await lancarRota(
      ...patch(cookie, saidaId, { vagasFechadas: 15, vagasFechadasAnteriores: 6 }),
    )

    expect(res.status).toBe(200)
    const linha = await prisma.departure.findUniqueOrThrow({ where: { id: saidaId } })
    expect(linha.seatsTaken).toBe(15)
    expect(linha.capacity).toBe(12)
  })
})
