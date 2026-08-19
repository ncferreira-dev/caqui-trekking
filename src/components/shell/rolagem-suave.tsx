'use client'

import { useEffect } from 'react'

/**
 * Rolagem suave nas âncoras da própria página.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO É `scroll-behavior: smooth` NO `html`
 * ────────────────────────────────────────────────────────────────────────────
 * Porque era, e QUEBRAVA TODA NAVEGAÇÃO DO SITE. Aquela propriedade não escolhe
 * o que suaviza: ela pega também o reset de rolagem que o roteador faz a cada
 * troca de rota, e esse reset é cancelado pelo render da página nova antes de
 * chegar ao topo. Resultado medido em 19/08/2026: sair de `/trekking` rolado e
 * clicar na logo abria a home já rolada, com o vídeo do herói acima da dobra.
 * Valia para toda troca de aba, não só para a logo.
 *
 * O conserto foi tirar a propriedade global. Ele custou a suavidade das
 * âncoras, e este arquivo devolve a suavidade SEM devolver o defeito: aqui só
 * o clique numa âncora da mesma página é interceptado. Navegação continua
 * sendo instantânea, como precisa ser.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O FOCO VAI JUNTO, E ISSO NÃO É DETALHE
 * ────────────────────────────────────────────────────────────────────────────
 * Rolar sem mover o foco quebraria o "pular para o conteúdo" do cabeçalho, que
 * existe exatamente para quem navega por teclado: a página desceria e o foco
 * continuaria no link, então a próxima tecla Tab voltaria para o menu. Por isso
 * o alvo recebe `tabindex="-1"` (fora da ordem de tabulação, focável por
 * código) e `focus({ preventScroll: true })`, que move o foco sem cancelar a
 * rolagem que acabou de começar.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUANDO ELE SAI DA FRENTE
 * ────────────────────────────────────────────────────────────────────────────
 * Movimento reduzido, clique com Ctrl/Cmd/Shift (abrir em nova aba), `href="#"`
 * puro e alvo inexistente: em todos, o listener não faz nada e o navegador
 * segue com o comportamento padrão. Um interceptador que engole o caso que não
 * sabe tratar é pior que nenhum.
 */
export function RolagemSuave() {
  useEffect(() => {
    function aoClicar(evento: MouseEvent) {
      if (evento.defaultPrevented || evento.button !== 0) return
      if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return

      const alvoDoClique = evento.target
      if (!(alvoDoClique instanceof Element)) return

      const link = alvoDoClique.closest('a')
      if (!link) return

      const href = link.getAttribute('href')
      if (!href || !href.startsWith('#') || href === '#') return

      // `getElementById` e não `querySelector`: id com caractere que precisaria
      // de escape em seletor (ponto, dois-pontos) lançaria em vez de não achar.
      const destino = document.getElementById(decodeURIComponent(href.slice(1)))
      if (!destino) return

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      // ────────────────────────────────────────────────────────────────────
      // ABA EM SEGUNDO PLANO NÃO ANIMA ROLAGEM
      // ────────────────────────────────────────────────────────────────────
      // O navegador não roda animação de rolagem em aba escondida: o
      // `scrollIntoView` suave fica pendurado e a página não sai do lugar. Se
      // este listener tomasse a frente nesse estado, o clique numa âncora
      // simplesmente não faria nada — que é pior que pular sem gesto.
      //
      // Descoberto medindo em 19/08/2026: no navegador automatizado, com o
      // painel escondido, a rolagem suave nunca avançava. Um usuário de
      // verdade está olhando para a aba, então o caminho normal é o de cima;
      // este é o degrau para o resto.
      if (document.visibilityState !== 'visible') return

      evento.preventDefault()

      // O endereço muda ANTES da rolagem: assim o botão voltar desfaz o salto,
      // e copiar a URL leva a pessoa ao mesmo ponto.
      window.history.pushState(null, '', href)

      destino.scrollIntoView({ behavior: 'smooth', block: 'start' })

      if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1')
      destino.focus({ preventScroll: true })
    }

    document.addEventListener('click', aoClicar)
    return () => document.removeEventListener('click', aoClicar)
  }, [])

  return null
}
