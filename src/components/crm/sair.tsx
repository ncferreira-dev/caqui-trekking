'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { IconeSair } from '@/components/crm/icones'
import { cn } from '@/lib/ui/cn'

/**
 * Sair.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O LOGOUT ACONTECE NO SERVIDOR
 * ────────────────────────────────────────────────────────────────────────────
 * `POST /api/auth/logout` incrementa o `tokenVersion` do usuário no banco. Isso
 * invalida TODA sessão daquele token — inclusive a que ficou aberta no
 * computador de casa, ou no celular que foi roubado. Apagar o cookie só
 * limparia este navegador, e o token continuaria válido até expirar.
 *
 * Depois, `router.refresh()` antes do `push`: sem ele, o Next pode servir a
 * árvore de servidor que já tinha em cache e o painel reaparece por um quadro,
 * já sem dado, antes de a navegação acontecer.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SEM DUPLO ENVIO
 * ────────────────────────────────────────────────────────────────────────────
 * `saindo` desabilita o botão na hora. Dois POSTs de logout não quebram nada
 * aqui — o segundo é idempotente — mas o padrão vale para o painel inteiro, e
 * este é o botão mais fácil de clicar duas vezes: a resposta demora e nada
 * muda na tela até ela chegar.
 */
export function BotaoSair({ nome, className }: { nome: string; className?: string }) {
  const [saindo, setSaindo] = useState(false)
  const router = useRouter()

  async function sair() {
    if (saindo) return
    setSaindo(true)

    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Falhou a rede? Vai para o login mesmo assim. Deixar a pessoa presa
      // num painel que ela pediu para sair é pior que uma sessão que ainda
      // vale no servidor — e a próxima requisição vai levar 401 de qualquer
      // jeito se o cookie tiver caído.
    }

    router.refresh()
    router.push('/crm')
  }

  return (
    <button
      type="button"
      onClick={sair}
      disabled={saindo}
      className={cn(
        'text-caqui-ink-500 hover:text-caqui-danger text-micro inline-flex items-center gap-1.5',
        'rounded-xs px-2 py-1.5 font-mono uppercase transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      <IconeSair />
      {saindo ? 'Saindo…' : 'Sair'}
      <span className="sr-only"> da conta de {nome}</span>
    </button>
  )
}
