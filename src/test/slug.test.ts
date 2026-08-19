import { describe, expect, it } from 'vitest'

import { gerarSlug, slugUnico } from '@/lib/slug'
import { costurarSeparador } from '@/lib/formato'

describe('gerarSlug', () => {
  it('minúsculo, ASCII, hífen entre palavras, sem acento', () => {
    expect(gerarSlug('São Sebastião do Paraíso')).toBe('sao-sebastiao-do-paraiso')
    expect(gerarSlug('Pedra Grande de Quatinga')).toBe('pedra-grande-de-quatinga')
  })

  it('nunca termina em hífen, mesmo quando o corte de 120 cai num separador', () => {
    // Nasceu falhando em 14/08/2026: o corte de comprimento rodava DEPOIS de
    // aparar as pontas, então um token de 119 chars seguido de separador
    // deixava um '-' no fim do slug canônico congelado.
    const token = 'a'.repeat(119)
    const slug = gerarSlug(`${token} resto`)
    expect(slug.length).toBeLessThanOrEqual(120)
    expect(slug.endsWith('-')).toBe(false)
    expect(slug.startsWith('-')).toBe(false)
  })

  it('vazio quando não sobra caractere aproveitável', () => {
    expect(gerarSlug('!!!')).toBe('')
    expect(gerarSlug('   ')).toBe('')
  })
})

describe('slugUnico', () => {
  it('sufixa -2, -3 contra colisão', () => {
    expect(slugUnico('Camiseta Caqui', [])).toBe('camiseta-caqui')
    expect(slugUnico('Camiseta Caqui', ['camiseta-caqui'])).toBe('camiseta-caqui-2')
    expect(slugUnico('Camiseta Caqui', ['camiseta-caqui', 'camiseta-caqui-2'])).toBe(
      'camiseta-caqui-3',
    )
  })

  it('cai em "item" quando o slug base fica vazio', () => {
    expect(slugUnico('!!!', [])).toBe('item')
  })
})

/**
 * O SEPARADOR NÃO ABRE LINHA.
 *
 * Nasceu de um defeito visto na tela em 18/08/2026: em escala de cartaz,
 * "Escalavrado · Teresópolis" quebrava com o `·` iniciando a segunda linha, o
 * que lê como marcador de lista. Ver o comentário de `costurarSeparador`.
 */
describe('costurarSeparador', () => {
  /**
   * O caractere é escrito como `\u00A0` de propósito.
   *
   * Um espaço inquebrável literal no arquivo é indistinguível de um espaço
   * comum na revisão de código: o teste passaria comparando duas strings
   * iguais e ninguém teria como ver. Escrito por codepoint, a asserção diz o
   * que verifica.
   */
  const NBSP = '\u00A0'

  it('prende o separador à palavra anterior, com espaço inquebrável', () => {
    expect(costurarSeparador('Escalavrado · Teresópolis')).toBe(`Escalavrado${NBSP}· Teresópolis`)
  })

  it('o espaço DEPOIS do separador continua comum, para a linha poder quebrar ali', () => {
    const saida = costurarSeparador('Escalavrado · Teresópolis')
    expect(saida.split(NBSP)).toHaveLength(2)
    expect(saida).toContain('· Teresópolis')
  })

  it('cobre os três separadores que o conteúdo usa', () => {
    expect(costurarSeparador('a | b')).toBe(`a${NBSP}| b`)
    expect(costurarSeparador('a / b')).toBe(`a${NBSP}/ b`)
  })

  it('trata mais de um separador na mesma linha', () => {
    expect(costurarSeparador('Mogi · SP · Brasil')).toBe(`Mogi${NBSP}· SP${NBSP}· Brasil`)
  })

  it('não mexe em texto sem separador', () => {
    const intacto = 'Nascer do Sol no Pico do Lopo'
    expect(costurarSeparador(intacto)).toBe(intacto)
  })

  it('ignora pontuação colada, que não é separador de frase', () => {
    // Sem os espaços dos dois lados não é o caso que o defeito descreve, e
    // mexer aqui estragaria uma data como "23/08" ou uma velocidade.
    expect(costurarSeparador('23/08/2026')).toBe('23/08/2026')
    expect(costurarSeparador('9,5 km/h')).toBe('9,5 km/h')
  })
})
