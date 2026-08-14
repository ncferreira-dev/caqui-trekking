import type { ReactNode } from 'react'

import { IconeAlerta } from '@/components/crm/icones'
import { cn } from '@/lib/ui/cn'

/**
 * As peças do painel.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DENSO NÃO É APERTADO
 * ────────────────────────────────────────────────────────────────────────────
 * O painel usa o mesmo sistema da loja — mesma fonte, mesma paleta, mesmo
 * chanfro — com o respiro reduzido e sem nada que se mova. O que ele NÃO faz é
 * encolher alvo de toque: os botões continuam com 44px de altura mínima,
 * porque a Caqui opera isto com o polegar, em pé, no meio do dia.
 *
 * Densidade aqui significa menos margem e mais linha visível por tela. Nunca
 * significa alvo menor.
 */

export function CabecalhoDeSecao({
  titulo,
  descricao,
  acao,
}: {
  titulo: string
  descricao?: string
  acao?: ReactNode
}) {
  return (
    <div className="border-caqui-ink-900 mb-4 flex flex-wrap items-end justify-between gap-3 border-b pb-3">
      <div>
        <h1 className="text-display-m uppercase">{titulo}</h1>
        {descricao && <p className="text-caqui-ink-700 text-corpo-sm mt-1">{descricao}</p>}
      </div>
      {acao}
    </div>
  )
}

/** Bloco de conteúdo. Sem sombra: numa tela densa, sombra vira sujeira. */
export function Painel({
  titulo,
  acao,
  children,
  className,
}: {
  titulo?: string
  acao?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('border-caqui-rule border bg-white', className)}>
      {titulo && (
        <div className="border-caqui-rule flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <h2 className="font-display text-corpo-sm uppercase">{titulo}</h2>
          {acao}
        </div>
      )}
      {children}
    </section>
  )
}

/**
 * Aviso do painel.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ALERTA SINALIZA, NÃO ACUSA
 * ────────────────────────────────────────────────────────────────────────────
 * "Saída em 3 dias ainda como vagas abertas" pode ser a verdade — sobrou vaga
 * mesmo — ou esquecimento. Quem sabe é a pessoa que guia. Por isso o texto
 * descreve o fato e oferece o caminho, em vez de afirmar erro. Um painel que
 * grita errado duas vezes vira um painel que ninguém lê.
 */
export function Aviso({
  tom = 'atencao',
  titulo,
  children,
}: {
  tom?: 'atencao' | 'erro' | 'neutro'
  titulo: string
  children?: ReactNode
}) {
  const tons = {
    // ink-900 sobre orange-500 = 6,16:1
    atencao: 'border-caqui-orange-500 bg-caqui-sand-100',
    erro: 'border-caqui-danger bg-caqui-sand-100',
    neutro: 'border-caqui-rule-forte bg-caqui-sand-100',
  } as const

  return (
    <div
      className={cn('border-l-4 px-3 py-2', tons[tom])}
      role={tom === 'erro' ? 'alert' : 'status'}
    >
      <p className="font-display text-corpo-sm flex items-center gap-1.5 uppercase">
        <IconeAlerta className="size-3.5" />
        {titulo}
      </p>
      {children && <div className="text-corpo-sm mt-1">{children}</div>}
    </div>
  )
}

export function Vazio({
  titulo,
  children,
  acao,
}: {
  titulo: string
  children?: ReactNode
  acao?: ReactNode
}) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="font-display text-corpo uppercase">{titulo}</p>
      {children && (
        <div className="text-caqui-ink-700 text-corpo-sm mx-auto mt-2 max-w-sm">{children}</div>
      )}
      {acao && <div className="mt-4 flex justify-center">{acao}</div>}
    </div>
  )
}

/** Rótulo curto de dado. O painel inteiro usa mono para número e estado. */
export function Rotulo({ children }: { children: ReactNode }) {
  return <span className="text-caqui-ink-500 text-micro font-mono uppercase">{children}</span>
}
