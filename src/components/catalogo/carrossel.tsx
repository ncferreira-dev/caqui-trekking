'use client'

import { useCallback, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/ui/cn'

/**
 * Carrossel horizontal.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A ROLAGEM É NATIVA. AS SETAS SÃO ENFEITE FUNCIONAL.
 * ────────────────────────────────────────────────────────────────────────────
 * `overflow-x: auto` + `scroll-snap` entrega, de graça e sem uma linha de JS:
 * arrastar com o dedo, arrastar com trackpad, roda do mouse na horizontal,
 * Shift+roda, navegação por Tab que traz o item para dentro da vista, e
 * momentum nativo do iOS.
 *
 * Uma biblioteca de carrossel substitui isso tudo por `transform` calculado à
 * mão, quebra a rolagem por teclado, e custa entre 15 e 40 KB. Aqui o
 * JavaScript existe só para as duas setas do desktop — onde não há dedo para
 * arrastar — e são 20 linhas.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * NÃO EXISTE AVANÇO AUTOMÁTICO
 * ────────────────────────────────────────────────────────────────────────────
 * Carrossel que anda sozinho é a violação clássica do WCAG 2.2.2: conteúdo em
 * movimento sem pausa. Fora que ele move o item justamente no instante em que
 * a pessoa vai clicar — e aqui os itens são datas de saída.
 *
 * As setas também não são desabilitadas nas pontas: descobrir isso exigiria
 * medir a rolagem em `useEffect` e sincronizar estado a cada quadro. `scrollBy`
 * já satura sozinho no fim, então o pior caso de um clique a mais é nada
 * acontecer — que é exatamente o que um botão desabilitado faria.
 */
export function Carrossel({
  children,
  rotulo,
  className,
}: {
  children: ReactNode
  /** Nome acessível da região rolável. "Próximas saídas", não "Carrossel". */
  rotulo: string
  className?: string
}) {
  const trilho = useRef<HTMLDivElement>(null)

  const rolar = useCallback((direcao: 1 | -1) => {
    const elemento = trilho.current
    if (!elemento) return
    // 88% da largura visível: sobra uma fatia do próximo card, que é o que
    // avisa que a lista continua. Rolar 100% deixa a tela sem referência.
    elemento.scrollBy({ left: direcao * elemento.clientWidth * 0.88, behavior: 'smooth' })
  }, [])

  return (
    <div className={cn('relative', className)}>
      <div
        ref={trilho}
        // `region` + nome torna a área anunciável e pulável pelo leitor de
        // tela; `tabIndex={0}` é o que o Chrome exige para que a região
        // rolável possa ser rolada pelo teclado.
        role="region"
        aria-label={rotulo}
        tabIndex={0}
        className={cn(
          'flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4',
          // Encosta no sangramento lateral da página: o primeiro card alinha
          // com o texto e o último tem o mesmo respiro à direita.
          'scroll-px-5 px-5 sm:scroll-px-8 sm:px-8',
          // Esconde a barra no Firefox e no WebKit sem esconder a rolagem.
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {children}
      </div>

      <div className="mx-auto hidden w-full max-w-7xl justify-end gap-2 px-5 sm:px-8 lg:flex">
        <Seta direcao={-1} rotulo="Ver saídas anteriores" aoClicar={rolar} />
        <Seta direcao={1} rotulo="Ver próximas saídas" aoClicar={rolar} />
      </div>
    </div>
  )
}

/** Cada filho do carrossel. Largura fixa: `flex-basis` em % encolheria o card no celular. */
export function ItemDoCarrossel({ children }: { children: ReactNode }) {
  return <div className="w-[19rem] shrink-0 snap-start sm:w-[22rem]">{children}</div>
}

function Seta({
  direcao,
  rotulo,
  aoClicar,
}: {
  direcao: 1 | -1
  rotulo: string
  aoClicar: (direcao: 1 | -1) => void
}) {
  return (
    <button
      type="button"
      onClick={() => aoClicar(direcao)}
      aria-label={rotulo}
      className={cn(
        'border-caqui-ink-900 inline-flex size-11 items-center justify-center rounded-xs border',
        'hover:bg-caqui-sand-100 bg-white',
        'shadow-[var(--shadow-corte-1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
        'transition-[transform,box-shadow,background-color] duration-150',
      )}
    >
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
        <path
          d={direcao === -1 ? 'M10.5 1.5 3.5 8l7 6.5' : 'M5.5 1.5 12.5 8l-7 6.5'}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    </button>
  )
}
