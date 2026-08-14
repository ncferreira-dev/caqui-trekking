import Link from 'next/link'

import { cn } from '@/lib/ui/cn'
import { ROTULO_CATEGORIA } from '@/server/services/product-service'

/**
 * O filtro de categoria da Caqui Wear.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SÃO LINKS, NÃO UM `<select>` — E NÃO É INCOERÊNCIA COM A AGENDA
 * ────────────────────────────────────────────────────────────────────────────
 * A agenda tem QUATRO filtros que se combinam, então lá um formulário com
 * botão "Aplicar" evita três recargas para uma escolha. Aqui é UM filtro, com
 * cinco opções no máximo, e mutuamente exclusivo: cada opção é um destino, e
 * destino é link.
 *
 * O ganho é concreto: `/wear?categoria=CAMISETA` fica no histórico, é
 * compartilhável e indexável, e a escolha atual é visível de relance em vez de
 * escondida dentro de uma caixa fechada. Zero JavaScript, como a agenda.
 *
 * `aria-current="page"` e não só a cor: o estado selecionado precisa chegar a
 * quem navega por teclado e por leitor de tela, e o contraste sozinho nunca faz
 * isso.
 */
export function FiltroDeCategoria({
  categorias,
  atual,
  total,
}: {
  categorias: { valor: string; total: number }[]
  atual: string | undefined
  total: number
}) {
  if (categorias.length < 2) return null

  return (
    <nav aria-label="Filtrar por categoria" className="border-caqui-rule-wear border-y">
      <ul className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-5 py-4 sm:px-8">
        <Opcao href="/wear" ativo={atual === undefined} rotulo="Tudo" total={total} />
        {categorias.map((c) => (
          <Opcao
            key={c.valor}
            href={`/wear?categoria=${c.valor}`}
            ativo={atual === c.valor}
            rotulo={ROTULO_CATEGORIA[c.valor] ?? c.valor}
            total={c.total}
          />
        ))}
      </ul>
    </nav>
  )
}

function Opcao({
  href,
  ativo,
  rotulo,
  total,
}: {
  href: string
  ativo: boolean
  rotulo: string
  total: number
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={ativo ? 'page' : undefined}
        className={cn(
          'text-rotulo inline-flex items-center gap-1.5 rounded-xs border px-3 py-2 font-mono uppercase',
          'transition-colors',
          ativo
            ? // branco sobre forest-800 = 11,08:1
              'border-caqui-forest-800 bg-caqui-forest-800 text-white'
            : // forest-800 sobre sand-100 = 9,84:1
              'border-caqui-rule-wear text-caqui-forest-800 hover:border-caqui-forest-800 bg-white',
        )}
      >
        {rotulo}
        <span className={cn('text-micro', ativo ? 'text-white/70' : 'text-caqui-ink-500')}>
          {total}
        </span>
      </Link>
    </li>
  )
}
