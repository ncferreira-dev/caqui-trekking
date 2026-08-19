import { describe, expect, it } from 'vitest'

import {
  agruparPorDia,
  chaveDia,
  diaPorExtenso,
  diasDaGradeDoMes,
  mensagemDeDiaLivre,
  mesDaChaveDia,
  DIAS_NA_GRADE,
} from '@/lib/calendario'

/**
 * A grade do calendário.
 *
 * Nasceu falhando em 18/08/2026: o módulo não existia. Estes testes são a
 * definição do que a grade precisa cumprir antes de qualquer pixel ser
 * desenhado, e nenhum deles toca no banco nem no relógio da máquina.
 *
 * O que está em jogo: a agenda é a página central do site, e o calendário é
 * como a pessoa pergunta "eu posso no dia 12, tem alguma coisa?". Um dia
 * caindo na coluna errada não quebra nada, não derruba build, e faz o grupo
 * perder a trilha.
 */
describe('diasDaGradeDoMes — a geometria da grade', () => {
  it('devolve sempre 42 dias, em todo mês de um ano inteiro', () => {
    // Grade de tamanho fixo é o que impede a página de "pular" de altura ao
    // trocar de mês. Fevereiro tem 28 dias e dezembro tem 31; a grade não.
    for (let mes = 1; mes <= 12; mes++) {
      const chave = `2026-${String(mes).padStart(2, '0')}`
      expect(diasDaGradeDoMes(chave)).toHaveLength(DIAS_NA_GRADE)
    }
  })

  it('começa sempre num domingo', () => {
    // A semana brasileira abre no domingo. Se a primeira célula não for
    // domingo, TODO dia da grade fica na coluna errada.
    for (const chave of ['2026-01', '2026-02', '2026-08', '2027-03', '2028-02']) {
      const primeiro = diasDaGradeDoMes(chave)[0]!
      const data = new Date(`${primeiro.chave}T12:00:00Z`)
      expect(data.getUTCDay()).toBe(0)
    }
  })

  it('as 42 chaves são consecutivas, sem buraco e sem repetição', () => {
    const dias = diasDaGradeDoMes('2026-08')
    for (let i = 1; i < dias.length; i++) {
      const anterior = new Date(`${dias[i - 1]!.chave}T12:00:00Z`).getTime()
      const atual = new Date(`${dias[i]!.chave}T12:00:00Z`).getTime()
      expect(atual - anterior).toBe(24 * 60 * 60 * 1000)
    }
  })

  it('contém todo dia do mês exatamente uma vez', () => {
    // Agosto de 2026 começa num sábado: sem os dias de julho na frente, o dia
    // 1º cairia na coluna do domingo.
    const doMes = diasDaGradeDoMes('2026-08').filter((d) => d.doMes)
    expect(doMes).toHaveLength(31)
    expect(doMes.map((d) => d.dia)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1))
    expect(doMes[0]!.chave).toBe('2026-08-01')
    expect(doMes[30]!.chave).toBe('2026-08-31')
  })

  it('agosto de 2026 abre no dia 26 de julho', () => {
    // O 1º é sábado, então sobram seis dias de julho antes dele.
    expect(diasDaGradeDoMes('2026-08')[0]!.chave).toBe('2026-07-26')
    expect(diasDaGradeDoMes('2026-08')[0]!.doMes).toBe(false)
  })

  it('fevereiro de 2026 começa no próprio dia 1º, que é domingo', () => {
    const dias = diasDaGradeDoMes('2026-02')
    expect(dias[0]!.chave).toBe('2026-02-01')
    expect(dias[0]!.doMes).toBe(true)
  })

  it('atravessa a virada do ano', () => {
    const dezembro = diasDaGradeDoMes('2026-12')
    expect(dezembro.at(-1)!.chave.startsWith('2027-01')).toBe(true)

    const janeiro = diasDaGradeDoMes('2026-01')
    expect(janeiro[0]!.chave.startsWith('2025-12')).toBe(true)
  })

  it('conta 29 dias em fevereiro bissexto', () => {
    expect(diasDaGradeDoMes('2028-02').filter((d) => d.doMes)).toHaveLength(29)
  })

  it('não depende do fuso da máquina', () => {
    // A grade é calendário civil: a mesma em Mogi, em Lisboa e em Auckland.
    // Se ela passasse por `new Date(ano, mes, dia)` local, o dia 1º viraria o
    // dia 31 do mês anterior a leste de Greenwich.
    const original = process.env.TZ
    try {
      process.env.TZ = 'Pacific/Kiritimati'
      const leste = diasDaGradeDoMes('2026-08').map((d) => d.chave)
      process.env.TZ = 'Pacific/Midway'
      const oeste = diasDaGradeDoMes('2026-08').map((d) => d.chave)
      expect(leste).toEqual(oeste)
      expect(leste[0]).toBe('2026-07-26')
    } finally {
      process.env.TZ = original
    }
  })
})

