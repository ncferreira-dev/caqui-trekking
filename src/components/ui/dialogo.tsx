'use client'

import { type ReactNode, useCallback, useEffect, useRef } from 'react'

import { cn } from '@/lib/ui/cn'

/**
 * Modal e Drawer, os dois sobre o `<dialog>` NATIVO.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE `<dialog>` E NÃO UMA DIV COM PORTAL
 * ────────────────────────────────────────────────────────────────────────────
 * `showModal()` entrega de graça quatro coisas que, feitas à mão, somam ~200
 * linhas e são a origem clássica de bug de acessibilidade:
 *
 *   1. Armadilha de foco — Tab não escapa para a página atrás.
 *   2. Escape fecha, sem listener nenhum.
 *   3. Camada superior real (`top-layer`): nada de `z-index: 9999` disputando
 *      com o header fixo.
 *   4. `inert` implícito no resto do documento — o leitor de tela não lê o
 *      conteúdo de trás.
 *
 * O que sobra para nós: devolver o foco ao gatilho ao fechar, travar a rolagem
 * do corpo, e fechar no clique fora. São três coisas, e estão aqui embaixo.
 */

type DialogoBaseProps = {
  aberto: boolean
  aoFechar: () => void
  titulo: string
  children: ReactNode
  /** Esconde o título visualmente, mantendo-o para leitor de tela. */
  tituloOculto?: boolean
  className?: string
}

function useDialogoNativo(aberto: boolean, aoFechar: () => void) {
  const ref = useRef<HTMLDialogElement>(null)
  const gatilhoAnterior = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return

    if (aberto && !dialogo.open) {
      // Guarda quem abriu, para devolver o foco no fechamento. Sem isso, o
      // teclado volta para o começo do documento e a pessoa perde o lugar.
      gatilhoAnterior.current = document.activeElement as HTMLElement | null
      dialogo.showModal()

      // A rolagem do corpo continua ativa atrás de um `<dialog>` aberto —
      // esta é a única parte que o nativo não cobre.
      const larguraBarra = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      // Compensa a barra de rolagem para o conteúdo não pular lateralmente.
      if (larguraBarra > 0) document.body.style.paddingRight = `${larguraBarra}px`
    }

    if (!aberto && dialogo.open) {
      dialogo.close()
    }
  }, [aberto, aoFechar])

  useEffect(() => {
    if (aberto) return
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
    gatilhoAnterior.current?.focus()
  }, [aberto])

  // Limpeza se o componente desmontar aberto.
  useEffect(() => {
    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [])

  // `cancel` cobre o Escape, que fecha o diálogo por fora do React.
  const aoCancelar = useCallback(
    (evento: React.SyntheticEvent<HTMLDialogElement>) => {
      evento.preventDefault()
      aoFechar()
    },
    [aoFechar],
  )

  /** Clique no `::backdrop` chega como clique no próprio `<dialog>`. */
  const aoClicar = useCallback(
    (evento: React.MouseEvent<HTMLDialogElement>) => {
      if (evento.target === ref.current) aoFechar()
    },
    [aoFechar],
  )

  return { ref, aoCancelar, aoClicar }
}

function BotaoFechar({ aoFechar, rotulo }: { aoFechar: () => void; rotulo: string }) {
  return (
    <button
      type="button"
      onClick={aoFechar}
      aria-label={rotulo}
      className={cn(
        'text-caqui-ink-900 -mr-1 inline-flex size-9 shrink-0 items-center justify-center',
        'hover:bg-caqui-sand-100 rounded-xs transition-colors',
      )}
    >
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
        <path
          d="M2.5 2.5l11 11M13.5 2.5l-11 11"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="square"
        />
      </svg>
    </button>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────

export function Modal({
  aberto,
  aoFechar,
  titulo,
  tituloOculto,
  children,
  rodape,
  className,
}: DialogoBaseProps & { rodape?: ReactNode }) {
  const { ref, aoCancelar, aoClicar } = useDialogoNativo(aberto, aoFechar)

  return (
    <dialog
      ref={ref}
      onCancel={aoCancelar}
      onClick={aoClicar}
      aria-labelledby="titulo-modal"
      className={cn(
        'm-auto w-[min(34rem,calc(100vw-2rem))] p-0',
        'border-caqui-ink-900 rounded-sm border bg-white',
        'shadow-[var(--shadow-flutuante)]',
        'motion-safe:open:animate-[caqui-entrada_180ms_var(--ease-saida)]',
        className,
      )}
    >
      <div className="border-caqui-rule flex items-start gap-4 border-b px-5 py-4">
        <h2
          id="titulo-modal"
          className={cn('text-display-s flex-1 uppercase', tituloOculto && 'sr-only')}
        >
          {titulo}
        </h2>
        <BotaoFechar aoFechar={aoFechar} rotulo="Fechar" />
      </div>

      <div className="px-5 py-5">{children}</div>

      {rodape && (
        <div className="border-caqui-rule bg-caqui-sand-100 flex justify-end gap-3 border-t px-5 py-4">
          {rodape}
        </div>
      )}
    </dialog>
  )
}

// ─── Drawer ──────────────────────────────────────────────────────────────────

/**
 * Painel lateral. É o carrinho — "sua mochila", no vocabulário da Caqui.
 *
 * Em telas estreitas ocupa a largura toda: um drawer de 80% em 360px deixa uma
 * faixa inútil de 72px e ainda dá margem para fechar sem querer.
 */
export function Drawer({
  aberto,
  aoFechar,
  titulo,
  tituloOculto,
  children,
  rodape,
  className,
}: DialogoBaseProps & { rodape?: ReactNode }) {
  const { ref, aoCancelar, aoClicar } = useDialogoNativo(aberto, aoFechar)

  return (
    <dialog
      ref={ref}
      onCancel={aoCancelar}
      onClick={aoClicar}
      aria-labelledby="titulo-drawer"
      className={cn(
        'mt-0 mr-0 mb-0 ml-auto h-full max-h-none w-[min(26rem,100vw)] max-w-none p-0',
        'border-caqui-ink-900 border-l bg-white',
        'shadow-[var(--shadow-flutuante)]',
        'motion-safe:open:animate-[caqui-drawer_200ms_var(--ease-saida)]',
        className,
      )}
    >
      <div className="flex h-full flex-col">
        <div className="border-caqui-ink-900 flex items-start gap-4 border-b px-5 py-4">
          <h2
            id="titulo-drawer"
            className={cn('text-display-s flex-1 uppercase', tituloOculto && 'sr-only')}
          >
            {titulo}
          </h2>
          <BotaoFechar aoFechar={aoFechar} rotulo="Fechar" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {rodape && (
          <div className="border-caqui-ink-900 bg-caqui-sand-100 border-t px-5 py-4">{rodape}</div>
        )}
      </div>
    </dialog>
  )
}
