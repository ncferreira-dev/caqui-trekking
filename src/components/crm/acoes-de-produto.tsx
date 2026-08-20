'use client'

import { useState } from 'react'

import { EditorDeProduto, type ProdutoParaEditar } from '@/components/crm/editor-de-produto'
import { LinkBotao } from '@/components/ui/button'

/**
 * Os botões da peça.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CADASTRAR É PÁGINA. EDITAR É MODAL.
 * ────────────────────────────────────────────────────────────────────────────
 * Os dois eram o mesmo modal até 20/08/2026. A divisão veio do projeto de
 * referência, a pedido do cliente, e ela se sustenta sozinha: cadastrar é uma
 * sessão de trabalho — nome, descrição, foto, uma grade de variantes — e um
 * modal aperta tudo isso numa caixa com rolagem própria. Editar é ajuste
 * pontual, e tirar a pessoa da lista para isso seria pior.
 */

export function BotaoCadastrarProduto() {
  // Link, não botão com estado: o cadastro tem endereço próprio, então ele
  // sobrevive ao recarregar, ao voltar e ao ser mandado por mensagem.
  return <LinkBotao href="/crm/produtos/nova">+ Cadastrar peça</LinkBotao>
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
      {aberto && (
        <EditorDeProduto aberto={aberto} aoFechar={() => setAberto(false)} produto={produto} />
      )}
    </>
  )
}
