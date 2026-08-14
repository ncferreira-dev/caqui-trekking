import type { ReactNode } from 'react'

import { cn } from '@/lib/ui/cn'

/**
 * Card.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O CANTO CORTADO É A PEÇA INTEIRA
 * ────────────────────────────────────────────────────────────────────────────
 * Um retângulo de canto 8px com sombra difusa é o card de qualquer
 * marketplace. Trocar a sombra por um deslocamento sólido preto e o raio por
 * 3px não resolve — só troca o template de SaaS pelo template neobrutalista,
 * que é o segundo visual mais genérico que existe.
 *
 * O que dá identidade é a SILHUETA. O brasão da Caqui é um hexágono; cortar o
 * canto superior direito é a menor citação possível dessa geometria, e faz a
 * peça parecer uma etiqueta recortada em vez de uma caixa.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE A PROFUNDIDADE É UM ELEMENTO, NÃO UM `box-shadow`
 * ────────────────────────────────────────────────────────────────────────────
 * `clip-path` recorta tudo que sai do elemento — inclusive a sombra. Um
 * `box-shadow` num card chanfrado simplesmente não aparece.
 *
 * Então a camada de baixo é um elemento de verdade, com o MESMO recorte,
 * deslocado. Além de funcionar, é mais honesto com a linguagem: a profundidade
 * aqui é impressão fora de registro, não luz difusa.
 */

export type CardProps = {
  children: ReactNode
  /** Reage ao mouse. Use quando o card inteiro é um link. */
  interativo?: boolean
  /** Some com o corte e com a camada de baixo. Para listas muito densas. */
  plano?: boolean
  className?: string
}

export function Card({ children, interativo = false, plano = false, className }: CardProps) {
  return (
    <article className={cn('group relative', className)}>
      {!plano && (
        <span
          aria-hidden="true"
          className={cn(
            'chanfro-md bg-caqui-ink-900 absolute inset-0 translate-x-1 translate-y-1',
            'transition-transform duration-150 ease-[var(--ease-padrao)]',
            interativo && 'group-hover:translate-x-1.5 group-hover:translate-y-1.5',
          )}
        />
      )}

      <div
        className={cn(
          'border-caqui-ink-900 relative flex h-full flex-col border bg-white',
          !plano && 'chanfro-md',
          plano && 'border-caqui-rule rounded-xs',
          'transition-transform duration-150 ease-[var(--ease-padrao)]',
          interativo && !plano && 'group-hover:-translate-x-0.5 group-hover:-translate-y-0.5',
        )}
      >
        {children}
      </div>
    </article>
  )
}

/**
 * Faixa de mídia do card.
 *
 * `aspect-[4/3]` fixo e `overflow-hidden`: a proporção é reservada antes de a
 * imagem chegar, então a lista não pula quando as fotos carregam. É o mesmo
 * motivo de `width`/`height` serem obrigatórios em `MediaAsset` — ver
 * docs/05-midia.md.
 */
export function CardMidia({
  children,
  proporcao = 'paisagem',
  className,
}: {
  children: ReactNode
  proporcao?: 'paisagem' | 'retrato' | 'quadrado'
  className?: string
}) {
  const proporcoes = {
    paisagem: 'aspect-[4/3]',
    retrato: 'aspect-[3/4]',
    quadrado: 'aspect-square',
  } as const

  return (
    <div
      className={cn(
        'bg-caqui-sand-100 relative overflow-hidden',
        'border-caqui-ink-900 border-b',
        proporcoes[proporcao],
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardCorpo({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-1 flex-col gap-3 p-4 sm:p-5', className)}>{children}</div>
}

/**
 * Rodapé do card. Fica na base mesmo quando os cards da linha têm títulos de
 * alturas diferentes — daí o `mt-auto` no corpo.
 */
export function CardRodape({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'border-caqui-rule mt-auto flex items-center justify-between gap-3 border-t p-4 sm:p-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Ficha técnica — a camada de dados.
 *
 * Rótulo em mono espacejado, valor em mono tabular. Como a largura do dígito é
 * fixa, as colunas de km / metros / duração alinham verticalmente entre cards
 * DIFERENTES da mesma lista, sem tabela e sem largura fixa. É o que faz uma
 * grade de 9 expedições parecer uma carta topográfica e não um feed.
 */
export function Ficha({
  itens,
  className,
}: {
  itens: { rotulo: string; valor: string; unidade?: string }[]
  className?: string
}) {
  return (
    <dl className={cn('border-caqui-rule grid grid-cols-3 border-y', className)}>
      {itens.map((item, i) => (
        <div
          key={item.rotulo}
          className={cn(
            'px-3 py-2.5',
            // Grade de 3 colunas: a borda esquerda é de toda célula MENOS a
            // primeira de cada linha (i % 3 === 0), não só a primeira de todas.
            // Com `i > 0` a primeira coluna da 2ª linha ganhava uma borda solta.
            i % 3 !== 0 && 'border-caqui-rule border-l',
            i > 2 && 'border-caqui-rule border-t',
          )}
        >
          <dt className="text-caqui-ink-500 text-micro font-mono uppercase">{item.rotulo}</dt>
          <dd className="text-caqui-ink-900 text-dado mt-0.5 font-mono font-medium">
            {item.valor}
            {item.unidade && (
              <span className="text-caqui-ink-500 text-micro ml-0.5 font-normal">
                {item.unidade}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
