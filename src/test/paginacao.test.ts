import { describe, expect, it } from 'vitest'

import { fatiar } from '@/lib/crm/paginacao'

/**
 * A CONTA DA PAGINAÇÃO.
 *
 * Todo defeito de paginação é aritmético e invisível: a página 3 pulando um
 * item, a última vindo vazia, `?pagina=0` virando `skip: -50`. Nada disso
 * quebra nada — só some um registro, e ninguém percebe.
 */
describe('fatiar', () => {
  it('a primeira página começa no zero', () => {
    const f = fatiar(undefined, 120, 50)
    expect(f).toMatchObject({ pagina: 1, offset: 0, primeiro: 1, ultimo: 50, temAnterior: false })
  })

  it('a segunda página não pula nem repete item', () => {
    // O erro clássico é `offset = pagina * tamanho`, que pula os 50 primeiros
    // da página 2. Aqui a página 2 começa exatamente onde a 1 parou.
    const um = fatiar('1', 120, 50)
    const dois = fatiar('2', 120, 50)
    expect(dois.primeiro).toBe(um.ultimo + 1)
    expect(dois.offset).toBe(50)
  })

  it('a última página não promete itens que não existem', () => {
    const f = fatiar('3', 120, 50)
    expect(f).toMatchObject({ primeiro: 101, ultimo: 120, temSeguinte: false })
  })

  it('total exato no múltiplo não cria uma página vazia a mais', () => {
    // Com 100 itens e 50 por página são DUAS páginas. `Math.ceil` sobre um
    // múltiplo exato é onde a terceira página fantasma costuma aparecer.
    expect(fatiar('1', 100, 50).paginas).toBe(2)
    expect(fatiar('2', 100, 50).temSeguinte).toBe(false)
  })

  it('lista vazia tem uma página, e ela não mente sobre a contagem', () => {
    const f = fatiar(undefined, 0, 50)
    expect(f).toMatchObject({ paginas: 1, primeiro: 0, ultimo: 0, temSeguinte: false })
  })

  it('página fora do intervalo cai na última que existe', () => {
    // Link velho, ou alguém arquivou meio catálogo depois de compartilhar a
    // página 9. A resposta certa é a última página, não uma tela vazia.
    expect(fatiar('9', 120, 50).pagina).toBe(3)
  })

  it('entrada lixo não vira skip negativo', () => {
    for (const lixo of ['0', '-3', 'abc', '', 'NaN', '1e999']) {
      const f = fatiar(lixo, 120, 50)
      expect(f.pagina).toBeGreaterThanOrEqual(1)
      expect(f.offset).toBeGreaterThanOrEqual(0)
      expect(f.pagina).toBeLessThanOrEqual(f.paginas)
    }
  })

  it('query repetida (?pagina=2&pagina=9) vale a primeira', () => {
    expect(fatiar(['2', '9'], 500, 50).pagina).toBe(2)
  })

  it('decimal é truncado, não arredondado para cima', () => {
    expect(fatiar('2.9', 500, 50).pagina).toBe(2)
  })
})
