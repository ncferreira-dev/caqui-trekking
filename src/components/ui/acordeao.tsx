import type { ReactNode } from 'react'

import { cn } from '@/lib/ui/cn'

/**
 * Acordeão sobre `<details>` / `<summary>` nativos.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ZERO JAVASCRIPT, E ISSO NÃO É ECONOMIA — É CORREÇÃO
 * ────────────────────────────────────────────────────────────────────────────
 * O nativo já é focável, opera por Enter e Espaço, anuncia estado expandido ao
 * leitor de tela, e — o que quase nenhuma implementação em JS acerta — é
 * encontrável pelo Ctrl+F do navegador, que abre a seção fechada para mostrar
 * o resultado. Numa página de expedição com "o que levar", "política de
 * cancelamento" e "perguntas frequentes", isso é a diferença entre o conteúdo
 * existir e não existir para quem procura.
 *
 * O atributo `name` compartilhado dá o comportamento exclusivo (abrir um fecha
 * o outro) sem uma linha de estado.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A ALTURA NÃO É ANIMADA
 * ────────────────────────────────────────────────────────────────────────────
 * Animar `height` ou `grid-template-rows` força recálculo de layout a cada
 * frame, e numa lista de 8 itens em celular isso engasga de forma visível. O
 * que se move é só o indicador (transform) e a opacidade do conteúdo — ambos
 * compostos pela GPU.
 */

export function Acordeao({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('border-caqui-rule border-y', className)}>{children}</div>
}

export function AcordeaoItem({
  titulo,
  children,
  /** Compartilhe o mesmo nome entre itens para abrir um fechar o outro. */
  grupo,
  abertoPorPadrao = false,
  className,
}: {
  titulo: string
  children: ReactNode
  grupo?: string
  abertoPorPadrao?: boolean
  className?: string
}) {
  return (
    <details
      name={grupo}
      open={abertoPorPadrao}
      className={cn('group border-caqui-rule border-b last:border-b-0', className)}
    >
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center justify-between gap-4 py-4',
          'text-caqui-ink-900 font-display text-display-s uppercase',
          // O hover NÃO clareia o título. Trocar ink-900 (19,44:1) por laranja
          // seria trocar contraste por brilho justamente no elemento que
          // carrega o texto. Quem responde ao mouse é o indicador — e ali o
          // laranja é legítimo: como objeto gráfico, o mínimo do WCAG 1.4.11
          // é 3:1, e #E04E12 sobre branco dá 3,99:1.
          //
          // `stroke-*` e não `text-*`: o alvo é o traço do SVG, e a
          // propriedade correta descreve melhor a intenção do que apelar para
          // `currentColor`.
          '[&:hover_svg_path]:stroke-caqui-orange-600 transition-colors',
          // Remove o triângulo padrão no WebKit.
          '[&::-webkit-details-marker]:hidden',
        )}
      >
        {titulo}
        <Indicador />
      </summary>

      <div
        className={cn(
          'text-caqui-ink-700 text-corpo pb-5',
          'motion-safe:group-open:animate-[caqui-entrada_180ms_var(--ease-saida)]',
        )}
      >
        {children}
      </div>
    </details>
  )
}

/** Cruz que vira traço. Gira só a barra vertical — 1 propriedade animada. */
function Indicador() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-hidden="true">
      <path d="M1 8h14" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
      <path
        d="M8 1v14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
        className="origin-center transition-transform duration-200 group-open:rotate-90 group-open:opacity-0"
      />
    </svg>
  )
}
