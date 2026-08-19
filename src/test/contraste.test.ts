import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Arredonda para exibir numa mensagem de erro.
 *
 * Existe porque `toFixed` é proibido no projeto inteiro pelo ESLint: dinheiro
 * aqui é Int de centavos, e `toFixed` foi o atalho que no projeto de
 * referência reintroduziu float e errava sistematicamente acima de R$ 8.192.
 *
 * A regra não distingue dinheiro de razão de contraste ou de milissegundo, e
 * abrir exceção para arquivo de teste enfraqueceria a trava onde ela importa.
 * Sai mais barato ter esta função de três linhas.
 */
function arredondar(valor: number, casas: number): string {
  const fator = 10 ** casas
  return String(Math.round(valor * fator) / fator)
}

/**
 * O CONTRASTE DA PALETA É MEDIDO, NÃO PROMETIDO.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE ISTO EXISTE
 * ════════════════════════════════════════════════════════════════════════════
 * O topo de `globals.css` tem uma tabela de contraste com valores medidos, e
 * ela é a referência de todo o projeto. Em 18/08/2026 descobrimos que a tabela
 * estava certa e o CÓDIGO não: o utilitário `.preco` usava `orange-500`, que
 * passa sobre branco por 0,15 de margem e REPROVA sobre areia, e o preço vive
 * sobre areia na Caqui Wear inteira e no hover de toda lista do site.
 *
 * Ou seja: o número estava escrito, correto, e ninguém tinha como saber que o
 * código havia se afastado dele. Documentação não verifica nada.
 *
 * Este arquivo mede de novo, a partir dos valores hexadecimais que estão de
 * fato no arquivo, e falha quando uma combinação usada pelo site cai abaixo do
 * mínimo. Se alguém trocar um token, o teste refaz a conta sozinho.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * OS MÍNIMOS
 * ════════════════════════════════════════════════════════════════════════════
 * WCAG 2.2, nível AA:
 *   4,5:1  texto normal
 *   3,0:1  texto grande (>= 24px, ou >= 18,66px em negrito) e componente de UI
 */

const CSS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

/** Lê um token de cor direto do arquivo, para o teste não ter uma cópia. */
function token(nome: string): string {
  const achado = new RegExp(`--color-caqui-${nome}:\\s*(#[0-9a-fA-F]{6})`).exec(CSS)
  if (!achado?.[1]) throw new Error(`token --color-caqui-${nome} não encontrado em globals.css`)
  return achado[1].toLowerCase()
}

function luminancia(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const canal = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255)
}

function razao(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number]
  return (claro + 0.05) / (escuro + 0.05)
}

const BRANCO = '#ffffff'

/**
 * As superfícies em que o preço de fato aparece hoje.
 *
 * `sand-100` entra por dois caminhos: a página da peça inteira é `secao-wear`,
 * e as linhas da agenda e do índice de roteiros pintam `hover:bg-caqui-sand-100`.
 */
const SUPERFICIES_DO_PRECO = [
  ['branco', BRANCO],
  ['sand-100', token('sand-100')],
  ['sand-200', token('sand-200')],
  ['noite-900', token('noite-900')],
  ['ink-900', token('ink-900')],
] as const

describe('o preço passa em TODA superfície onde ele aparece', () => {
  // A cor sai do próprio utilitário, não de uma constante repetida aqui.
  const corDoPreco = (() => {
    const bloco = /@utility preco \{[\s\S]*?\}/.exec(CSS)?.[0] ?? ''
    const nome = /var\(--color-caqui-([a-z0-9-]+)\)/.exec(bloco)?.[1]
    if (!nome) throw new Error('não consegui ler a cor de `@utility preco`')
    return token(nome)
  })()

  for (const [nome, fundo] of SUPERFICIES_DO_PRECO) {
    it(`sobre ${nome}`, () => {
      const medido = razao(corDoPreco, fundo)

      expect(
        medido,
        `O preço (${corDoPreco}) sobre ${nome} (${fundo}) dá ${arredondar(medido, 2)}:1.\n` +
          'O mínimo é 3:1, porque `.preco` trava a fonte em 28px e acima de 24px o WCAG ' +
          'aceita 3:1.\n\n' +
          'Em 18/08/2026 este teste nasceu porque `.preco` era `orange-500`, que dá 2,80:1 ' +
          'sobre areia. A página inteira da Caqui Wear é areia.',
      ).toBeGreaterThanOrEqual(3)
    })
  }
})

describe('a tabela do topo de globals.css continua verdadeira', () => {
  // Amostras da tabela sancionada. Se um token mudar de valor, a conta refaz
  // sozinha e o teste avisa antes de a tela mentir.
  const CASOS = [
    { texto: token('ink-900'), fundo: BRANCO, minimo: 4.5, rotulo: 'ink-900 sobre branco' },
    { texto: token('ink-700'), fundo: BRANCO, minimo: 4.5, rotulo: 'ink-700 sobre branco' },
    {
      texto: token('forest-800'),
      fundo: BRANCO,
      minimo: 4.5,
      rotulo: 'forest-800 sobre branco',
    },
    {
      texto: token('sand-400'),
      fundo: token('noite-900'),
      minimo: 4.5,
      rotulo: 'sand-400 sobre a noite (rótulo secundário do rodapé)',
    },
    {
      texto: token('realce-escuro'),
      fundo: token('noite-900'),
      minimo: 4.5,
      rotulo: 'realce-escuro sobre a noite (o laranja como texto)',
    },
    {
      texto: token('danger-claro'),
      fundo: token('noite-900'),
      minimo: 4.5,
      rotulo: 'danger-claro sobre a noite (erro de formulário)',
    },
    {
      texto: BRANCO,
      fundo: token('noite-900'),
      minimo: 4.5,
      rotulo: 'branco sobre a noite',
    },
    {
      texto: token('ink-900'),
      fundo: token('orange-500'),
      minimo: 4.5,
      rotulo: 'ink-900 sobre orange-500 (rótulo do botão primário)',
    },
  ]

  for (const caso of CASOS) {
    it(caso.rotulo, () => {
      const medido = razao(caso.texto, caso.fundo)
      expect(
        medido,
        `${caso.rotulo}: ${arredondar(medido, 2)}:1, abaixo do mínimo de ${caso.minimo}:1.`,
      ).toBeGreaterThanOrEqual(caso.minimo)
    })
  }

  it('e as combinações PROIBIDAS continuam proibidas', () => {
    // Se alguma delas passasse a caber, a tabela estaria desatualizada e o
    // comentário do topo do arquivo passaria a mentir na outra direção.
    expect(razao(BRANCO, token('orange-500'))).toBeLessThan(4.5)
    expect(razao(token('orange-500'), token('sand-100'))).toBeLessThan(3)
    expect(razao(token('ink-500'), token('noite-900'))).toBeLessThan(4.5)
  })
})
