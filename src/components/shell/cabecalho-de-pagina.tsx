import type { ReactNode } from 'react'

import { Divisor } from '@/components/marca/grafismos'
import { cn } from '@/lib/ui/cn'

/**
 * Cabeçalho das páginas internas.
 *
 * A curva de nível entra aqui — e é UMA das duas ocorrências permitidas por
 * página (ver `components/marca/grafismos.tsx`). Como toda página interna usa
 * este componente, a contagem fica sob controle por construção: sobra
 * exatamente uma para a página gastar onde quiser.
 */
export function CabecalhoDePagina({
  sobretitulo,
  titulo,
  descricao,
  cota,
  acao,
  className,
}: {
  sobretitulo?: string
  titulo: string
  descricao?: string
  /** Número que acompanha a curva. Some quando não faz sentido. */
  cota?: string
  acao?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('secao-areia relative', className)}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 pt-12 pb-16 sm:px-8 sm:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            {sobretitulo && (
              <p className="text-caqui-ink-700 text-rotulo font-mono uppercase">{sobretitulo}</p>
            )}
            <h1 className="text-display-l mt-2 uppercase">{titulo}</h1>
            {descricao && <p className="text-caqui-ink-700 text-corpo-lg mt-4">{descricao}</p>}
          </div>
          {acao}
        </div>
      </div>

      {/* Encosta na base da faixa de areia, fazendo a transição para o branco. */}
      <div className="absolute inset-x-0 bottom-0 translate-y-1/2">
        {cota ? <Divisor cota={cota} /> : <Divisor />}
      </div>
    </header>
  )
}
