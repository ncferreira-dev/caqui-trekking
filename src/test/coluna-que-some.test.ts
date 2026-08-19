import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * A COLUNA QUE SUMIU.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O DEFEITO, MEDIDO NA TELA EM 19/08/2026
 * ════════════════════════════════════════════════════════════════════════════
 * Em /crm/saidas e /crm/roteiros a linha é um flex: identificação à esquerda
 * (data, hora, preço, nome), controles à direita (vagas, ordem, destaque,
 * editar, arquivar, cancelar).
 *
 * A coluna da esquerda era `min-w-0 flex-1`. Isso é `flex: 1 1 0%`: base
 * ZERO, cresce só com a sobra. O bloco de controles não declara encolhimento
 * e o conteúdo dele é largo, então não sobrava nada — e `min-w-0` é a
 * permissão explícita de ir até zero.
 *
 * Medido: em /crm/saidas a coluna tinha largura 0 em 1100px e 85px em 1280px.
 * Em /crm/roteiros os CINCO roteiros tinham largura 0 em 1024px, com o nome
 * caindo uma palavra por linha por cima dos botões.
 *
 * Na prática a tela dizia "de 12, faltam 6" sem dizer de qual saída.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O QUE ESTA TRAVA ALCANÇA, E O QUE ELA NÃO ALCANÇA
 * ════════════════════════════════════════════════════════════════════════════
 * Ela varre a FORMA no código: linha que vira horizontal num breakpoint com
 * uma coluna `min-w-0 flex-1` logo abaixo. Essa forma exige piso de largura.
 *
 * Ela NÃO enxerga largura calculada. Colapso é resultado de layout, e o
 * projeto não tem navegador na bateria de testes. Uma linha escrita de outro
 * jeito pode colapsar sem esta trava piscar.
 *
 * A varredura de largura real é MANUAL e está em docs/10-crm.md, com o trecho
 * que a executa no console. Está declarada como manual de propósito: uma
 * trava que finge medir o que não mede é pior que trava nenhuma.
 */

const RAIZ = path.resolve(import.meta.dirname, '..')

/** Quantas linhas abaixo do `flex-row` ainda contam como a mesma linha. */
const JANELA = 12

function telas(dir: string, acumulado: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === 'test' || nome === 'node_modules') continue
    const caminho = path.join(dir, nome)
    if (statSync(caminho).isDirectory()) telas(caminho, acumulado)
    else if (nome.endsWith('.tsx')) acumulado.push(caminho)
  }
  return acumulado
}

describe('coluna flexível não pode colapsar a zero', () => {
  it('linha que vira horizontal num breakpoint dá piso de largura à coluna', () => {
    const semPiso: string[] = []
    let examinadas = 0

    for (const arquivo of telas(RAIZ)) {
      const linhas = readFileSync(arquivo, 'utf8').split('\n')

      linhas.forEach((linha, i) => {
        // Só breakpoint: `flex-row` sem prefixo é linha horizontal em toda
        // largura, e aí o irmão costuma ser estreito e fixo. O defeito nasceu
        // na forma "empilha no celular, deita no desktop".
        if (!/\b(sm|md|lg|xl|2xl):flex-row\b/.test(linha)) return
        examinadas += 1

        const janela = linhas.slice(i + 1, i + 1 + JANELA)
        for (const seguinte of janela) {
          const classe = /className="([^"]*)"/.exec(seguinte)?.[1]
          if (!classe) continue
          if (!classe.includes('min-w-0') || !classe.includes('flex-1')) continue

          // O piso precisa valer no mesmo lugar em que a linha deita.
          if (!/\b(sm|md|lg|xl|2xl):min-w-(?!0\b)[\w.[\]/-]+/.test(classe)) {
            semPiso.push(`${path.relative(RAIZ, arquivo)}:${i + 1} → ${classe}`)
          }
        }
      })
    }

    // Se a varredura parar de achar linhas para examinar, ela para de
    // proteger e passaria verde para sempre.
    expect(examinadas).toBeGreaterThan(1)

    expect(
      semPiso,
      'Coluna `min-w-0 flex-1` numa linha que vira horizontal, sem piso de largura.\n' +
        '`flex-1` tem base zero: se o irmão ao lado for largo, esta coluna vai a ZERO e ' +
        'o texto dela é pintado por baixo do irmão.\n\n' +
        'Conserto: acrescente um piso no mesmo breakpoint, por exemplo `lg:min-w-56`.\n\n' +
        semPiso.join('\n'),
    ).toEqual([])
  })
})
