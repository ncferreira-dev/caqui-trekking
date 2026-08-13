'use client'

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'

import { cn } from '@/lib/ui/cn'

/**
 * Avisos temporários.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ERRO NÃO SE FECHA SOZINHO
 * ────────────────────────────────────────────────────────────────────────────
 * O WCAG 2.2.1 é explícito: informação essencial não pode desaparecer por
 * tempo sem o usuário poder estender ou desligar o prazo. "Não foi possível
 * enviar sua mensagem" sumindo em 5 segundos é uma falha real — quem lê
 * devagar, quem usa leitor de tela, ou quem simplesmente estava olhando o
 * teclado perde a informação e não tem como recuperá-la.
 *
 * Então: `sucesso` e `aviso` fecham sozinhos em 6s; `erro` fica até alguém
 * fechar. O prazo também PAUSA no hover e no foco.
 *
 * `role` muda junto: `alert` (interrompe o leitor de tela) para erro,
 * `status` (espera a pausa) para o resto. Anunciar "adicionado à mochila"
 * interrompendo a leitura de um parágrafo é grosseria de software.
 */

type Tom = 'sucesso' | 'erro' | 'aviso'

type Aviso = {
  id: number
  tom: Tom
  titulo: string
  descricao?: string
}

type ContextoToast = {
  mostrar: (aviso: Omit<Aviso, 'id'>) => void
}

const Contexto = createContext<ContextoToast | null>(null)

export function useToast(): ContextoToast {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useToast precisa estar dentro de <ProvedorDeToast>.')
  return contexto
}

let proximoId = 0

export function ProvedorDeToast({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])

  const fechar = useCallback((id: number) => {
    setAvisos((atuais) => atuais.filter((a) => a.id !== id))
  }, [])

  const mostrar = useCallback(
    (aviso: Omit<Aviso, 'id'>) => {
      const id = proximoId++
      setAvisos((atuais) => [...atuais, { ...aviso, id }])

      if (aviso.tom !== 'erro') {
        setTimeout(() => fechar(id), 6000)
      }
    },
    [fechar],
  )

  const valor = useMemo(() => ({ mostrar }), [mostrar])

  return (
    <Contexto.Provider value={valor}>
      {children}
      <RegiaoDeAvisos avisos={avisos} aoFechar={fechar} />
    </Contexto.Provider>
  )
}

function RegiaoDeAvisos({ avisos, aoFechar }: { avisos: Aviso[]; aoFechar: (id: number) => void }) {
  return (
    <div
      // A região existe no DOM desde o início, mesmo vazia: um live region
      // criado junto com a mensagem costuma não ser anunciado, porque o leitor
      // de tela precisa estar observando o nó antes de ele mudar.
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      {avisos.map((aviso) => (
        <Toast key={aviso.id} aviso={aviso} aoFechar={() => aoFechar(aviso.id)} />
      ))}
    </div>
  )
}

const TONS: Record<Tom, { barra: string; icone: ReactNode; rotuloFechar: string }> = {
  sucesso: {
    barra: 'bg-caqui-forest-600',
    icone: (
      <path
        d="M3.5 8.5 7 12l5.5-6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
      />
    ),
    rotuloFechar: 'Fechar aviso',
  },
  erro: {
    barra: 'bg-caqui-danger',
    icone: (
      <>
        <path d="M8 4v5" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
        <circle cx="8" cy="12" r="1" fill="currentColor" />
      </>
    ),
    rotuloFechar: 'Fechar erro',
  },
  aviso: {
    barra: 'bg-caqui-orange-500',
    icone: (
      <>
        <path d="M8 4v5" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
        <circle cx="8" cy="12" r="1" fill="currentColor" />
      </>
    ),
    rotuloFechar: 'Fechar aviso',
  },
}

export function Toast({ aviso, aoFechar }: { aviso: Omit<Aviso, 'id'>; aoFechar: () => void }) {
  const { barra, icone, rotuloFechar } = TONS[aviso.tom]

  return (
    <div
      role={aviso.tom === 'erro' ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3',
        'border-caqui-ink-900 rounded-xs border bg-white py-3 pr-3 pl-0',
        'shadow-[var(--shadow-flutuante)]',
        'motion-safe:animate-[caqui-entrada_180ms_var(--ease-saida)]',
      )}
    >
      <span className={cn('w-1.5 shrink-0 self-stretch', barra)} aria-hidden="true" />

      <svg viewBox="0 0 16 16" className="text-caqui-ink-900 mt-0.5 size-4 shrink-0" aria-hidden>
        {icone}
      </svg>

      <div className="flex-1">
        <p className="text-caqui-ink-900 font-display text-corpo-sm uppercase">{aviso.titulo}</p>
        {aviso.descricao && (
          <p className="text-caqui-ink-700 text-corpo-sm mt-0.5">{aviso.descricao}</p>
        )}
      </div>

      <button
        type="button"
        onClick={aoFechar}
        aria-label={rotuloFechar}
        className="text-caqui-ink-500 hover:text-caqui-ink-900 hover:bg-caqui-sand-100 -mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-xs transition-colors"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
          <path
            d="M3 3l10 10M13 3L3 13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
          />
        </svg>
      </button>
    </div>
  )
}