describe('chaveDia — instante UTC → o dia civil em São Paulo', () => {
  it('duas da manhã em UTC ainda é o dia anterior em Mogi', () => {
    // O defeito que isto impede: uma saída do dia 15 às 23h aparecendo no dia
    // 16 do calendário, porque o instante gravado é 16T02:00Z.
    expect(chaveDia(new Date('2026-08-16T02:00:00Z'))).toBe('2026-08-15')
  })

  it('as três da manhã em UTC já é o dia novo', () => {
    expect(chaveDia(new Date('2026-08-16T03:00:00Z'))).toBe('2026-08-16')
  })

  it('a virada do mês respeita o fuso', () => {
    expect(chaveDia(new Date('2026-09-01T02:59:59Z'))).toBe('2026-08-31')
  })

  it('a chave do dia sempre começa com a chave do mês', () => {
    const dia = chaveDia(new Date('2026-08-16T02:00:00Z'))
    expect(mesDaChaveDia(dia)).toBe('2026-08')
  })
})

describe('agruparPorDia', () => {
  it('agrupa preservando a ordem de chegada', () => {
    const itens = [
      { id: 1, quando: '2026-08-15T09:00:00Z' },
      { id: 2, quando: '2026-08-15T13:00:00Z' },
      { id: 3, quando: '2026-08-20T09:00:00Z' },
    ]
    const porDia = agruparPorDia(itens, (i) => chaveDia(new Date(i.quando)))

    expect([...porDia.keys()]).toEqual(['2026-08-15', '2026-08-20'])
    expect(porDia.get('2026-08-15')!.map((i) => i.id)).toEqual([1, 2])
    expect(porDia.get('2026-08-20')!.map((i) => i.id)).toEqual([3])
  })

  it('devolve mapa vazio para lista vazia, e não undefined', () => {
    expect(agruparPorDia([], () => '')).toEqual(new Map())
  })
})

describe('diaPorExtenso — o texto que vai para a mensagem do WhatsApp', () => {
  it('escreve o dia da semana, o dia, o mês e o ano', () => {
    // 15/08/2026 é um sábado.
    expect(diaPorExtenso('2026-08-15')).toBe('sábado, 15 de agosto de 2026')
  })

  it('não usa travessão', () => {
    // A voz da marca não usa travessão em texto que o cliente lê, e esta
    // string entra numa mensagem de WhatsApp.
    for (const chave of ['2026-01-01', '2026-08-15', '2026-12-31']) {
      expect(diaPorExtenso(chave)).not.toMatch(/[—–]/)
    }
  })
})

describe('mensagemDeDiaLivre — o WhatsApp do dia vazio', () => {
  it('carrega a data escolhida por extenso', () => {
    expect(mensagemDeDiaLivre('2026-08-15')).toContain('sábado, 15 de agosto de 2026')
  })

  it('é um formulário, não uma pergunta solta', () => {
    // Quem recebe precisa de dia, quantidade e região na PRIMEIRA mensagem.
    const texto = mensagemDeDiaLivre('2026-08-15')
    expect(texto).toContain('Quantas pessoas:')
    expect(texto).toContain('Trilha ou região:')
  })

  it('não usa travessão', () => {
    // A trava do ESLint só alcança `app/` e `components/`; esta string mora em
    // `lib/` e chega ao cliente igual. O teste é a trava dela.
    expect(mensagemDeDiaLivre('2026-08-15')).not.toMatch(/[—–]/)
  })
})
