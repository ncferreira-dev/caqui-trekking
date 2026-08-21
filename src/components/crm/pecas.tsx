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

/**
 * Bloco de conteúdo. Sem sombra: numa tela densa, sombra vira sujeira.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * `dobravel` USA `<details>`, E NÃO UM `useState`
 * ────────────────────────────────────────────────────────────────────────────
 * Pedido de 21/08/2026, sobre a tela de trilhas: "toda vez que entro tenho que
 * fechar todas as trilhas, uma por uma". Cada trilha ocupava um cartão inteiro,
 * inclusive as sem data no mês.
 *
 * `<details>` é a mesma escolha já feita no rodapé de `lista-de-saidas.tsx`, e
 * pelos mesmos motivos: o navegador guarda o estado, funciona antes da
 * hidratação, e o conteúdo fechado continua no DOM — busca da página (⌘F) e
 * leitor de tela acham o que está dentro. Um `useState` daria um cartão que
 * pisca fechado depois de renderizar aberto.
 *
 * O RESUMO PRECISA BASTAR. Cartão fechado que não diz nada obriga a abrir tudo
 * de novo, e aí o dobrável só atrapalhou: quem chama passa em `resumo` o que a
 * pessoa precisa ver sem abrir.
 */
export function Painel({
  titulo,
  acao,
  children,
  className,
  dobravel = false,
  resumo,
  abertoPorPadrao = false,
}: {
  titulo?: string
  acao?: ReactNode
  children: ReactNode
  className?: string
  /** Fecha o corpo atrás de um clique no título. Exige `titulo`. */
  dobravel?: boolean
  /** O que aparece no cabeçalho mesmo fechado. Só faz sentido com `dobravel`. */
  resumo?: ReactNode
  abertoPorPadrao?: boolean
}) {
  if (dobravel && titulo) {
    return (
      <details
        open={abertoPorPadrao}
        className={cn('border-caqui-rule group border bg-white', className)}
      >
        <summary
          className={cn(
            'border-caqui-rule flex cursor-pointer flex-wrap items-center justify-between gap-3',
            'hover:bg-caqui-sand-100 min-h-11 px-4 py-2.5 transition-colors',
            // O triângulo nativo sai, porque ele vem antes de tudo e quebra o
            // alinhamento do cabeçalho. O substituto está no `<span>` abaixo.
            'list-none [&::-webkit-details-marker]:hidden',
            // A borda de baixo só existe quando está aberto: fechado, ela
            // desenharia um risco solto embaixo de um cartão de uma linha.
            'group-open:border-b',
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {/* O substituto do triângulo nativo: gira ao abrir e herda a cor
              do texto. `aria-hidden` porque o `<details>` já anuncia o estado
              expandido para o leitor de tela; a seta seria eco. */}
            <span
              aria-hidden="true"
              className="text-caqui-ink-500 shrink-0 transition-transform group-open:rotate-90"
            >
              ▸
            </span>
            <span className="font-display text-corpo-sm truncate uppercase">{titulo}</span>
            {resumo}
          </span>
          {acao}
        </summary>
        {children}
      </details>
    )
  }

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
