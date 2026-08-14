import { describe, expect, it } from 'vitest'

import { chaveMes, instanteLocal, intervaloDoMes, mesPorExtenso, partesDaData } from '@/lib/datetime'

/**
 * O fuso da agenda.
 *
 * Estes testes não tocam no banco. Existem porque é aqui que mora o erro mais
 * caro possível neste projeto: a data É o produto, e errar o dia da saída faz
 * o grupo perder a trilha.
 *
 * Todos rodam com o relógio da máquina em qualquer fuso — nenhuma asserção
 * depende de `TZ`, que é justamente o defeito que o arquivo existe para
 * impedir.
 */
describe('instanteLocal — hora de parede de São Paulo → instante UTC', () => {
  it('meia-noite em São Paulo é 03:00Z', () => {
    // O erro clássico: `new Date('2026-08-01')` devolve 00:00Z, que é 21:00 do
    // dia 31 de julho em Mogi. Uma saída do dia 31 às 22h cairia dentro de
    // agosto.
    expect(instanteLocal('2026-08-01T00:00:00').toISOString()).toBe('2026-08-01T03:00:00.000Z')
  })

  it('vale para qualquer mês do ano — o Brasil não tem horário de verão', () => {
    expect(instanteLocal('2026-01-01T00:00:00').toISOString()).toBe('2026-01-01T03:00:00.000Z')
    expect(instanteLocal('2026-12-01T00:00:00').toISOString()).toBe('2026-12-01T03:00:00.000Z')
  })
})

describe('intervaloDoMes', () => {
  it('vai da primeira à última fração do mês, em São Paulo', () => {
    const { de, ate } = intervaloDoMes('2026-08')

    expect(de.toISOString()).toBe('2026-08-01T03:00:00.000Z')
    // 1ms antes de setembro começar.
    expect(ate.toISOString()).toBe('2026-09-01T02:59:59.999Z')
  })

  it('a virada de ano não vira mês 13', () => {
    const { de, ate } = intervaloDoMes('2026-12')

    expect(de.toISOString()).toBe('2026-12-01T03:00:00.000Z')
    expect(ate.toISOString()).toBe('2027-01-01T02:59:59.999Z')
  })

  it('o fim de um mês encosta no começo do seguinte, sem buraco e sem sobra', () => {
    const agosto = intervaloDoMes('2026-08')
    const setembro = intervaloDoMes('2026-09')

    expect(setembro.de.getTime() - agosto.ate.getTime()).toBe(1)
  })

  it('os limites pertencem ao mês que a chave nomeia', () => {
    const { de, ate } = intervaloDoMes('2026-08')

    expect(chaveMes(de)).toBe('2026-08')
    expect(chaveMes(ate)).toBe('2026-08')
  })
})

describe('chaveMes', () => {
  it('23:30 do dia 31 em São Paulo ainda é o mês que acaba', () => {
    // 2026-09-01T02:30:00Z = 23:30 do dia 31 de agosto em Mogi. Agrupar por
    // UTC jogaria essa saída para setembro.
    expect(chaveMes(new Date('2026-09-01T02:30:00Z'))).toBe('2026-08')
  })

  it('00:30 do dia 1º já é o mês que começa', () => {
    expect(chaveMes(new Date('2026-09-01T03:30:00Z'))).toBe('2026-09')
  })
})

describe('mesPorExtenso', () => {
  it('formata em português', () => {
    expect(mesPorExtenso('2026-08')).toBe('agosto de 2026')
    expect(mesPorExtenso('2026-01')).toBe('janeiro de 2026')
  })
})

describe('partesDaData — o carimbo do card', () => {
  it('devolve dia, mês e semana separados, sem ponto e capitalizados', () => {
    // 2026-08-15T09:00Z = sábado, 15 de agosto, 06:00 em Mogi.
    expect(partesDaData(new Date('2026-08-15T09:00:00Z'))).toEqual({
      dia: '15',
      mes: 'ago',
      semana: 'Sáb',
    })
  })

  it('respeita o fuso na virada do dia', () => {
    // 03:00Z do dia 16 = 00:00 do dia 16 em Mogi.
    expect(partesDaData(new Date('2026-08-16T02:59:00Z')).dia).toBe('15')
    expect(partesDaData(new Date('2026-08-16T03:00:00Z')).dia).toBe('16')
  })
})
