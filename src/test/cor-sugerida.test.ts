import { describe, expect, it } from 'vitest'

import { corSugerida, NOMES_DE_COR } from '@/lib/cores'

/**
 * A sugestão de tom a partir do nome da cor.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE ARQUIVO EXISTE
 * ────────────────────────────────────────────────────────────────────────────
 * `corSugerida` é função pura, sem React e sem banco, e o próprio `cores.ts`
 * termina exportando `NOMES_DE_COR` com o comentário "só para o teste" — que
 * até aqui não existia. Toda função pura deste projeto tem teste; esta nasceu
 * sem, e ficou fora do `npm run check` por uma branch inteira.
 *
 * O que ela protege não é cosmético. A amostra de cor da variante é o que a
 * pessoa vê na loja antes de escolher tamanho: sugerir o tom errado é pior que
 * não sugerir nada, porque ninguém corrige um palpite que parece certo.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O DEFEITO QUE A ORDENAÇÃO EVITA
 * ────────────────────────────────────────────────────────────────────────────
 * "azul" é pedaço de "azul marinho". Uma busca ingênua, do mais curto para o
 * mais longo, casaria "Azul Marinho" com "azul" e devolveria um azul aberto
 * onde a camiseta é quase preta. O teste de `NOMES_POR_TAMANHO` abaixo é a
 * prova de que a ordem continua lá — ela é fácil de perder num refactor, e o
 * erro é silencioso.
 */

// Os tons de referência, repetidos aqui de propósito. Se alguém trocar o hex
// na tabela sem querer, o teste acusa; importar a tabela faria o teste
// concordar com qualquer valor.
const PRETO = '#1A1A1A'
const AZUL = '#1F5FA8'
const MARINHO = '#1B2A4A'
const MUSGO = '#4A5D33'
const VERDE = '#2E7D4F'

describe('corSugerida — casamento exato', () => {
  it('devolve o tom do nome escrito igual à tabela', () => {
    expect(corSugerida('preto')).toBe(PRETO)
    expect(corSugerida('azul')).toBe(AZUL)
  })

  it('devolve null para nome que não está na tabela', () => {
    // Sem palpite é um resultado legítimo: a pessoa escolhe o tom na roda de
    // cor. O que não pode é devolver um tom qualquer para não ficar vazio.
    expect(corSugerida('holográfico')).toBeNull()
    expect(corSugerida('xyz')).toBeNull()
  })

  it('devolve null para texto vazio ou só espaço', () => {
    // O campo começa vazio e a sugestão roda a cada tecla. Sem isto, o primeiro
    // caractere digitado já dispararia busca sobre string vazia.
    expect(corSugerida('')).toBeNull()
    expect(corSugerida('   ')).toBeNull()
  })
})

describe('corSugerida — normalização da digitação', () => {
  it('ignora a caixa', () => {
    expect(corSugerida('PRETO')).toBe(PRETO)
    expect(corSugerida('Preto')).toBe(PRETO)
  })

  it('ignora acento', () => {
    // Quem cadastra escreve "fúcsia" com acento; a tabela guarda "fucsia".
    // No Dália, um acento diferente separava a variante do grupo em silêncio.
    expect(corSugerida('fúcsia')).toBe(corSugerida('fucsia'))
    expect(corSugerida('azul petróleo')).toBe(corSugerida('azul petroleo'))
    expect(corSugerida('verde limão')).toBe(corSugerida('verde limao'))
  })

  it('trata hífen e sublinhado como espaço', () => {
    expect(corSugerida('azul-marinho')).toBe(MARINHO)
    expect(corSugerida('azul_marinho')).toBe(MARINHO)
  })

  it('ignora espaço sobrando nas pontas e no meio', () => {
    expect(corSugerida('  Azul-Marinho  ')).toBe(MARINHO)
    expect(corSugerida('azul    marinho')).toBe(MARINHO)
  })
})

describe('corSugerida — o nome mais longo ganha', () => {
  it('"azul marinho" NÃO cai no azul, que é pedaço dele', () => {
    // O defeito que a ordenação por tamanho existe para impedir. Se este teste
    // quebrar devolvendo AZUL, a camiseta marinho passa a mostrar um azul de
    // céu na amostra.
    expect(corSugerida('azul marinho')).toBe(MARINHO)
    expect(corSugerida('azul marinho')).not.toBe(AZUL)
  })

  it('"verde musgo" NÃO cai no verde', () => {
    expect(corSugerida('verde musgo')).toBe(MUSGO)
    expect(corSugerida('verde musgo')).not.toBe(VERDE)
  })

  it('acha o nome dentro de um texto maior', () => {
    // "Azul Marinho Escuro" não está na tabela, e devolver null aqui seria
    // desperdiçar um palpite óbvio.
    expect(corSugerida('Azul Marinho Escuro')).toBe(MARINHO)
    expect(corSugerida('Verde Musgo Claro')).toBe(MUSGO)
  })

  it('dentro de texto maior, ainda prefere o nome mais longo', () => {
    expect(corSugerida('camiseta azul marinho lisa')).toBe(MARINHO)
  })
})

describe('corSugerida — fronteira de palavra', () => {
  it('não casa nome de cor grudado dentro de outra palavra', () => {
    // "verdejante" contém "verde" e "azulado" contém "azul". Sem a fronteira
    // dos dois lados, os dois sugeririam cor, e a sugestão errada é pior que
    // sugestão nenhuma.
    expect(corSugerida('verdejante')).toBeNull()
    expect(corSugerida('azulado')).toBeNull()
    expect(corSugerida('rosado')).toBeNull()
  })
})

describe('a tabela em si', () => {
  it('não está vazia', () => {
    expect(NOMES_DE_COR.length).toBeGreaterThan(0)
  })

  it('todo nome devolve um hex de 7 caracteres, em maiúscula', () => {
    // Pega o erro de digitação no cadastro da tabela: hex de 6 sem `#`, de 4,
    // ou com letra fora de A-F. Um valor inválido não pinta nada na UI e a
    // amostra fica invisível, sem erro nenhum no console.
    for (const nome of NOMES_DE_COR) {
      expect(corSugerida(nome), `cor "${nome}"`).toMatch(/^#[0-9A-F]{6}$/)
    }
  })

  it('todo nome está normalizado — sem acento, sem caixa alta, sem hífen', () => {
    // Uma chave escrita "Azul Marinho" ou "azul-marinho" na tabela nunca casaria
    // no `TABELA[limpo]`, porque a busca normaliza a entrada e não a chave. O
    // nome ficaria morto na tabela sem ninguém perceber.
    for (const nome of NOMES_DE_COR) {
      expect(nome, `cor "${nome}"`).toBe(
        nome
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .replace(/[-_]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      )
    }
  })
})
