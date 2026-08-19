import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { ACOES } from '@/components/crm/trilha-de-auditoria'

/**
 * TRAVAS DA TRILHA DE AUDITORIA.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O DEFEITO QUE ISTO IMPEDE, VISTO NA PRIMEIRA VEZ QUE A TELA ABRIU
 * ════════════════════════════════════════════════════════════════════════════
 * A tela de "O que mudou" traduz o nome cru da ação (`departure.vagas`) para o
 * que a pessoa lê ("lançou vagas"). Assim que ela abriu, duas ações apareceram
 * cruas: `departure.fechar` e `departure.refechar` — escritas com um ternário,
 * que a varredura manual não pegou.
 *
 * Não quebra nada: a tela degrada para a chave crua, de propósito. Mas a
 * tradução é a única coisa que faz a trilha ser LIDA, e uma linha em jargão no
 * meio de vinte em português é a que ninguém entende.
 *
 * Esta é uma busca que precisa voltar vazia: toda ação escrita no servidor
 * precisa ter tradução, e ação nova nasce quebrando o teste.
 */

const SERVIDOR = path.resolve(import.meta.dirname, '../server')

function arquivos(dir: string, acumulado: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = path.join(dir, nome)
    if (statSync(caminho).isDirectory()) arquivos(caminho, acumulado)
    else if (nome.endsWith('.ts')) acumulado.push(caminho)
  }
  return acumulado
}

describe('a trilha de auditoria fala português', () => {
  it('toda ação gravada pelo servidor tem tradução na tela', () => {
    /**
     * Pega o literal na MESMA linha do `action:` e nas duas seguintes: cobre
     * a forma direta (`action: 'trip.update'`), a quebrada pelo Prettier, e a
     * do ternário (`action: x ? 'a' : 'b'`), que foi justamente a que escapou.
     */
    const encontradas = new Set<string>()

    for (const arquivo of arquivos(SERVIDOR)) {
      const linhas = readFileSync(arquivo, 'utf8').split('\n')
      linhas.forEach((linha, i) => {
        if (!linha.includes('action:')) return
        const janela = linhas.slice(i, i + 3).join(' ')
        for (const achado of janela.matchAll(/'([a-z]+\.[a-zA-Z]+)'/g)) {
          encontradas.add(achado[1]!)
        }
      })
    }

    // Se a varredura parar de achar nada, ela para de proteger — e passaria
    // verde para sempre. Este piso é o que impede o teste de virar decoração.
    expect(encontradas.size).toBeGreaterThan(15)

    const semTraducao = [...encontradas].filter((acao) => !(acao in ACOES))
    expect(semTraducao).toEqual([])
  })

  it('nenhuma tradução sobra para ação que não existe mais', () => {
    // Uma tabela que descreve ações inexistentes é documentação envelhecida,
    // que é pior que documentação nenhuma. As exceções são declaradas.
    //
    // `departure.availability` é o nome ANTIGO de `departure.disponibilidade`,
    // e há linhas com ele no banco de quem já rodava o CRM: a tradução fica
    // para o histórico continuar legível.
    const LEGADAS = new Set(['departure.availability'])

    const noCodigo = new Set<string>()
    for (const arquivo of arquivos(SERVIDOR)) {
      const texto = readFileSync(arquivo, 'utf8')
      for (const achado of texto.matchAll(/'([a-z]+\.[a-zA-Z]+)'/g)) noCodigo.add(achado[1]!)
    }

    const orfas = Object.keys(ACOES).filter((a) => !noCodigo.has(a) && !LEGADAS.has(a))
    expect(orfas).toEqual([])
  })
})
