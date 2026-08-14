'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * O carrinho vive no `localStorage`. E guarda o MÍNIMO.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUE NÃO ENTRA AQUI: PREÇO, NOME, DISPONIBILIDADE
 * ────────────────────────────────────────────────────────────────────────────
 * Só referência e quantidade. É a mesma regra que governa
 * `POST /api/cart/validate` desde o PROMPT 03, e o motivo é duplo:
 *
 *  1. **Nada que o cliente guarda pode virar valor.** Um carrinho com
 *     `precoCentavos` dentro é um campo editável no DevTools. O servidor
 *     recalcula tudo a partir do id, sempre.
 *  2. **Dado guardado envelhece.** Um carrinho aberto na terça com "R$ 90,00"
 *     e "Vagas abertas" mostraria isso na quinta, mesmo depois de a saída
 *     lotar. Guardando só o id, a tela é montada com o estado de agora.
 *
 * O formato aqui é exatamente o que a rota de revalidação espera — é o mesmo
 * `itemCarrinhoSchema` de `lib/api/schemas.ts`. Divergir seria criar tradução
 * entre duas formas do mesmo dado.
 *
 * O carrinho completo — revalidação, drawer, handoff para o WhatsApp — é o
 * PROMPT 09. Aqui está o mínimo de que o contador do header precisa, na forma
 * definitiva, para não haver migração depois.
 */

export type ItemCarrinho =
  | { lineId: string; tipo: 'DEPARTURE'; departureId: number; quantidade: number }
  | { lineId: string; tipo: 'WEAR'; variantId: number; quantidade: number }

/**
 * A versão está na CHAVE, não dentro do valor.
 *
 * Mudar o formato vira uma chave nova, e o carrinho antigo simplesmente deixa
 * de ser lido — em vez de ser lido errado. Um `JSON.parse` de formato antigo
 * caindo num `.map` que espera campo novo derruba a página inteira do lado do
 * cliente, e ninguém vê isso em teste porque em teste o storage está vazio.
 */
const CHAVE = 'caqui:carrinho:v1'

/** Avisa outras instâncias do hook NA MESMA aba. O `storage` só cruza abas. */
const EVENTO = 'caqui:carrinho'

function ler(): ItemCarrinho[] {
  if (typeof window === 'undefined') return []

  try {
    const cru = window.localStorage.getItem(CHAVE)
    if (!cru) return []

    const dados: unknown = JSON.parse(cru)
    if (!Array.isArray(dados)) return []

    // Validação de forma na leitura. `localStorage` é entrada não confiável:
    // o usuário pode editá-lo, e uma extensão ou uma versão antiga do site
    // pode ter escrito lixo ali.
    return dados.filter(ehItemValido)
  } catch {
    // JSON quebrado ou storage bloqueado (modo privado em alguns navegadores).
    // Carrinho vazio é degradação aceitável; página quebrada não é.
    return []
  }
}

function ehItemValido(valor: unknown): valor is ItemCarrinho {
  if (typeof valor !== 'object' || valor === null) return false
  const item = valor as Record<string, unknown>

  if (typeof item['lineId'] !== 'string' || item['lineId'].length === 0) return false
  if (typeof item['quantidade'] !== 'number' || !Number.isInteger(item['quantidade'])) return false
  if (item['quantidade'] < 1) return false

  if (item['tipo'] === 'DEPARTURE') return Number.isInteger(item['departureId'])
  if (item['tipo'] === 'WEAR') return Number.isInteger(item['variantId'])
  return false
}

function gravar(itens: ItemCarrinho[]): void {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(itens))
  } catch {
    // Cota estourada ou storage bloqueado. O carrinho da sessão continua
    // funcionando em memória; só não sobrevive ao recarregamento.
  }
  window.dispatchEvent(new CustomEvent(EVENTO))
}

