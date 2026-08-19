import { describe, expect, it } from 'vitest'

import { capaEAlternativa, coresSemFoto, fotosDaCor, normalizarCor } from '@/lib/media/cor-da-foto'

/**
 * A COR DA FOTO.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O PEDIDO E A REGRA QUE ELE IMPÕE
 * ════════════════════════════════════════════════════════════════════════════
 * O cliente, em 18/08/2026: numa baby look com três cores, escolher a cor
 * precisa trocar a FOTO junto com o preço.
 *
 * A regra que decide todo o resto: **na dúvida, foto neutra, nunca a cor
 * errada.** Foto genérica é uma informação faltando; foto da cor errada é uma
 * informação falsa, e ela vira reclamação de cliente em vez de alerta de
 * sistema.
 *
 * Nasceu falhando: o módulo não existia.
 */

const foto = (nome: string, cor: string | null) => ({ nome, cor })

describe('fotosDaCor', () => {
  it('sem cor escolhida, devolve tudo na ordem que veio', () => {
    // É o estado de quem acabou de abrir a página, e o de um produto sem
    // variante nenhuma. Filtrar aqui esconderia a peça inteira.
    const todas = [foto('a', 'Azul'), foto('b', null), foto('c', 'Rosa')]
    expect(fotosDaCor(todas, null).map((f) => f.nome)).toEqual(['a', 'b', 'c'])
  })

  it('as fotos da cor vêm primeiro, as neutras depois', () => {
    const todas = [foto('neutra', null), foto('azul-1', 'Azul'), foto('azul-2', 'Azul')]
    expect(fotosDaCor(todas, 'Azul').map((f) => f.nome)).toEqual(['azul-1', 'azul-2', 'neutra'])
  })

  it('NUNCA mostra a foto de outra cor', () => {
    // O ponto inteiro do recurso. Se esta asserção cair, o site passa a dizer
    // ao cliente que a camiseta rosa é azul.
    const todas = [foto('rosa', 'Rosa'), foto('azul', 'Azul')]
    expect(fotosDaCor(todas, 'Azul').map((f) => f.nome)).toEqual(['azul'])
  })

  it('cor sem foto própria cai nas neutras', () => {
    const todas = [foto('neutra', null), foto('azul', 'Azul')]
    expect(fotosDaCor(todas, 'Verde').map((f) => f.nome)).toEqual(['neutra'])
  })

  it('cor sem foto e sem neutra devolve VAZIO, e não a foto errada', () => {
    // Galeria vazia mostra o grafismo de "sem foto", que é honesto. A
    // alternativa seria cair na primeira foto da lista, que é exatamente a
    // mentira que este arquivo existe para impedir. O CRM avisa quem cadastra
    // que a cor ficou sem foto — ver `coresSemFoto`.
    const todas = [foto('azul', 'Azul'), foto('rosa', 'Rosa')]
    expect(fotosDaCor(todas, 'Verde')).toEqual([])
  })

  it('a ordem de dentro de cada grupo é preservada', () => {
    // Cor diz QUAL grupo; `sortOrder` diz a sequência dentro dele. As duas
    // coisas são independentes, e a consulta já chega ordenada.
    const todas = [foto('n1', null), foto('a1', 'Azul'), foto('n2', null), foto('a2', 'Azul')]
    expect(fotosDaCor(todas, 'Azul').map((f) => f.nome)).toEqual(['a1', 'a2', 'n1', 'n2'])
  })

  it('lista vazia não explode', () => {
    expect(fotosDaCor([], 'Azul')).toEqual([])
  })
})

describe('normalizarCor', () => {
  it('“Azul”, “azul” e “ Azul ” são a mesma cor', () => {
    // O seletor do CRM lista as cores do produto, então em teoria não há
    // divergência. Na prática existe dado antigo, cópia de planilha e espaço
    // no fim — e a associação falharia em silêncio, que é o pior modo de
    // falhar deste recurso.
    expect(normalizarCor('Azul')).toBe(normalizarCor('azul'))
    expect(normalizarCor(' Azul ')).toBe(normalizarCor('Azul'))
  })

  it('acento conta: “Rosê” não é “Rose”', () => {
    // Normalizar acento junto juntaria cores que a Caqui cadastrou de
    // propósito como diferentes. Caixa e espaço são erro de digitação; acento
    // é escolha.
    expect(normalizarCor('Rosê')).not.toBe(normalizarCor('Rose'))
  })

  it('nulo continua nulo', () => {
    expect(normalizarCor(null)).toBeNull()
  })
})

describe('coresSemFoto', () => {
  it('lista as cores do produto que ninguém fotografou', () => {
    // O aviso do CRM. Ficar sem foto é estado legítimo (a foto ainda não
    // chegou), mas quem cadastra precisa saber que ficou assim — senão
    // descobre pela galeria vazia na loja.
    const fotos = [foto('a', 'Azul'), foto('b', null)]
    expect(coresSemFoto(fotos, ['Azul', 'Rosa', 'Verde'])).toEqual(['Rosa', 'Verde'])
  })

  it('foto neutra NÃO conta como foto da cor', () => {
    // Ela serve para todas, e é justamente por isso que não resolve nenhuma:
    // a peça continua sem foto própria daquela cor.
    expect(coresSemFoto([foto('b', null)], ['Azul'])).toEqual(['Azul'])
  })

  it('não acusa quando toda cor tem foto', () => {
    const fotos = [foto('a', 'Azul'), foto('b', 'Rosa')]
    expect(coresSemFoto(fotos, ['Azul', 'Rosa'])).toEqual([])
  })

  it('ignora diferença de caixa e espaço', () => {
    expect(coresSemFoto([foto('a', ' azul ')], ['Azul'])).toEqual([])
  })
})

describe('capaEAlternativa', () => {
  it('o hover mostra outro ângulo da MESMA cor', () => {
    const fotos = [foto('preta-frente', 'Preto'), foto('preta-costas', 'Preto')]
    const { capa, alternativa } = capaEAlternativa(fotos)
    expect(capa?.nome).toBe('preta-frente')
    expect(alternativa?.nome).toBe('preta-costas')
  })

  it('NUNCA usa a foto de outra cor no hover', () => {
    // O defeito real: a alternativa era `imagens[1]`, e numa peça com três
    // cores fotografadas a segunda imagem é a de outra cor. O card prometia
    // ângulo e entregava troca de cor.
    const fotos = [foto('preta', 'Preto'), foto('rosa', 'Rosa'), foto('azul', 'Azul')]
    expect(capaEAlternativa(fotos).alternativa).toBeNull()
  })

  it('capa neutra faz par com neutra, e pula as coloridas', () => {
    const fotos = [foto('n1', null), foto('rosa', 'Rosa'), foto('n2', null)]
    expect(capaEAlternativa(fotos).alternativa?.nome).toBe('n2')
  })

  it('uma foto só não tem hover', () => {
    expect(capaEAlternativa([foto('unica', null)]).alternativa).toBeNull()
  })

  it('sem foto nenhuma, os dois são nulos', () => {
    expect(capaEAlternativa([])).toEqual({ capa: null, alternativa: null })
  })
})
