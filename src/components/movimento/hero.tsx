'use client'

import { type ReactNode, useEffect, useRef } from 'react'

import { cn } from '@/lib/ui/cn'

/**
 * Herói com parallax em camadas.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O PARALLAX É DISCRETO, E ISSO É A DECISÃO
 * ────────────────────────────────────────────────────────────────────────────
 * A camada mais rápida anda 18% da rolagem. Parallax exagerado envelhece
 * rápido, embrulha o estômago de quem tem sensibilidade vestibular e, em
 * celular, disputa main thread com a própria rolagem — o efeito colateral é a
 * página parecer travada justamente no aparelho mais fraco.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * COMO ELE NÃO ATRAPALHA
 * ────────────────────────────────────────────────────────────────────────────
 *  - O listener é `passive`. Sem isso o navegador precisa esperar para saber
 *    se haverá `preventDefault`, e a rolagem engasga.
 *  - A escrita acontece dentro de um `requestAnimationFrame`, no máximo uma
 *    por quadro, mesmo que o evento dispare dez vezes.
 *  - O que muda é UMA variável CSS lida por `translate3d` — composição pura,
 *    sem layout e sem paint.
 *  - Quando o herói sai da tela, o cálculo para. Não faz sentido mover o que
 *    ninguém vê.
 *  - Sob `prefers-reduced-motion`, **nada disso é instalado**: nem listener,
 *    nem observer, nem `will-change`. O CSS zera o `transform` das camadas.
 *
 * O conteúdo do herói NÃO se move: só o fundo. Texto em parallax é o que torna
 * o efeito enjoativo e prejudica a leitura.
 */
export function Hero({
  fundo,
  children,
  className,
}: {
  /** Camadas de fundo. Cada uma define `--profundidade` (0 = parada). */
  fundo: ReactNode
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const elemento = ref.current
    if (!elemento) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let quadro = 0
    let visivel = true

    const atualizar = () => {
      quadro = 0
      const y = window.scrollY
      // Trava no ponto em que o herói já saiu: além disso, o número só cresce
      // e as camadas continuariam sendo empurradas sem necessidade.
      const limite = Math.min(y, elemento.offsetHeight)
      elemento.style.setProperty('--deslocamento', `${limite}px`)
    }

    const aoRolar = () => {
      if (!visivel || quadro) return
      quadro = requestAnimationFrame(atualizar)
    }

    const observador = new IntersectionObserver(([entrada]) => {
      visivel = entrada?.isIntersecting ?? false
    })
    observador.observe(elemento)

    window.addEventListener('scroll', aoRolar, { passive: true })
    atualizar()

    return () => {
      window.removeEventListener('scroll', aoRolar)
      observador.disconnect()
      if (quadro) cancelAnimationFrame(quadro)
    }
  }, [])

  return (
    <section ref={ref} className={cn('relative isolate overflow-hidden', className)}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        {fundo}
      </div>
      {children}
    </section>
  )
}

/**
 * Uma camada do fundo.
 *
 * `profundidade` é a fração da rolagem que ela acompanha. 0 fica parada; 0.18
 * é o teto usado no projeto. Camada mais distante = número menor, porque na
 * vida real o que está longe se move menos.
 */
export function CamadaHero({
  profundidade,
  children,
  className,
}: {
  profundidade: number
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('camada-parallax absolute inset-x-0', className)}
      style={{ '--profundidade': profundidade } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
