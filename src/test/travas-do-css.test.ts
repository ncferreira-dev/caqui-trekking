import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * TRAVAS DO CSS.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DUAS COISAS QUE NÃO QUEBRAM NADA E APARECEM NA TELA
 * ════════════════════════════════════════════════════════════════════════════
 * Nenhum dos dois defeitos abaixo derruba build, derruba tipo, ou aparece numa
 * revisão de diff. Os dois moram na FOLHA inteira, não numa linha, e por isso
 * a checagem também precisa ser sobre a folha inteira.
 *
 * Ambos são varreduras que precisam voltar vazias, não testes que afirmam
 * sucesso.
 */

const RAIZ = path.resolve(import.meta.dirname, '..')
const CSS = readFileSync(path.join(RAIZ, 'app/globals.css'), 'utf8')

/** Todo arquivo de código do projeto, menos o próprio CSS. */
function arquivosDeCodigo(dir: string, acumulado: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome === 'generated') continue
    const caminho = path.join(dir, nome)
    if (statSync(caminho).isDirectory()) arquivosDeCodigo(caminho, acumulado)
    else if (/\.(ts|tsx|mts|css)$/.test(nome) && !nome.endsWith('globals.css')) {
      acumulado.push(caminho)
    }
  }
  return acumulado
}

const CODIGO = arquivosDeCodigo(RAIZ)
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')

describe('utilitário declarado é utilitário usado', () => {
  /**
   * Tailwind 4 só emite a regra de um `@utility` quando alguém escreve a
   * classe. Um utilitário órfão custa ZERO bytes na página — e é exatamente
   * por isso que ele fica: nada reclama.
   *
   * O custo é de leitura. `chanfro-sm` e `chanfro-md` lado a lado ensinam que
   * existe uma escolha de tamanho de chanfro, e a próxima pessoa gasta um
   * minuto decidindo entre dois valores dos quais um nunca foi usado por
   * ninguém. Documentação que descreve um sistema que não existe é pior que
   * documentação nenhuma.
   *
   * Medido em 18/08/2026: `chanfro-sm` e `sangra-direita`, ambos com comentário
   * de projeto completo, ambos com zero ocorrências no `src/`.
   */
  it('nenhum @utility do globals.css está órfão', () => {
    const declarados = [...CSS.matchAll(/@utility\s+([a-z0-9-]+)\s*\{/g)].map((m) => m[1]!)
    expect(declarados.length).toBeGreaterThan(5)

    const orfaos = declarados.filter((nome) => {
      // Fronteira de palavra à direita para `chanfro` não casar com
      // `chanfro-md`, e à esquerda para `preco` não casar com `sub-preco`.
      const usado = new RegExp(`(^|[^a-z0-9-])${nome}([^a-z0-9-]|$)`)
      return !usado.test(CODIGO)
    })

    expect(orfaos).toEqual([])
  })
})

describe('movimento reduzido não pode perder por ordem de arquivo', () => {
  /**
   * `[data-revelar='oculto']` e `[data-revelar]` têm a mesma especificidade.
   * Entre iguais vence quem vem depois, e `@media` não acrescenta peso.
   *
   * O override de movimento reduzido morava setenta linhas ACIMA do
   * `opacity: 0`, então ele estava escrito, estava comentado e perdia. O
   * caminho em que isso morde: o observer marca a peça como `oculto`, e só
   * então o movimento reduzido passa a valer. A peça fica presa invisível.
   */
  it('o override de [data-revelar] vem depois do estado oculto', () => {
    // A conta é sobre POSIÇÃO, e ela é feita sobre as regras de verdade: a
    // última que esconde precisa vir antes da última que mostra. Procurar por
    // uma linha específica falharia no dia em que alguém reescrevesse o
    // seletor, que é exatamente quando este teste precisa continuar valendo.
    const regras = [...CSS.matchAll(/\[data-revelar[^{]*\{([^}]*)\}/g)]

    const esconde = regras.filter((m) => /opacity:\s*0\b/.test(m[1]!))
    const mostra = regras.filter((m) => /opacity:\s*1\b/.test(m[1]!))

    expect(esconde.length).toBeGreaterThan(0)
    expect(mostra.length).toBeGreaterThan(0)

    const ultimoQueEsconde = Math.max(...esconde.map((m) => m.index))
    const ultimoQueMostra = Math.max(...mostra.map((m) => m.index))

    expect(ultimoQueMostra).toBeGreaterThan(ultimoQueEsconde)
  })

  it('quem mostra de volta está dentro de prefers-reduced-motion', () => {
    // Sem esta parte, a regra acima passaria com um `opacity: 1` incondicional
    // no fim do arquivo, que apagaria a animação para todo mundo.
    const bloco = CSS.slice(CSS.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
    expect(bloco).toContain('[data-revelar]')
    expect(bloco).toContain('opacity: 1')
  })

  it('não sobrou nenhum opacity:0 solto para data-revelar fora do estado oculto', () => {
    // O componente aplica `oculto` por JS de propósito: se o script não roda,
    // nada fica escondido. Uma regra `[data-revelar] { opacity: 0 }` solta
    // desfaria isso e publicaria a página em branco para quem não executa JS.
    const regras = [...CSS.matchAll(/\[data-revelar\][^{']*\{([^}]*)\}/g)].map((m) => m[1]!)
    const escondem = regras.filter((corpo) => /opacity:\s*0\s*;/.test(corpo))
    expect(escondem).toEqual([])
  })
})

describe('scroll-behavior global não volta', () => {
  /**
   * ════════════════════════════════════════════════════════════════════════
   * ELE QUEBRAVA TODA NAVEGAÇÃO DO SITE
   * ════════════════════════════════════════════════════════════════════════
   * `html { scroll-behavior: smooth }` esteve no `@layer base`. Ele não
   * escolhe o que suaviza: pegava também o reset de rolagem que o roteador faz
   * a cada troca de rota, e esse reset era cancelado pelo render da página nova
   * antes de chegar ao topo.
   *
   * Relatado pelo cliente em 19/08/2026 como "aperto na logo e o site força a
   * abaixar em vez de voltar para o vídeo". Medido, valia para TODA troca de
   * aba: sair de `/trekking` rolado em 900px e chegar em `/wear` também em
   * 900px. Com `auto`, ia para 0.
   *
   * A suavidade das âncoras voltou por `shell/rolagem-suave.tsx`, que
   * intercepta só o clique numa âncora da MESMA página.
   *
   * É uma linha de CSS que ninguém desconfia, e o defeito não aparece em
   * nenhuma tela isolada: só em quem navega. Por isso vira trava.
   */
  it('`scroll-behavior: smooth` não volta ao CSS, em regra nenhuma', () => {
    // A trava é DELIBERADAMENTE grosseira: qualquer declaração, em qualquer
    // seletor. Distinguir "o elemento que rola a página" de "um contêiner com
    // rolagem própria" exigiria um parser de CSS de verdade, e um teste que
    // erra a distinção passa verde justamente no caso caro.
    //
    // Se um dia um contêiner precisar de rolagem suave, este teste falha e a
    // conversa acontece antes do commit, que é onde ela precisa acontecer.
    // A suavidade das âncoras da página já está resolvida em
    // `shell/rolagem-suave.tsx`, sem CSS global.
    const semComentarios = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(semComentarios).not.toMatch(/scroll-behavior:\s*smooth/)
  })
})