export type Carrinho = {
  itens: ItemCarrinho[]
  quantidadeTotal: number
  /**
   * `false` no HTML do servidor, `true` depois da hidratação.
   *
   * O servidor não tem `localStorage`, então o HTML sai sempre com carrinho
   * vazio. Quem mostra quantidade espera por isto — senão o contador nasce em
   * zero e pisca para o número real.
   */
  pronto: boolean
  adicionar: (item: ItemCarrinho) => void
  alterarQuantidade: (lineId: string, quantidade: number) => void
  remover: (lineId: string) => void
  limpar: () => void
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * O CARRINHO É UM STORE EXTERNO, E O HOOK CERTO É `useSyncExternalStore`
 * ─────────────────────────────────────────────────────────────────────────────
 * O reflexo é `useState` + `useEffect` lendo o storage na montagem. Além de o
 * React desaconselhar (`setState` síncrono dentro de efeito dispara render em
 * cascata), esse padrão não resolve o problema real: o `localStorage` muda por
 * fora do React — em outra aba, ou em outro componente desta mesma página.
 *
 * `useSyncExternalStore` foi feito exatamente para isto, e resolve de brinde o
 * caso do servidor: `getServerSnapshot` devolve vazio, `getSnapshot` devolve o
 * real, e o React faz a troca na hidratação sem acusar divergência.
 *
 * A pegadinha é que `getSnapshot` PRECISA devolver a mesma referência quando o
 * dado não mudou — senão o React re-renderiza para sempre. Daí o cache abaixo,
 * chaveado pela string crua do storage.
 */
const VAZIO: ItemCarrinho[] = []

let cacheCru: string | null = null
let cacheItens: ItemCarrinho[] = VAZIO

function snapshot(): ItemCarrinho[] {
  let cru: string | null = null
  try {
    cru = window.localStorage.getItem(CHAVE)
  } catch {
    return VAZIO
  }

  // Mesma string crua ⇒ mesma referência de volta. É o contrato do hook.
  if (cru !== cacheCru) {
    cacheCru = cru
    cacheItens = ler()
  }
  return cacheItens
}

function snapshotDoServidor(): ItemCarrinho[] {
  return VAZIO
}

function assinar(aoMudar: () => void): () => void {
  // `storage` dispara em OUTRAS abas; o customizado, nesta.
  window.addEventListener('storage', aoMudar)
  window.addEventListener(EVENTO, aoMudar)
  return () => {
    window.removeEventListener('storage', aoMudar)
    window.removeEventListener(EVENTO, aoMudar)
  }
}

/** Assinatura vazia: só serve para diferenciar servidor de cliente. */
const SEM_ASSINATURA = () => () => {}

export function useCarrinho(): Carrinho {
  const itens = useSyncExternalStore(assinar, snapshot, snapshotDoServidor)

  // `false` no HTML do servidor, `true` depois da hidratação. Sem efeito e
  // sem `setState` — é o mesmo mecanismo, usado para uma pergunta booleana.
  const pronto = useSyncExternalStore(
    SEM_ASSINATURA,
    () => true,
    () => false,
  )

  const adicionar = useCallback((novo: ItemCarrinho) => {
    const atuais = ler()
    const existente = atuais.find((i) => i.lineId === novo.lineId)

    // Adicionar o mesmo item soma quantidade em vez de criar uma segunda
    // linha. Duas linhas do mesmo tamanho da mesma camiseta viram uma
    // mensagem confusa no WhatsApp.
    const proximos = existente
      ? atuais.map((i) =>
          i.lineId === novo.lineId ? { ...i, quantidade: i.quantidade + novo.quantidade } : i,
        )
      : [...atuais, novo]

    // Sem `setState`: `gravar` dispara o evento, e o `useSyncExternalStore`
    // re-renderiza TODAS as instâncias do hook — inclusive a do header.
    gravar(proximos)
  }, [])

  const alterarQuantidade = useCallback((lineId: string, quantidade: number) => {
    const proximos =
      quantidade < 1
        ? ler().filter((i) => i.lineId !== lineId)
        : ler().map((i) => (i.lineId === lineId ? { ...i, quantidade } : i))

    // Sem `setState`: `gravar` dispara o evento, e o `useSyncExternalStore`
    // re-renderiza TODAS as instâncias do hook — inclusive a do header.
    gravar(proximos)
  }, [])

  const remover = useCallback((lineId: string) => {
    const proximos = ler().filter((i) => i.lineId !== lineId)
    // Sem `setState`: `gravar` dispara o evento, e o `useSyncExternalStore`
    // re-renderiza TODAS as instâncias do hook — inclusive a do header.
    gravar(proximos)
  }, [])

  const limpar = useCallback(() => {
    gravar([])
  }, [])

  return {
    itens,
    quantidadeTotal: itens.reduce((soma, i) => soma + i.quantidade, 0),
    pronto,
    adicionar,
    alterarQuantidade,
    remover,
    limpar,
  }
}

/** Monta o `lineId` de forma estável: mesmo item, mesma linha. */
export function lineIdDeSaida(departureId: number): string {
  return `d:${departureId}`
}

export function lineIdDeVariante(variantId: number): string {
  return `v:${variantId}`
}
