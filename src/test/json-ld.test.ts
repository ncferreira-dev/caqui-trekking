import { describe, expect, it } from 'vitest'

import {
  eventoDeSaida,
  produtoJsonLd,
  serializarJsonLd,
  type JsonLd,
} from '@/lib/seo/json-ld'
import type { ProdutoDetalheDTO, SaidaDTO } from '@/server/dto/public-dto'

/**
 * Os dados estruturados.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O TESTE DE ESCAPE NASCEU DA AMEAÇA, NÃO DE COBERTURA
 * ────────────────────────────────────────────────────────────────────────────
 * `serializarJsonLd` existe para um cenário concreto: a descrição de um roteiro
 * é escrita no CRM e sai dentro de uma tag `<script>`. Se ela contiver
 * `</script>`, o navegador fecha a tag e o resto vira HTML executável em toda
 * visita. O teste abaixo prova que a sequência de fechamento não sobrevive à
 * serialização — se alguém "simplificar" a função para um `JSON.stringify`
 * puro, ele quebra.
 */

const BASE = 'https://exemplo.test'

function saidaFake(over: Partial<SaidaDTO> = {}): SaidaDTO {
  return {
    id: 1,
    inicioUtc: '2026-08-15T09:00:00.000Z',
    inicioLocal: '2026-08-15T06:00:00-03:00',
    fimUtc: null,
    pontoEncontro: 'Praça de Quatinga',
    horarioEncontro: '06:00',
    coordenadas: { lat: -23.5, lng: -46.1 },
    precoCentavos: 9000,
    precoDecimal: '90.00',
    precoDeCentavos: null,
    disponibilidade: 'AVAILABLE',
    encerrada: false,
    ...over,
  }
}

describe('serializarJsonLd corta a fuga de <script>', () => {
  it('escapa < > & para que </script> não feche a tag', () => {
    const saida = serializarJsonLd({ nota: 'fim</script><img src=x onerror=alert(1)>' })

    // A sequência literal de fechamento não pode existir na saída.
    expect(saida).not.toContain('</script>')
    expect(saida).not.toContain('<img')
    // E o que sai continua sendo JSON válido, lido igual por qualquer parser.
    expect(JSON.parse(saida.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>')).nota).toContain(
      'onerror',
    )
  })

  it('escapa os separadores de linha U+2028 e U+2029', () => {
    const saida = serializarJsonLd({ nota: 'a b c' })
    expect(saida).not.toContain(' ')
    expect(saida).not.toContain(' ')
    expect(saida).toContain('\\u2028')
  })
})

describe('a disponibilidade da saída vira o schema.org certo', () => {
  const cases: [SaidaDTO['disponibilidade'], string][] = [
    ['AVAILABLE', 'https://schema.org/InStock'],
    ['LAST_SPOTS', 'https://schema.org/LimitedAvailability'],
    ['SOLD_OUT', 'https://schema.org/SoldOut'],
  ]

  for (const [disp, esperado] of cases) {
    it(`${disp} → ${esperado}`, () => {
      const ev = eventoDeSaida(
        BASE,
        { slug: 'pedra', titulo: 'Pedra', subtitulo: null, cidade: 'Mogi', estado: 'SP' },
        saidaFake({ disponibilidade: disp }),
      )
      const offers = ev['offers'] as JsonLd
      expect(offers['availability']).toBe(esperado)
      // LAST_SPOTS é o caso que se erra mandando InStock. Fixado aqui.
      expect(offers['price']).toBe('90.00')
    })
  }
})

describe('o produto escolhe Offer ou AggregateOffer pelo preço das variantes', () => {
  function produtoFake(precos: number[]): ProdutoDetalheDTO {
    return {
      slug: 'camiseta',
      nome: 'Camiseta',
      categoria: 'CAMISETA',
      precoCentavos: 5000,
      precoDecimal: '50.00',
      capa: null,
      capaAlternativa: null,
      cores: [{ nome: 'Preto', hex: '#000000' }],
      tamanhos: ['P', 'M'],
      descricao: null,
      imagens: [],
      variantes: precos.map((p, i) => ({
        id: i,
        tamanho: 'M',
        cor: 'Preto',
        corHex: '#000000',
        precoCentavos: p,
        disponivel: true,
      })),
    }
  }

  it('preços iguais → Offer com um preço só', () => {
    const p = produtoJsonLd(BASE, produtoFake([5000, 5000]))
    const offers = p['offers'] as JsonLd
    expect(offers['@type']).toBe('Offer')
    expect(offers['price']).toBe('50.00')
  })

  it('preços diferentes → AggregateOffer com piso e teto', () => {
    const p = produtoJsonLd(BASE, produtoFake([5000, 8990]))
    const offers = p['offers'] as JsonLd
    expect(offers['@type']).toBe('AggregateOffer')
    expect(offers['lowPrice']).toBe('50.00')
    expect(offers['highPrice']).toBe('89.90')
  })

  it('qualquer variante disponível deixa o produto InStock', () => {
    const base = produtoFake([5000, 5000])
    base.variantes[0]!.disponivel = false // uma esgotada, outra à venda
    const p = produtoJsonLd(BASE, base)
    const offers = p['offers'] as JsonLd
    expect(offers['availability']).toBe('https://schema.org/InStock')
  })
})
