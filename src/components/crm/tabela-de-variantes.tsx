'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Rotulo } from '@/components/crm/pecas'
import { useToast } from '@/components/ui/toast'
import { api, ErroDaApi } from '@/lib/crm/api'
import { formatarBRL } from '@/lib/money'
import { cn } from '@/lib/ui/cn'

/**
 * A grade de variantes, com disponibilidade em um toque.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * É O MESMO GESTO DA DISPONIBILIDADE DA SAÍDA, NA LOJA
 * ────────────────────────────────────────────────────────────────────────────
 * Acabou o "M preto"? Um toque na linha. Sem abrir produto, sem formulário,
 * sem salvar. É o campo que muda toda semana, e o único que a Caqui vai mexer
 * na Wear no dia a dia — preço e descrição mudam uma vez por temporada.
 *
 * O reflexo é uma tabela com checkbox e um botão "Salvar" embaixo. Isso cria
 * um estado intermediário — marcado na tela, não salvo no banco — e alguém vai
 * fechar a aba achando que salvou. Aqui cada toque é a operação inteira.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O ROTULO DIZ O QUE VAI ACONTECER, NÃO O ESTADO ATUAL
 * ────────────────────────────────────────────────────────────────────────────
 * Um botão escrito "Disponível" é ambíguo: é o estado ou a ação? Aqui o estado
 * está na coluna à esquerda, em texto, e o botão diz o verbo — "Marcar
 * esgotado" / "Voltar a vender". Quem lê sabe o que o toque faz antes de tocar.
 */

export type VarianteDoPainel = {
  id: number
  tamanho: string
  cor: string
  corHex: string | null
  precoProprioCentavos: number | null
  disponivel: boolean
}

export function TabelaDeVariantes({
  variantes,
  precoBaseCentavos,
}: {
  variantes: VarianteDoPainel[]
  precoBaseCentavos: number
}) {
  const router = useRouter()
  const { mostrar } = useToast()

  const [otimista, setOtimista] = useState<Record<number, boolean>>({})
  const [ocupadas, setOcupadas] = useState<Record<number, boolean>>({})

  async function alternar(v: VarianteDoPainel) {
    const atual = otimista[v.id] ?? v.disponivel
    if (ocupadas[v.id]) return

    setOtimista((s) => ({ ...s, [v.id]: !atual }))
    setOcupadas((s) => ({ ...s, [v.id]: true }))

    try {
      await api.patch(`/api/admin/variants/${v.id}`, { disponivel: !atual })
      router.refresh()
    } catch (causa) {
      // Volta atrás: a tela dizendo "esgotado" com a loja vendendo é o
      // cenário exato que este botão existe para evitar.
      setOtimista((s) => ({ ...s, [v.id]: atual }))
      mostrar({
        tom: 'erro',
        titulo: 'Não mudou',
        descricao: causa instanceof ErroDaApi ? causa.message : 'A variante continua como estava.',
      })
    } finally {
      setOcupadas((s) => ({ ...s, [v.id]: false }))
    }
  }

  if (variantes.length === 0) {
    return (
      <p className="text-caqui-ink-500 text-corpo-sm px-4 py-3">
        Este produto não tem variante cadastrada, então não aparece como comprável na loja.
      </p>
    )
  }

  return (
    <ul className="divide-caqui-rule divide-y">
      {variantes.map((v) => {
        const disponivel = otimista[v.id] ?? v.disponivel
        const ocupada = ocupadas[v.id] ?? false

        return (
          <li
            key={v.id}
            className={cn(
              'relative flex flex-wrap items-center gap-3 px-4 py-2.5',
              !disponivel && 'bg-caqui-sand-100',
            )}
          >
            {!disponivel && (
              <span className="trama-indisponivel absolute inset-0" aria-hidden="true" />
            )}

            <span
              aria-hidden="true"
              className="border-caqui-ink-900 relative block size-4 shrink-0 rounded-xs border"
              style={v.corHex ? { backgroundColor: v.corHex } : undefined}
            />

            <span className="text-corpo-sm relative">
              {v.tamanho === 'UNICO' ? 'Único' : v.tamanho} · {v.cor}
            </span>

            {/* Preço próprio só aparece quando existe: repetir o preço base em
                toda linha esconderia justamente a variante que foge dele. */}
            {v.precoProprioCentavos !== null && v.precoProprioCentavos !== precoBaseCentavos && (
              <span className="relative">
                <Rotulo>preço próprio {formatarBRL(v.precoProprioCentavos)}</Rotulo>
              </span>
            )}

            <span
              className={cn(
                'text-micro relative ml-auto font-mono uppercase',
                disponivel ? 'text-caqui-forest-800' : 'text-caqui-danger',
              )}
            >
              {disponivel ? 'À venda' : 'Esgotada'}
            </span>

            <button
              type="button"
              onClick={() => alternar(v)}
              disabled={ocupada}
              className={cn(
                'text-micro relative min-h-11 rounded-xs border px-3 font-mono uppercase',
                'transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                'border-caqui-ink-900 hover:bg-caqui-sand-100 bg-white',
              )}
            >
              {disponivel ? 'Marcar esgotada' : 'Voltar a vender'}
              <span className="sr-only">
                {' '}
                — {v.tamanho === 'UNICO' ? 'tamanho único' : v.tamanho}, {v.cor}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
