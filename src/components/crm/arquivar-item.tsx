'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Confirmar } from '@/components/crm/confirmar'
import { useToast } from '@/components/ui/toast'
import { api } from '@/lib/crm/api'

/**
 * Arquivar roteiro ou peça.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A ROTA DO ROTEIRO EXISTIA E NÃO TINHA BOTÃO. A DA PEÇA NÃO EXISTIA
 * ────────────────────────────────────────────────────────────────────────────
 * Dava para esconder os dois pondo em rascunho, e era o que sobrava. Só que
 * rascunho significa "ainda não está pronto", não "não vendemos mais isto": a
 * peça descontinuada ficava para sempre no meio da tela de quem opera, com a
 * mesma cara de algo que vai ser publicado semana que vem.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O TEXTO DIZ O QUE ARQUIVAR **NÃO** FAZ
 * ────────────────────────────────────────────────────────────────────────────
 * É soft delete: a linha fica, as saídas e as variantes continuam apontando
 * para ela, e o histórico não se reescreve. Quem lê "arquivar" pensa em
 * "apagar", hesita, e não faz. Dizer o que sobrevive é o que destrava a
 * decisão — e é verdade, que é o requisito.
 */
export function ArquivarItem({
  colecao,
  id,
  nome,
  consequencia,
  children,
}: {
  colecao: 'trips' | 'products'
  id: number
  nome: string
  /** O que muda no site. Obrigatório: arquivar sem consequência escrita é cego. */
  consequencia: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const { mostrar } = useToast()
  const [aberto, setAberto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-caqui-ink-500 hover:text-caqui-danger text-micro min-h-11 rounded-xs font-mono uppercase underline underline-offset-4"
      >
        Arquivar
      </button>

      {aberto && (
        <Confirmar
          aberto
          aoFechar={() => setAberto(false)}
          titulo={`Arquivar ${nome}?`}
          rotuloConfirmar="Arquivar"
          consequencia={consequencia}
          aoConfirmar={async () => {
            await api.delete(`/api/admin/${colecao}/${id}`)
            mostrar({ tom: 'sucesso', titulo: 'Arquivado' })
            router.refresh()
          }}
        >
          {children}
        </Confirmar>
      )}
    </>
  )
}
