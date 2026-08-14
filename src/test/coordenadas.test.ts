import { describe, expect, it } from 'vitest'

import { ehLinkCurtoDeMaps, extrairCoordenadas } from '@/lib/maps/coordenadas'

/**
 * Nasceu em 14/08/2026, junto com o campo "Link do Google Maps" que substituiu
 * os dois campos de latitude/longitude no editor de saída. Cada caso é um
 * formato de link que o Google Maps produz de verdade — se um deles parar de
 * extrair, o botão "Como chegar" some do site sem ninguém perceber.
 */
describe('extrairCoordenadas', () => {
  const ALVO = { lat: -23.52145, lng: -46.1882 }

  it('lê o /@lat,lng do link da barra de endereço', () => {
    expect(extrairCoordenadas('https://www.google.com/maps/@-23.52145,-46.1882,15z')).toEqual(ALVO)
  })

  it('lê o marcador !3d!4d do link de um lugar', () => {
    const url =
      'https://www.google.com/maps/place/Pedra+Grande/@-23.5,-46.1,17z/data=!3m1!4b1!4m6!3d-23.52145!4d-46.1882'
    expect(extrairCoordenadas(url)).toEqual(ALVO)
  })

  it('lê o ?q=lat,lng dos links de busca', () => {
    expect(extrairCoordenadas('https://maps.google.com/?q=-23.52145,-46.1882')).toEqual(ALVO)
    expect(
      extrairCoordenadas('https://www.google.com/maps/search/?api=1&query=-23.52145,-46.1882'),
    ).toEqual(ALVO)
  })

  it('aceita a pessoa colar só "lat,lng"', () => {
    expect(extrairCoordenadas('-23.52145, -46.1882')).toEqual(ALVO)
    expect(extrairCoordenadas('  -23.52145,-46.1882  ')).toEqual(ALVO)
  })

  it('recusa link sem coordenada e texto solto', () => {
    expect(extrairCoordenadas('https://www.google.com/maps/place/Mogi+das+Cruzes')).toBeNull()
    expect(extrairCoordenadas('bom dia')).toBeNull()
    expect(extrairCoordenadas('')).toBeNull()
  })

  it('recusa coordenada fora da faixa (não grava pino no oceano)', () => {
    expect(extrairCoordenadas('-91.0,-46.1')).toBeNull()
    expect(extrairCoordenadas('-23.5,-200.0')).toBeNull()
  })
})

describe('ehLinkCurtoDeMaps', () => {
  it('reconhece os links curtos de compartilhar', () => {
    expect(ehLinkCurtoDeMaps('https://maps.app.goo.gl/AbCdEf123')).toBe(true)
    expect(ehLinkCurtoDeMaps('https://goo.gl/maps/xyz')).toBe(true)
  })

  it('não confunde o link completo com um curto', () => {
    expect(ehLinkCurtoDeMaps('https://www.google.com/maps/@-23.5,-46.1,15z')).toBe(false)
    expect(ehLinkCurtoDeMaps('nem link é')).toBe(false)
  })
})
