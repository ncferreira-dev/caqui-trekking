'use client'

import { useState } from 'react'

import { EditorDeProduto, type ProdutoParaEditar } from '@/components/crm/editor-de-produto'
import { Button } from '@/components/ui/button'

/**
 * Os botões que abrem o editor de peça.
 *
 * Dois pontos de entrada, o mesmo formulário: "Cadastrar peça" no topo da tela
 * (sem produto) e "Editar" no cabeçalho de cada peça (com o produto). Ficam num
 * componente cliente fino para a página de produtos continuar sendo servidor —
 * ela só busca dados e desenha a grade.
 */

export function BotaoCadastrarProduto() {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <Button onClick={() => setAberto(true)}>+ Cadastrar peça</Button>
      {aberto && <EditorDeProduto aberto={aberto} aoFechar={() => setAberto(false)} />}
    </>
  )
}

export function BotaoEditarProduto({ produto }: { produto: ProdutoParaEditar }) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-caqui-ink-700 hover:text-caqui-ink-900 text-micro rounded-xs font-mono uppercase underline underline-offset-4"
      >
        Editar
      </button>
      {aberto && <EditorDeProduto aberto={aberto} aoFechar={() => setAberto(false)} produto={produto} />}
    </>
  )
}
