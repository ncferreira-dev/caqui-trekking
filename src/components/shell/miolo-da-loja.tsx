'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * O miolo da loja, e o gesto de trocar de página.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O PEDIDO
 * ────────────────────────────────────────────────────────────────────────────
 * "Coloque mais movimento na hora que trocar de aba ou apertar na logo lá em
 * cima" (19/08/2026). Sem nada, a troca de rota é um corte seco: o conteúdo
 * antigo some e o novo aparece no mesmo quadro, e a navegação parece um
 * recarregamento.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * `key` NO CAMINHO, E O RESTO É CSS
 * ────────────────────────────────────────────────────────────────────────────
 * O primeiro caminho tentado foi `<ViewTransition>` do React, que o guia do
 * Next 16 descreve. Medido no navegador, ele não dispara nesta combinação de
 * versões: zero chamadas a `startViewTransition` e zero animações na troca de
 * rota. Um recurso que não roda é pior que nenhum, porque some da vista de
 * quem revisa e fica lá parecendo pronto.
 *
 * O que roda: trocar a `key` remonta o `<main>`, e um elemento recém-montado
 * reinicia sua `animation` do zero. Uma linha de JavaScript, o desenho inteiro
 * em CSS, e nenhuma API experimental no caminho.
 *
 * É o `<main>` que recebe a `key`, e não um `<div>` novo em volta dele: um
 * invólucro a mais mudaria o parentesco de flex de toda página da loja, e o
 * ganho seria zero. O `id="conteudo"` continua onde estava, que é o alvo do
 * "pular para o conteúdo" do cabeçalho.
 *
 * Cabeçalho e rodapé ficam de fora e não piscam: o que se move é a página, e
 * não o site.
 */
export function MioloDaLoja({ children }: { children: ReactNode }) {
  const caminho = usePathname()

  return (
    <main key={caminho} id="conteudo" className="cena-da-pagina flex flex-1 flex-col">
      {children}
    </main>
  )
}
