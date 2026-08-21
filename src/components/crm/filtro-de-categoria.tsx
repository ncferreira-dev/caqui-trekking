'use client'

import { useRouter } from 'next/navigation'

import { CATEGORIAS_DA_PECA } from '@/lib/crm/categorias'
import { cn } from '@/lib/ui/cn'

/**
 * O seletor de categoria da tela de peças.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A ESCOLHA VIVE NO ENDEREÇO, NÃO NO ESTADO DO COMPONENTE
 * ────────────────────────────────────────────────────────────────────────────
 * `?categoria=CAMISETA` sobrevive ao recarregar, ao voltar e ao link mandado
 * para alguém. Guardado em `useState`, o filtro sumiria a cada `router.refresh`
 * — e esta tela faz um refresh a cada toque de "esgotada", que é a operação
 * mais repetida dela. A pessoa filtraria por camiseta, marcaria uma esgotada e
 * veria a lista inteira voltar.
 *
 * É a mesma decisão da agenda do site e da vista de saídas.
 */

export function FiltroDeCategoria({
  categoria,
  contagem,
}: {
  /** Vazio = todas. */
  categoria: string
  /** Quantas peças em cada categoria, para o rótulo dizer antes de clicar. */
  contagem: Record<string, number>
}) {
  const router = useRouter()

  const total = Object.values(contagem).reduce((a, b) => a + b, 0)

  return (
    <label className="flex items-center gap-2">
      <span className="text-caqui-ink-500 text-micro font-mono uppercase">Categoria</span>
      <select
        value={categoria}
        onChange={(e) => {
          const valor = e.target.value
          router.push(valor === '' ? '/crm/produtos' : `/crm/produtos?categoria=${valor}`)
        }}
        className={cn(
          'border-caqui-ink-900 text-corpo-sm min-h-11 rounded-xs border bg-white px-3',
          'focus:outline-caqui-orange-500 focus:outline-2',
        )}
      >
        <option value="">Todas ({total})</option>
        {CATEGORIAS_DA_PECA.map((c) => (
          <option key={c.valor} value={c.valor}>
            {c.rotulo} ({contagem[c.valor] ?? 0})
          </option>
        ))}
      </select>
    </label>
  )
}
