import { describe, expect, it } from 'vitest'

import { montarGavetas, type FotoDaPeca } from '@/components/crm/fotos-da-peca'

/**
 * A DISTRIBUIÇÃO DAS FOTOS ENTRE AS CORES.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE ISTO É TESTADO E O RESTO DA TELA NÃO
 * ════════════════════════════════════════════════════════════════════════════
 * `montarGavetas` é a única parte da tela de fotos que pode errar EM SILÊNCIO.
 * Um botão que não clica, alguém percebe no mesmo segundo. Uma foto que cai na
 * gaveta errada parece certa: a tela mostra três quadros, todos com imagem, e
 * a loja é que vai entregar a camiseta azul para quem clicou em vermelho.
 *
 * É exatamente o defeito que `cor-da-foto.ts` existe para impedir do lado da
 * loja. Este arquivo fecha o mesmo buraco do lado de quem cadastra.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O CASO QUE MOTIVOU O TESTE: A COR RENOMEADA
 * ════════════════════════════════════════════════════════════════════════════
 * Alguém cadastra "Azul", sobe a foto, e depois corrige a variante para "Azul
 * Marinho". A foto continua apontando para um nome que não existe mais em
 * variante nenhuma. Se ela sumisse da tela, a Caqui subiria uma segunda foto e
 * ficaria pagando as duas, sem nunca entender por quê. Por isso a gaveta órfã.
 */

function foto(id: number, cor: string | null): FotoDaPeca {
  return { id, url: `https://exemplo/${id}.jpg`, alt: `foto ${id}`, cor }
}

/** As gavetas de cor cadastrada, na ordem, sem a neutra e sem as órfãs. */
function porCor(fotos: FotoDaPeca[], cores: string[]) {
  return montarGavetas(fotos, cores).filter((g) => g.cor !== null && !g.chave.startsWith('orfa:'))
}

function neutra(fotos: FotoDaPeca[], cores: string[]) {
  return montarGavetas(fotos, cores).find((g) => g.cor === null)
}

function orfas(fotos: FotoDaPeca[], cores: string[]) {
  return montarGavetas(fotos, cores).filter((g) => g.chave.startsWith('orfa:'))
}

describe('uma gaveta por cor cadastrada', () => {
  it('cria a gaveta mesmo sem foto nenhuma', () => {
    // O ponto inteiro da inversão: cor sem foto PRECISA aparecer. Na versão
    // anterior, foto primeiro, ela simplesmente não existia na tela.
    const g = porCor([], ['Azul', 'Preto'])

    expect(g.map((x) => x.rotulo)).toEqual(['Azul', 'Preto'])
    expect(g.every((x) => x.fotos.length === 0)).toBe(true)
  })

  it('preserva a ordem das cores como vieram das variantes', () => {
    const g = porCor([], ['Verde Musgo', 'Azul Marinho', 'Preto'])
    expect(g.map((x) => x.rotulo)).toEqual(['Verde Musgo', 'Azul Marinho', 'Preto'])
  })

  it('põe cada foto na gaveta da sua cor', () => {
    const fotos = [foto(1, 'Azul'), foto(2, 'Preto'), foto(3, 'Azul')]
    const g = porCor(fotos, ['Azul', 'Preto'])

    expect(g[0]?.fotos.map((f) => f.id)).toEqual([1, 3])
    expect(g[1]?.fotos.map((f) => f.id)).toEqual([2])
  })

  it('a mesma foto nunca aparece em duas gavetas', () => {
    // Duplicar mostraria "2 fotos" onde há uma, e remover pela segunda cópia
    // apagaria a foto que a outra gaveta ainda exibe.
    const fotos = [foto(1, 'Azul'), foto(2, null), foto(3, 'Preto')]
    const todas = montarGavetas(fotos, ['Azul', 'Preto']).flatMap((g) => g.fotos.map((f) => f.id))

    expect(todas).toEqual([...new Set(todas)])
    expect(todas).toHaveLength(3)
  })
})

