import { describe, expect, it } from 'vitest'

import {
  decidirToque,
  JANELA_MS,
  TOQUES_ATE_FEEDBACK,
  TOQUES_NECESSARIOS,
  type Contagem,
} from '@/lib/ui/gesto-do-painel'

/**
 * O GESTO DOS CINCO TOQUES.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ESTE TESTE NASCEU DE UM DEFEITO QUE ESTAVA NO AR
 * ────────────────────────────────────────────────────────────────────────────
 * Em 18/08/2026, cinco toques na marca deixavam a pessoa na HOME em vez do
 * painel. A contagem funcionava, o pulso funcionava, e o destino estava errado.
 *
 * A causa: no 5º toque a contagem era zerada ANTES do evento de `click`, e o
 * `click` decidia se cancelava a navegação do `<Link>` LENDO essa contagem.
 * Zerada, ela dizia "primeiro toque", o link ia para a home, e a home chegava
 * depois do `push` do painel. Quem fala por último ganha.
 *
 * O caso `ELO CRÍTICO` abaixo é exatamente esse. Verificado quebrando: trocando
 * `engolirClique: toque > 1` por uma leitura da contagem já zerada, ele falha,
 * e é o único que falha.
 */
describe('gesto do painel', () => {
  const inicio = 1_700_000_000_000
  /** Uma sequência de N toques, com 200ms entre eles. */
  function sequencia(quantos: number) {
    let contagem: Contagem = { total: 0, ultimoToque: 0 }
    const decisoes = []
    for (let i = 0; i < quantos; i++) {
      const decisao = decidirToque(contagem, inicio + i * 200)
      contagem = decisao.contagem
      decisoes.push(decisao)
    }
    return decisoes
  }

  it('ELO CRÍTICO: o 5º toque engole o clique, senão o link vence o painel', () => {
    const quinto = sequencia(TOQUES_NECESSARIOS).at(-1)

    expect(quinto?.irAoPainel, 'o 5º toque precisa levar ao painel').toBe(true)
    expect(
      quinto?.engolirClique,
      'o 5º toque zera a contagem, e é justamente por isso que a decisão de ' +
        'cancelar a navegação do <Link> NÃO pode ser derivada dela depois. ' +
        'Sem este cancelamento, o link vai para a home e a home chega depois ' +
        'do push do painel.',
    ).toBe(true)
  })

  it('o primeiro toque continua levando para a home', () => {
    const primeiro = sequencia(1)[0]

    expect(primeiro?.engolirClique).toBe(false)
    expect(primeiro?.irAoPainel).toBe(false)
    expect(primeiro?.prefetchDoPainel).toBe(false)
  })

  it('do segundo toque em diante a navegação do link é cancelada', () => {
    const decisoes = sequencia(4)

    expect(decisoes.map((d) => d.engolirClique)).toEqual([false, true, true, true])
  })

  it('o painel começa a ser baixado no 3º toque, e uma vez só', () => {
    const decisoes = sequencia(TOQUES_NECESSARIOS)

    expect(decisoes.map((d) => d.prefetchDoPainel).filter(Boolean)).toHaveLength(1)
    expect(decisoes[TOQUES_ATE_FEEDBACK - 1]?.prefetchDoPainel).toBe(true)
  })

  it('a contagem zera ao chegar no painel, para o 6º toque não voltar para lá', () => {
    const quinto = sequencia(TOQUES_NECESSARIOS).at(-1)
    expect(quinto?.contagem).toEqual({ total: 0, ultimoToque: 0 })

    // O toque seguinte é um primeiro toque, e leva para a home.
    const seguinte = decidirToque(quinto!.contagem, inicio + 5000)
    expect(seguinte.toque).toBe(1)
    expect(seguinte.irAoPainel).toBe(false)
    expect(seguinte.engolirClique).toBe(false)
  })

  it('a pausa longa recomeça a sequência', () => {
    const anterior: Contagem = { total: 4, ultimoToque: inicio }
    const depoisDaPausa = decidirToque(anterior, inicio + JANELA_MS + 1)

    expect(depoisDaPausa.toque, 'quatro toques e uma pausa não viram o quinto').toBe(1)
    expect(depoisDaPausa.irAoPainel).toBe(false)
  })

  it('a janela é de ociosidade: no limite exato a sequência continua', () => {
    const anterior: Contagem = { total: 4, ultimoToque: inicio }
    const noLimite = decidirToque(anterior, inicio + JANELA_MS)

    expect(noLimite.toque).toBe(TOQUES_NECESSARIOS)
    expect(noLimite.irAoPainel).toBe(true)
  })

  it('o 5º toque reporta `toque` 5 mesmo com a contagem zerada', () => {
    // O pulso e a contagem gravada são coisas diferentes, e confundir as duas
    // foi a origem do defeito lá em cima.
    const quinto = sequencia(TOQUES_NECESSARIOS).at(-1)

    expect(quinto?.toque).toBe(TOQUES_NECESSARIOS)
    expect(quinto?.contagem.total).toBe(0)
  })
})
