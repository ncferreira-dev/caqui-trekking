import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * TODA PÁGINA DA LOJA ABRE ESCURO.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO É UM TESTE E NÃO UM COMENTÁRIO
 * ────────────────────────────────────────────────────────────────────────────
 * O `Header` é transparente no topo e pinta os links em BRANCO, porque a
 * primeira seção de toda página da loja é o palco noturno. Ele não descobre
 * isso: ele assume.
 *
 * Até 18/08/2026 a suposição era uma lista de rotas dentro do próprio Header.
 * Quando `CabecalhoDePagina` virou palco escuro, a lista passou a conter todas
 * as rotas — uma condição sempre verdadeira, escrita com passos extras — e foi
 * removida.
 *
 * O que ficou no lugar dela é esta varredura. Uma página nova que abrisse com
 * fundo claro deixaria os links do header BRANCOS SOBRE BRANCO: invisíveis,
 * ainda clicáveis, e sem nenhum erro em lugar nenhum. É o tipo de defeito que
 * ninguém encontra porque ninguém está procurando — quem escreveu a página
 * olhou a página, não o header.
 *
 * A checagem é uma busca que precisa voltar VAZIA, e não um teste que afirma
 * sucesso: ela prova que a classe inteira do defeito não existe, em vez de
 * provar que um caminho funciona.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A PRIMEIRA VERSÃO DESTE TESTE ERA OCA, E ISSO FOI DESCOBERTO TENTANDO
 * ────────────────────────────────────────────────────────────────────────────
 * Ela verificava só se cada página usava `CabecalhoDePagina`. Trocando
 * `palco-noite` por `secao-areia` DENTRO do componente, as sete páginas
 * passaram a abrir claras e o teste continuou verde: ele provava que a página
 * chamava o componente, não que o componente abria escuro.
 *
 * A corrente só fecha com os dois elos, e por isso há dois casos aqui:
 *
 *   elo 1  toda página abre com `CabecalhoDePagina` ou com `palco-noite`
 *   elo 2  `CabecalhoDePagina` abre com `palco-noite`
 *
 * Verificado quebrando cada elo separadamente e vendo o teste acusar.
 */

const RAIZ = join(process.cwd(), 'src/app/(loja)')

/**
 * As duas formas sancionadas de abrir uma página da loja.
 *
 * `CabecalhoDePagina` é o caminho normal e já renderiza `palco-noite` por
 * dentro. `palco-noite` direto é para as páginas que compõem a própria abertura
 * (a home, com vídeo; `/sobre` e `/guia-particular`, com serra própria).
 */
const ABERTURAS = ['CabecalhoDePagina', 'palco-noite'] as const

function paginasDaLoja(dir: string, encontradas: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) paginasDaLoja(caminho, encontradas)
    else if (nome === 'page.tsx') encontradas.push(caminho)
  }
  return encontradas
}

describe('abertura das páginas da loja', () => {
  it('ELO 2: CabecalhoDePagina abre com palco-noite', () => {
    // Sem este caso, o caso das páginas é vacuidade: elas usam o componente
    // certo e o componente pode estar pintando areia. Foi o que aconteceu na
    // primeira versão. Ver o bloco no topo do arquivo.
    const fonte = readFileSync(
      join(process.cwd(), 'src/components/shell/cabecalho-de-pagina.tsx'),
      'utf8',
    )
    const semComentarios = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '')

    expect(
      semComentarios.includes('palco-noite'),
      'CabecalhoDePagina deixou de abrir com `palco-noite`. Sete páginas da loja dependem disso, ' +
        'e o Header pinta os links em branco assumindo fundo escuro.',
    ).toBe(true)
  })

  const paginas = paginasDaLoja(RAIZ)

  it('encontra as páginas — se esta falhar, o caminho da varredura quebrou', () => {
    // Uma varredura que não acha nada passa em todos os outros casos por
    // vacuidade. Este caso existe para que o teste não possa mentir dizendo
    // "zero problemas" quando na verdade olhou zero arquivos.
    expect(paginas.length).toBeGreaterThanOrEqual(9)
  })

  it.each(paginasDaLoja(RAIZ).map((p) => [p.replace(process.cwd() + '/', ''), p]))(
    'ELO 1: %s usa uma abertura sancionada',
    (_rotulo, caminho) => {
      const fonte = readFileSync(caminho, 'utf8')

      // Descarta comentários: `/guia-particular` MENCIONA `CabecalhoDePagina`
      // num comentário explicando por que não o usa, e sem esta limpeza a
      // menção passaria por uso.
      const semComentarios = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '')

      const abre = ABERTURAS.some((marca) => semComentarios.includes(marca))

      expect(
        abre,
        `${caminho} não abre com nenhuma das aberturas sancionadas (${ABERTURAS.join(' ou ')}). ` +
          'O Header pinta os links em branco assumindo fundo escuro; com fundo claro eles ficam invisíveis. ' +
          'Ver o comentário no topo de src/components/shell/header.tsx.',
      ).toBe(true)
    },
  )
})
