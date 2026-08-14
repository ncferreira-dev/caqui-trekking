import { describe, expect, it } from 'vitest'

import { montarMensagem, itensQueVaoNaMensagem } from '@/lib/carrinho/mensagem'
import { formatarBRL } from '@/lib/money'
import { linkWhatsApp } from '@/lib/formato'
import type { ItemValidado, ResultadoValidacao } from '@/server/services/cart-service'

/**
 * A mensagem do WhatsApp.
 *
 * É o produto final do site: o único artefato que sai daqui e chega a um ser
 * humano. Um erro aqui não aparece em nenhum log — aparece na conversa, com a
 * Caqui desdizendo o próprio site na frente do cliente.
 */

const TEMPLATE = [
  'Olá! Vim pelo site 🌄',
  '',
  '*MEU PEDIDO*',
  '',
  '{{itens}}',
  '',
  '*Total: {{total}}*',
].join('\n')

function item(parcial: Partial<ItemValidado> & Pick<ItemValidado, 'tipo'>): ItemValidado {
  return {
    lineId: 'l1',
    ok: true,
    motivo: null,
    precoCentavos: 10_000,
    precoDecimal: '100.00',
    precoAnteriorCentavos: null,
    quantidade: 1,
    subtotalCentavos: 10_000,
    descricao: 'Item',
    detalhe: null,
    ...parcial,
  }
}

function resultado(itens: ItemValidado[]): ResultadoValidacao {
  const total = itens.reduce((s, i) => s + i.subtotalCentavos, 0)
  return {
    itens,
    totalCentavos: total,
    totalFormatado: 'ignorado',
    temDivergencia: itens.some((i) => i.motivo !== null),
    podeFinalizar: itens.every((i) => i.ok),
  }
}

describe('montarMensagem — o formato do briefing', () => {
  it('monta expedição e peça no formato de referência', () => {
    const texto = montarMensagem(
      TEMPLATE,
      resultado([
        item({
          tipo: 'DEPARTURE',
          descricao: 'Escalavrado — Teresópolis',
          detalhe: 'sábado, 29 de agosto, 05:00',
          quantidade: 2,
          precoCentavos: 42_500,
          subtotalCentavos: 85_000,
        }),
        item({
          tipo: 'WEAR',
          descricao: 'Camiseta Dry Fit Caqui',
          detalhe: 'Tam M · Preto',
          quantidade: 1,
          precoCentavos: 5_000,
          subtotalCentavos: 5_000,
        }),
      ]),
    )

    expect(texto).toBe(
      [
        'Olá! Vim pelo site 🌄',
        '',
        '*MEU PEDIDO*',
        '',
        '🥾 Escalavrado — Teresópolis',
        '📅 sábado, 29 de agosto, 05:00',
        '👤 2 vagas',
        formatarBRL(85_000),
        '',
        '👕 Camiseta Dry Fit Caqui',
        'Tam M · Preto · 1 un',
        formatarBRL(5_000),
        '',
        `*Total: ${formatarBRL(90_000)}*`,
      ].join('\n'),
    )
  })

  it('singulariza "vaga" com quantidade 1', () => {
    const texto = montarMensagem(
      TEMPLATE,
      resultado([item({ tipo: 'DEPARTURE', quantidade: 1, descricao: 'Pedra Grande' })]),
    )
    expect(texto).toContain('👤 1 vaga\n')
    expect(texto).not.toContain('1 vagas')
  })

  it('põe as experiências antes das peças, seja qual for a ordem do carrinho', () => {
    const texto = montarMensagem(
      TEMPLATE,
      resultado([
        item({ tipo: 'WEAR', lineId: 'v:1', descricao: 'Caneca' }),
        item({ tipo: 'DEPARTURE', lineId: 'd:1', descricao: 'Pico do Lopo' }),
      ]),
    )
    // Data tem prazo; caneca não. A Caqui precisa ler a saída primeiro.
    expect(texto.indexOf('Pico do Lopo')).toBeLessThan(texto.indexOf('Caneca'))
  })

  it('o total soma exatamente as linhas impressas', () => {
    const texto = montarMensagem(
      TEMPLATE,
      resultado([
        item({ tipo: 'DEPARTURE', subtotalCentavos: 27_900, descricao: 'A' }),
        item({ tipo: 'WEAR', subtotalCentavos: 6_000, descricao: 'B' }),
      ]),
    )
    expect(texto).toContain(`*Total: ${formatarBRL(33_900)}*`)
  })
})

