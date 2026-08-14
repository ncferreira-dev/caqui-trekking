import Link from 'next/link'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/ui/cn'

/**
 * Botão.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O RÓTULO DO BOTÃO LARANJA É PRETO, NÃO BRANCO
 * ────────────────────────────────────────────────────────────────────────────
 * O reflexo automático é texto branco sobre o laranja da marca. Medido, isso
 * dá 3,15:1 — REPROVA no AA (mínimo 4,5:1 para texto normal). Seria um botão
 * principal ilegível para quem tem baixa visão, no elemento mais importante
 * da página.
 *
 * Preto sobre o mesmo laranja dá 6,16:1 e passa com folga. E, por acaso feliz,
 * é exatamente como se serigrafa fita de equipamento outdoor — e é a própria
 * logo da Caqui, onde as montanhas pretas se recortam contra o sol laranja.
 * Quando a restrição de acessibilidade e a identidade apontam para a mesma
 * resposta, a decisão está pronta.
 */

type Variante = 'primary' | 'secondary' | 'ghost' | 'danger'
type Tamanho = 'sm' | 'md' | 'lg'

const BASE = [
  'relative inline-flex items-center justify-center gap-2',
  'font-display uppercase tracking-tight',
  'border border-caqui-ink-900 rounded-xs',
  // O anel branco do foco precisa vir por `ring` e não pela `box-shadow` da
  // camada base: `shadow-[...]` abaixo substituiria aquela regra inteira, e o
  // anel sumiria — invisível em fundo claro, fatal em fundo escuro.
  // `ring` tem slot próprio na box-shadow e compõe com a sombra.
  'focus-visible:ring-2 focus-visible:ring-white',
  'transition-[transform,box-shadow,background-color] duration-150 ease-[var(--ease-padrao)]',
  'disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:translate-none',
  // O deslocamento sólido some no clique: a peça "encosta" no papel. É o
  // feedback tátil que substitui a sombra difusa que cresce no hover.
  'active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
].join(' ')

const VARIANTES: Record<Variante, string> = {
  primary: cn(
    'bg-caqui-orange-500 text-caqui-ink-900',
    'shadow-[var(--shadow-corte-2)]',
    'hover:bg-caqui-orange-600 hover:not-disabled:-translate-x-px hover:not-disabled:-translate-y-px',
    'hover:not-disabled:shadow-[var(--shadow-corte-3)]',
  ),
  secondary: cn(
    'bg-white text-caqui-ink-900',
    'shadow-[var(--shadow-corte-1)]',
    'hover:not-disabled:bg-caqui-sand-100 hover:not-disabled:shadow-[var(--shadow-corte-2)]',
    'hover:not-disabled:-translate-x-px hover:not-disabled:-translate-y-px',
  ),
  // Sem borda e sem sombra, mas mantém a área de toque. O sublinhado é o que
  // sinaliza que é acionável quando não há caixa.
  ghost: cn(
    'border-transparent bg-transparent text-caqui-ink-900',
    'underline decoration-caqui-orange-500 decoration-2 underline-offset-4',
    'hover:not-disabled:bg-caqui-sand-100 hover:not-disabled:decoration-caqui-ink-900',
  ),
  danger: cn(
    'bg-caqui-danger text-white',
    'shadow-[var(--shadow-corte-2)]',
    'hover:not-disabled:-translate-x-px hover:not-disabled:-translate-y-px',
    'hover:not-disabled:shadow-[var(--shadow-corte-3)]',
  ),
}

/**
 * Alturas mínimas de 44px em `md` e `lg`: é o alvo de toque recomendado, e o
 * CRM inteiro é operado do celular, com uma mão, no meio da trilha.
 */
const TAMANHOS: Record<Tamanho, string> = {
  sm: 'min-h-9 px-3 text-[0.8125rem] gap-1.5',
  md: 'min-h-11 px-5 text-sm',
  lg: 'min-h-13 px-7 text-base',
}

/**
 * As classes do botão, sem o botão.
 *
 * Existe para o `LinkBotao` abaixo — e NÃO existe um `asChild` que troque a
 * tag renderizada. Um `<button>` que às vezes é `<a>` é a origem mais comum de
 * navegação quebrada: `<a>` responde a Enter e ao clique do meio, `<button>`
 * responde a Enter e Espaço; um sem `href` some da lista de links do leitor de
 * tela. Quem navega precisa saber se aquilo LEVA a algum lugar ou FAZ alguma
 * coisa, e a resposta tem que estar no HTML.
 *
 * Então: dois componentes, duas tags, aparência compartilhada.
 */
export function classesDeBotao({
  variante = 'primary',
  tamanho = 'md',
  bloco = false,
  className,
}: {
  variante?: Variante
  tamanho?: Tamanho
  bloco?: boolean
  className?: string
} = {}): string {
  return cn(BASE, VARIANTES[variante], TAMANHOS[tamanho], bloco && 'w-full', className)
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante
  tamanho?: Tamanho
  /** Ocupa a largura toda. Padrão em drawer e em card de produto. */
  bloco?: boolean
  carregando?: boolean
  children: ReactNode
}

export function Button({
  variante = 'primary',
  tamanho = 'md',
  bloco = false,
  carregando = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      // `aria-busy` em vez de trocar o rótulo por "Carregando…": leitor de
      // tela anuncia o estado sem perder o nome acessível do botão.
      aria-busy={carregando || undefined}
      // `||` e não `??`.
      //
      // `??` só cai no fallback quando o valor é `null`/`undefined`. Quem
      // escrevesse `disabled={!consentimento}` com a caixa marcada passava
      // `false` — e `false ?? carregando` é `false`. O atributo `disabled`
      // NUNCA era aplicado durante o envio, e `carregando` virava puramente
      // cosmético: spinner girando com o botão clicável, um POST por clique.
      disabled={disabled || carregando}
      className={cn(BASE, VARIANTES[variante], TAMANHOS[tamanho], bloco && 'w-full', className)}
      {...props}
    >
      {carregando && <Girando />}
      <span className={cn(carregando && 'opacity-70')}>{children}</span>
    </button>
  )
}

/**
 * O botão com cara de botão, que É um link.
 *
 * Use quando a ação LEVA a outra página. Envolve `next/link` por fora:
 * `<LinkBotao href="/agenda">Ver a agenda</LinkBotao>`.
 */
export function LinkBotao({
  href,
  variante,
  tamanho,
  bloco,
  className,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
  variante?: Variante
  tamanho?: Tamanho
  bloco?: boolean
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      className={classesDeBotao({
        ...(variante ? { variante } : {}),
        ...(tamanho ? { tamanho } : {}),
        ...(bloco ? { bloco } : {}),
        ...(className ? { className } : {}),
      })}
      {...props}
    >
      <span>{children}</span>
    </Link>
  )
}

function Girando() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4 motion-safe:animate-spin"
      aria-hidden="true"
      fill="none"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2.5" />
      <path
        d="M8 1.5A6.5 6.5 0 0 1 14.5 8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="square"
      />
    </svg>
  )
}
