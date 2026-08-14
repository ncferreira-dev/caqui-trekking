import { describe, expect, it } from 'vitest'

import { gerarSlug, slugUnico } from '@/lib/slug'

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