describe('montarMensagem — o que NÃO pode entrar', () => {
  it('item esgotado, vencido ou fora de linha não vira linha de pedido', () => {
    const dados = resultado([
      item({ tipo: 'DEPARTURE', descricao: 'Vale', motivo: null, subtotalCentavos: 9_000 }),
      item({
        tipo: 'DEPARTURE',
        lineId: 'd:2',
        descricao: 'Esgotada',
        motivo: 'DEPARTURE_NOT_AVAILABLE',
        ok: false,
        precoCentavos: null,
        subtotalCentavos: 0,
      }),
      item({
        tipo: 'WEAR',
        lineId: 'v:2',
        descricao: 'Fora de linha',
        motivo: 'VARIANT_UNAVAILABLE',
        ok: false,
        precoCentavos: null,
        subtotalCentavos: 0,
      }),
    ])

    const texto = montarMensagem(TEMPLATE, dados)

    expect(texto).toContain('Vale')
    expect(texto).not.toContain('Esgotada')
    expect(texto).not.toContain('Fora de linha')
    expect(texto).toContain(`*Total: ${formatarBRL(9_000)}*`)
  })

  it('item com preço mudado fica de fora até a pessoa reconhecer', () => {
    // `PRICE_CHANGED` não invalida o item, mas bloqueia `podeFinalizar`. Se a
    // mensagem fosse montada assim mesmo, iria com o preço novo sem ninguém ter
    // visto o antigo.
    const dados = resultado([
      item({
        tipo: 'DEPARTURE',
        descricao: 'Reajustada',
        motivo: 'PRICE_CHANGED',
        ok: false,
        precoAnteriorCentavos: 8_000,
        subtotalCentavos: 9_000,
      }),
    ])

    expect(itensQueVaoNaMensagem(dados)).toHaveLength(0)
    expect(dados.podeFinalizar).toBe(false)
  })
})

describe('montarMensagem — o template vem do CRM', () => {
  it('respeita um template reescrito, sem emoji e sem asterisco', () => {
    const texto = montarMensagem(
      'Bom dia! Segue o pedido:\n\n{{itens}}\n\nTotal a pagar: {{total}}',
      resultado([item({ tipo: 'WEAR', descricao: 'Caneca', subtotalCentavos: 3_500 })]),
    )

    expect(texto.startsWith('Bom dia! Segue o pedido:')).toBe(true)
    expect(texto).toContain(`Total a pagar: ${formatarBRL(3_500)}`)
    expect(texto).not.toContain('*')
  })

  it('template sem {{itens}} não perde o pedido', () => {
    // Alguém apagou o marcador editando no CRM. A Caqui receberia saudação e
    // total, sem saber do quê. A lista é anexada ao fim.
    const texto = montarMensagem(
      'Olá!',
      resultado([item({ tipo: 'WEAR', descricao: 'Caneca', subtotalCentavos: 3_500 })]),
    )

    expect(texto).toContain('Olá!')
    expect(texto).toContain('👕 Caneca')
    expect(texto).toContain(formatarBRL(3_500))
  })

  it('cifrão no nome do produto sobrevive à interpolação', () => {
    // `String.replace` interpretaria `$&`, `$1` e `$\x27` como padrões de
    // substituição e comeria pedaços do texto. Daí o split/join.
    const texto = montarMensagem(
      TEMPLATE,
      resultado([item({ tipo: 'WEAR', descricao: "Caneca R$ 35 — promo $& e $1 e $'" })]),
    )

    expect(texto).toContain("Caneca R$ 35 — promo $& e $1 e $'")
  })
})

describe('a URL do wa.me sobrevive à mensagem inteira', () => {
  it('acento, emoji, asterisco e quebra de linha voltam idênticos', () => {
    const texto = montarMensagem(
      TEMPLATE,
      resultado([
        item({
          tipo: 'DEPARTURE',
          // Acento, cedilha, travessão e barra — o nome real de um roteiro.
          descricao: 'Fazenda Santa Rita — Cachoeira do Paredão, Mogi/SP',
          detalhe: 'sábado, 29 de agosto, 05:00',
          quantidade: 3,
          subtotalCentavos: 27_000,
        }),
      ]),
    )

    const url = linkWhatsApp('5511943017232', texto)
    const devolvido = decodeURIComponent(new URL(url).searchParams.get('text') ?? '')

    expect(devolvido).toBe(texto)
    expect(devolvido).toContain('Paredão')
    expect(devolvido).toContain('🥾')
    expect(devolvido).toContain('\n')
    expect(url.startsWith('https://wa.me/5511943017232?text=')).toBe(true)
    // O que quebrava no projeto de referência: percent-encoding escrito à mão
    // deixava o espaço como `+` e o acento cru.
    expect(url).not.toContain(' ')
  })

  it('o espaço de "R$ 35,00" é NÃO-QUEBRÁVEL, e precisa sobreviver', () => {
    // `Intl.NumberFormat('pt-BR')` separa o símbolo do número com U+00A0, não
    // com espaço comum — é o que impede o WhatsApp de quebrar a linha entre
    // "R$" e o valor. Ele vira `%C2%A0` na URL, e tem que voltar idêntico:
    // trocar por espaço comum aqui reintroduziria a quebra feia no meio do
    // preço, que é a linha mais importante da mensagem.
    const preco = formatarBRL(3_500)
    expect(preco).toBe('R$\u00a035,00')

    const url = linkWhatsApp('5511943017232', preco)
    expect(url).toContain('%C2%A0')
    expect(decodeURIComponent(new URL(url).searchParams.get('text') ?? '')).toBe(preco)
  })
})
