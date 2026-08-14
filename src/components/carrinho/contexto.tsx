'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/**
 * O estado de "a mochila está aberta?" e os dados do WhatsApp.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE O NÚMERO E O TEMPLATE VIAJAM POR AQUI
 * ────────────────────────────────────────────────────────────────────────────
 * Os dois vêm do banco, editáveis no CRM. Quem os busca é o layout da loja, um
 * componente de SERVIDOR que já os pede para o rodapé — então eles chegam de
 * graça, sem uma segunda requisição.
 *
 * A alternativa seria o drawer buscar `/api/settings` sozinho na montagem:
 * uma requisição a mais em toda visita, e um estado de carregamento no botão
 * mais importante do site.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O CONTEXTO NÃO GUARDA O CARRINHO
 * ────────────────────────────────────────────────────────────────────────────
 * Os itens continuam em `useCarrinho()`, que lê o `localStorage` por
 * `useSyncExternalStore`. Duplicar isso aqui criaria duas fontes de verdade
 * para o mesmo dado, e a de dentro do React ficaria desatualizada assim que
 * outra aba mexesse no storage.
 */

type Mochila = {
  aberta: boolean
  abrir: () => void
  fechar: () => void
  /** E.164 sem `+`, como o banco guarda. `null` desliga o handoff. */
  whatsapp: string | null
  /** Template com `{{itens}}` e `{{total}}`, vindo do CRM. */
  template: string | null
}

const Contexto = createContext<Mochila | null>(null)

export function useMochila(): Mochila {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('useMochila precisa estar dentro de <ProvedorDaMochila>.')
  return contexto
}

export function ProvedorDaMochila({
  whatsapp,
  template,
  children,
}: {
  whatsapp: string | null
  template: string | null
  children: ReactNode
}) {
  const [aberta, setAberta] = useState(false)

  const abrir = useCallback(() => setAberta(true), [])
  const fechar = useCallback(() => setAberta(false), [])

  const valor = useMemo(
    () => ({ aberta, abrir, fechar, whatsapp, template }),
    [aberta, abrir, fechar, whatsapp, template],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}
