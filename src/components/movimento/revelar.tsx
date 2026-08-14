'use client'

import { type ElementType, type ReactNode, useEffect, useRef } from 'react'

/**
 * Revelar ao rolar, com `IntersectionObserver`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O CONTEÚDO NUNCA COMEÇA ESCONDIDO NO CSS
 * ────────────────────────────────────────────────────────────────────────────
 * O jeito comum é uma classe `.reveal { opacity: 0 }` no CSS e um script que a
 * remove. Isso publica uma página em branco para quem tem JavaScript desligado,
 * para quem está numa rede que engoliu o bundle, e para o robô que não executa
 * script. E o defeito nunca aparece em desenvolvimento.
 *
 * Aqui o estado inicial é aplicado PELO PRÓPRIO JS, no efeito. Se o efeito não
 * roda, nada é escondido. O custo é um quadro em que o elemento aparece antes
 * de recuar — imperceptível, e infinitamente melhor que o inverso.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * MOVIMENTO REDUZIDO: NEM O OBSERVER É CRIADO
 * ────────────────────────────────────────────────────────────────────────────
 * Não basta zerar a duração da transição. Sob `prefers-reduced-motion` o
 * componente não esconde nada e não observa nada — zero trabalho, zero
 * `will-change`, zero risco de conteúdo preso invisível se o observer falhar.
 */
export function Revelar({
  children,
  como: Como = 'div',
  atraso = 0,
  className,
}: {
  children: ReactNode
  /** Elemento renderizado. Use `section`, `li`… para não sujar a semântica. */
  como?: ElementType
  /** Escalonamento, em ms. Para listas: 0, 60, 120… */
  atraso?: number
  className?: string
}) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const elemento = ref.current
    if (!elemento) return

    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduzido || typeof IntersectionObserver === 'undefined') return

    elemento.dataset['revelar'] = 'oculto'
    if (atraso > 0) elemento.style.transitionDelay = `${atraso}ms`

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada?.isIntersecting) return
        elemento.dataset['revelar'] = 'visivel'
        // Uma vez revelado, para de observar. Reanimar ao rolar de volta é
        // enjoativo e mantém trabalho vivo pelo resto da sessão.
        observador.disconnect()
      },
      // Dispara um pouco antes de entrar na tela: a transição termina quando o
      // elemento chega, em vez de começar depois.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    )

    observador.observe(elemento)
    return () => observador.disconnect()
  }, [atraso])

  return (
    <Como ref={ref} className={className}>
      {children}
    </Como>
  )
}