describe('o nome da cor casa por normalização, não por igualdade crua', () => {
  it('ignora caixa e espaço nas pontas', () => {
    // Erro de digitação de quem cadastra, não escolha. " azul " e "Azul" são a
    // mesma cor e precisam cair na mesma gaveta.
    const g = porCor([foto(1, ' AZUL '), foto(2, 'azul')], ['Azul'])
    expect(g[0]?.fotos.map((f) => f.id)).toEqual([1, 2])
  })

  it('NÃO funde nomes que só diferem por acento', () => {
    // "Rosê" e "Rose" são duas cores que a Caqui cadastrou de propósito. Fundir
    // seria decidir por ela. Mesma regra de `normalizarCor`.
    const g = porCor([foto(1, 'Rosê')], ['Rose', 'Rosê'])

    expect(g[0]?.fotos).toHaveLength(0)
    expect(g[1]?.fotos.map((f) => f.id)).toEqual([1])
  })

  it('"Azul" e "Azul Marinho" continuam separadas', () => {
    // Uma é pedaço da outra. Casamento por prefixo mandaria a foto do marinho
    // para o azul de céu.
    const g = porCor([foto(1, 'Azul Marinho'), foto(2, 'Azul')], ['Azul', 'Azul Marinho'])

    expect(g[0]?.fotos.map((f) => f.id)).toEqual([2])
    expect(g[1]?.fotos.map((f) => f.id)).toEqual([1])
  })
})

describe('a gaveta neutra', () => {
  it('existe sempre, mesmo com todas as cores fotografadas', () => {
    // "Na dúvida, neutra, nunca a cor errada" só funciona se houver para onde
    // mandar a foto que serve para todas.
    const g = neutra([foto(1, 'Azul')], ['Azul'])
    expect(g).toBeDefined()
    expect(g?.fotos).toHaveLength(0)
  })

  it('recebe as fotos sem cor', () => {
    const g = neutra([foto(1, null), foto(2, 'Azul'), foto(3, null)], ['Azul'])
    expect(g?.fotos.map((f) => f.id)).toEqual([1, 3])
  })

  it('existe mesmo quando a peça não tem cor nenhuma cadastrada', () => {
    const gavetas = montarGavetas([foto(1, null)], [])
    expect(gavetas).toHaveLength(1)
    expect(gavetas[0]?.cor).toBeNull()
    expect(gavetas[0]?.fotos.map((f) => f.id)).toEqual([1])
  })
})

describe('foto de cor que não é mais variante', () => {
  it('ganha gaveta própria em vez de sumir', () => {
    // O caso da cor renomeada. Sumir faria a Caqui subir a foto de novo e
    // pagar as duas, sem entender por quê.
    const o = orfas([foto(1, 'Vermelho')], ['Azul'])

    expect(o).toHaveLength(1)
    expect(o[0]?.rotulo).toContain('Vermelho')
    expect(o[0]?.rotulo).toContain('não cadastrada')
    expect(o[0]?.fotos.map((f) => f.id)).toEqual([1])
  })

  it('agrupa as órfãs da mesma cor numa gaveta só', () => {
    const o = orfas([foto(1, 'Vermelho'), foto(2, 'vermelho'), foto(3, 'Bege')], ['Azul'])

    expect(o).toHaveLength(2)
    expect(o[0]?.fotos.map((f) => f.id)).toEqual([1, 2])
    expect(o[1]?.fotos.map((f) => f.id)).toEqual([3])
  })

  it('não confunde órfã com neutra', () => {
    // Uma é "não sei de que cor é"; a outra é "serve para todas". Misturar
    // esconderia a órfã dentro de um grupo que a loja mostra para qualquer cor.
    const fotos = [foto(1, 'Vermelho'), foto(2, null)]

    expect(neutra(fotos, ['Azul'])?.fotos.map((f) => f.id)).toEqual([2])
    expect(orfas(fotos, ['Azul'])[0]?.fotos.map((f) => f.id)).toEqual([1])
  })
})
