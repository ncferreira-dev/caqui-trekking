'use client'

import { useEffect, useState } from 'react'

import { classesDeBotao } from '@/components/ui/button'
import { formatarBRL } from '@/lib/money'
import { cn } from '@/lib/ui/cn'

/**
 * A barra fixa de compra do mobile.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ELA SOME QUANDO O SELETOR ESTÁ NA TELA
 * ────────────────────────────────────────────────────────────────────────────
 * Uma barra que fica sempre visível acaba flutuando por cima do próprio bloco
 * que manda usar — a pessoa rola até o seletor de datas e a barra tapa a
 * última linha dele, que é onde está o botão. Pior: passa a haver dois "chame
 * a ação" idênticos na mesma tela, e o de baixo cobre o de cima.
 *
 * Um `IntersectionObserver` no `#seletor-de-saida` resolve: a barra existe
 * enquanto o seletor está longe e sai de cena quando ele aparece. O observer
 * custa zero durante a rolagem — quem avisa é o navegador.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ELA NASCE ESCONDIDA E APARECE POR JS
 * ────────────────────────────────────────────────────────────────────────────
 * O contrário — nascer visível e sumir no primeiro quadro — pisca uma barra
 * preta na base da tela em toda visita, inclusive nas em que ela nem devia
 * existir (desktop, ou página aberta já no seletor). Como o elemento é
 * auxiliar, começar ausente é a degradação certa: sem JavaScript, a página
 * continua inteira e o seletor continua a um rolar de distância.
 *
 * `lg:hidden` porque no desktop o seletor é uma coluna fixa que já acompanha a
 * rolagem. Duas âncoras permanentes para a mesma ação seria ruído.
 */
const VARIANTE_ESGOTADO = { variante: 'secondary' } as const

export function BarraDeCompra({
  precoCentavos,
  rotulo,
  desabilitada = false,
}: {
  precoCentavos: number
  /** "A partir de" quando há várias datas; a data em si quando há uma só. */
  rotulo: string
  /** Tudo esgotado: a barra informa, mas não promete. */
  desabilitada?: boolean
}) {
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    const alvo = document.getElementById('seletor-de-saida')
    if (!alvo) return

    const observador = new IntersectionObserver(
      (entradas) => {
        const entrada = entradas[0]
        if (entrada) setVisivel(!entrada.isIntersecting)
      },
      // A barra tem ~72px. A margem negativa embaixo evita que ela reapareça
      // no exato instante em que o seletor sai por baixo dela, o que produz um
      // pisca-pisca ao rolar devagar.
      { rootMargin: '-80px 0px -120px 0px' },
    )

    observador.observe(alvo)
    return () => observador.disconnect()
  }, [])

  /**
   * Avisa o CSS que a barra está em cena.
   *
   * O botão flutuante do WhatsApp mora no layout da loja, é componente de
   * SERVIDOR e ocupa o mesmo canto inferior com o mesmo `z-index` — medido no
   * navegador, o círculo verde cobria o CTA desta barra. Um atributo no
   * `<html>` deixa o CSS resolver a colisão (ver globals.css) sem transformar
   * um link estático em componente de cliente e sem contexto atravessando o
   * layout inteiro.
   *
   * `lg:hidden` some com a barra no desktop, mas a classe não some do CSS: por
   * isso a regra lá também é escopada ao mesmo ponto de corte.
   */
  useEffect(() => {
    const raiz = document.documentElement
    raiz.dataset['barraDeCompra'] = visivel ? 'visivel' : 'oculta'

    return () => {
      delete raiz.dataset['barraDeCompra']
    }
  }, [visivel])

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 lg:hidden',
        'border-caqui-ink-900 border-t bg-white',
        // `pb-[env(safe-area-inset-bottom)]`: sem isso, no iPhone a barra fica
        // atrás do indicador de home e o botão perde metade da área de toque.
        'pb-[env(safe-area-inset-bottom)]',
        'transition-transform duration-200 ease-[var(--ease-saida)]',
        visivel ? 'translate-y-0' : 'translate-y-full',
      )}
      // Fora da tela ela também sai da ordem de tabulação e do leitor de tela:
      // um botão invisível que ainda recebe foco é uma armadilha de teclado.
      aria-hidden={!visivel}
      {...(visivel ? {} : { inert: true })}
    >
      <div className="flex items-center justify-between gap-4 px-5 py-3">
        <div>
          <p className="text-caqui-ink-500 text-micro font-mono uppercase">{rotulo}</p>
          <p className="preco">{formatarBRL(precoCentavos)}</p>
        </div>

        {/* Um `<a>` de âncora, não um botão com `scrollIntoView`: assim o
            destino entra no histórico, funciona com o clique do meio e
            respeita o `scroll-behavior: smooth` do CSS — que já está
            desligado sob `prefers-reduced-motion`. */}
        {/* `classesDeBotao()` e não a string remontada à mão: a versão manual
            perdia `text-sm`, `tracking-tight`, a transição e os estados de
            hover e active do sistema.

            E o estado esgotado usa `secondary`, uma variante que EXISTE, em vez
            de inventar `bg-caqui-sand-200` — que era uma quinta variante
            informal. Passá-la por `className` também não funcionaria: `cn` é
            `filter(Boolean).join(' ')`, não tailwind-merge (decisão documentada
            em lib/ui/cn.ts), então ela conviveria com `bg-caqui-orange-500` e
            quem venceria seria a ordem do CSS gerado.

            O link nunca é de fato desabilitado: com tudo esgotado ele ainda
            leva às datas, que é onde mora o "Avise-me". O que muda é a ênfase. */}
        <a
          href="#seletor-de-saida"
          className={classesDeBotao(desabilitada ? VARIANTE_ESGOTADO : {})}
        >
          <span>{desabilitada ? 'Ver datas' : 'Escolher data'}</span>
        </a>
      </div>
    </div>
  )
}
