import { describe, expect, it } from 'vitest'

import { estadoDeVagas, lucroCentavos, taxaDeOcupacao } from '@/lib/vagas'

/**
 * A DISPONIBILIDADE VIROU CONTA.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O DEFEITO QUE ORIGINOU ISTO
 * ────────────────────────────────────────────────────────────────────────────
 * A coluna `availability` era digitada à mão e o próprio schema a descrevia
 * como "o campo mais mexido do sistema". A Caqui fecha vaga no WhatsApp; entre
 * fechar a última e lembrar de abrir o CRM para marcar "esgotado" existe uma
 * janela em que o site anuncia vaga vendida.
 *
 * Estes casos fixam a conta que substituiu o campo, e principalmente as duas
 * bordas onde ela pode errar em silêncio: o limite exato de "últimas vagas" e
 * o overbooking.
 */
const base = {
  capacity: 12,
  seatsTaken: 0,
  lastSpotsAt: 3,
  availabilityOverride: null,
} as const

describe('estadoDeVagas', () => {
  it('com folga, o selo é disponível', () => {
    const r = estadoDeVagas({ ...base, seatsTaken: 4 })
    expect(r.disponibilidade).toBe('AVAILABLE')
    expect(r.restantes).toBe(8)
    expect(r.porExcecao).toBe(false)
  })

  it('EXATAMENTE no limiar já é "últimas vagas"', () => {
    // O erro de um a menos mora aqui: com `<` em vez de `<=`, a saída com 3
    // vagas restantes e limiar 3 continuaria anunciada como se tivesse folga.
    const r = estadoDeVagas({ ...base, seatsTaken: 9 })
    expect(r.restantes).toBe(3)
    expect(r.disponibilidade).toBe('LAST_SPOTS')
  })

  it('uma acima do limiar ainda é disponível', () => {
    expect(estadoDeVagas({ ...base, seatsTaken: 8 }).disponibilidade).toBe('AVAILABLE')
  })

  it('zerou, esgotou', () => {
    const r = estadoDeVagas({ ...base, seatsTaken: 12 })
    expect(r.disponibilidade).toBe('SOLD_OUT')
    expect(r.restantes).toBe(0)
    expect(r.excedente).toBe(0)
  })

  it('OVERBOOKING não vira número negativo na tela', () => {
    // Dois guias vendendo ao mesmo tempo acontece. O sistema aceita o
    // lançamento, mostra zero vaga, e guarda o excedente separado: "faltam -2
    // vagas" não é frase que alguém entenda, e recusar o lançamento faria a
    // pessoa mentir o número para conseguir salvar.
    const r = estadoDeVagas({ ...base, seatsTaken: 14 })
    expect(r.disponibilidade).toBe('SOLD_OUT')
    expect(r.restantes).toBe(0)
    expect(r.excedente).toBe(2)
  })

  it('a exceção declarada vence a conta, e fica marcada como exceção', () => {
    // Chuva, interdição do parque, decisão do guia. Nenhuma dessas razões
    // aparece na contagem de vagas.
    const r = estadoDeVagas({ ...base, seatsTaken: 1, availabilityOverride: 'SOLD_OUT' })
    expect(r.disponibilidade).toBe('SOLD_OUT')
    expect(r.porExcecao).toBe(true)
    // E o saldo real continua visível para quem opera.
    expect(r.restantes).toBe(11)
  })

  it('sem capacidade declarada, nada quebra: volta a ser o campo manual', () => {
    // É o que permite a migração não mexer em nenhuma saída já cadastrada.
    const semLimite = { ...base, capacity: null }
    expect(estadoDeVagas(semLimite).disponibilidade).toBe('AVAILABLE')
    expect(estadoDeVagas(semLimite).restantes).toBeNull()
    expect(estadoDeVagas({ ...semLimite, availabilityOverride: 'LAST_SPOTS' })).toMatchObject({
      disponibilidade: 'LAST_SPOTS',
      restantes: null,
      porExcecao: true,
    })
  })

  it('capacidade 1 e uma vaga fechada esgota, sem passar por "últimas vagas"', () => {
    // Saída particular. Com limiar 3 e capacidade 1, a saída nasceria em
    // "últimas vagas" — o que é verdade — e precisa esgotar corretamente.
    expect(estadoDeVagas({ ...base, capacity: 1, seatsTaken: 0 }).disponibilidade).toBe(
      'LAST_SPOTS',
    )
    expect(estadoDeVagas({ ...base, capacity: 1, seatsTaken: 1 }).disponibilidade).toBe('SOLD_OUT')
  })
})

describe('lucroCentavos', () => {
  it('subtrai custo de receita', () => {
    expect(lucroCentavos({ revenueCents: 279000, costCents: 96000 })).toBe(183000)
  })

  it('lucro pode ser negativo, e isso precisa aparecer', () => {
    expect(lucroCentavos({ revenueCents: 50000, costCents: 96000 })).toBe(-46000)
  })

  it('DADO FALTANDO não vira zero', () => {
    // Tratar ausência como zero é o defeito clássico do relatório financeiro:
    // a saída sem custo lançado apareceria como a mais lucrativa do mês, e a
    // lista ordenada por lucro colocaria o dado que falta no topo.
    expect(lucroCentavos({ revenueCents: 279000, costCents: null })).toBeNull()
    expect(lucroCentavos({ revenueCents: null, costCents: 96000 })).toBeNull()
  })

  it('zero lançado é diferente de não lançado', () => {
    expect(lucroCentavos({ revenueCents: 279000, costCents: 0 })).toBe(279000)
  })
})

describe('taxaDeOcupacao', () => {
  it('usa quem FOI, não quem fechou', () => {
    expect(taxaDeOcupacao({ capacity: 12, attendeeCount: 9 })).toBe(0.75)
  })

  it('sem capacidade ou sem presença, não há taxa', () => {
    expect(taxaDeOcupacao({ capacity: null, attendeeCount: 9 })).toBeNull()
    expect(taxaDeOcupacao({ capacity: 12, attendeeCount: null })).toBeNull()
  })

  it('capacidade zero não divide por zero', () => {
    expect(taxaDeOcupacao({ capacity: 0, attendeeCount: 0 })).toBeNull()
  })
})
