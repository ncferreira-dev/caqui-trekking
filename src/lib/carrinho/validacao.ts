'use client'

import { useCallback, useEffect, useState } from 'react'

import type { ItemCarrinho } from '@/lib/carrinho/store'
import type { ResultadoValidacao } from '@/server/services/cart-service'

/**
 * A revalidação da mochila contra o servidor.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE ELA ACONTECE TODA VEZ QUE A MOCHILA ABRE
 * ────────────────────────────────────────────────────────────────────────────
 * O carrinho vive no `localStorage` e pode ficar semanas parado. Nesse tempo a
 * saída acontece, esgota, ou muda de preço — e a variante sai de linha. Sem
 * revalidar, a pessoa manda no WhatsApp um pedido que a Caqui vai ter que
 * desdizer.
 *
 * É também o que preenche a tela: o `localStorage` guarda só `id` e
 * `quantidade`, então NOME, PREÇO e DATA de cada linha vêm desta chamada. Não
 * é uma verificação opcional em cima de um carrinho já desenhado — sem ela não
 * há o que desenhar.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UM ESTADO SÓ, CARIMBADO COM A PERGUNTA QUE ELE RESPONDE
 * ────────────────────────────────────────────────────────────────────────────
 * O reflexo é `useState` para resultado, outro para `carregando` e outro para
 * `erro`, com o efeito zerando os três a cada mudança. O React Compiler recusa
 * — com razão: `setState` síncrono no corpo de um efeito dispara renderização
 * em cascata, e o padrão esconde o defeito real, que é ter três estados para
 * uma informação só.
 *
 * Aqui existe UM estado, e ele carrega a `chave` da pergunta que respondeu.
 * "Está carregando?" vira uma comparação — a chave guardada é diferente da
 * chave atual — em vez de um booleano que alguém precisa lembrar de virar. É
 * impossível ficar preso em "carregando" para sempre, e é impossível mostrar o
 * resultado de um carrinho antigo.
 */

export type EstadoDaValidacao = {
  resultado: ResultadoValidacao | null
  carregando: boolean
  /** Mensagem para a tela. `null` quando deu certo. */
  erro: string | null
  revalidar: () => void
}

type Resposta = {
  /** A assinatura + tentativa que gerou esta resposta. */
  chave: string
  dados: ResultadoValidacao | null
  erro: string | null
}

/** O que o servidor precisa saber. Preço NÃO vai — ele é quem sabe o preço. */
function assinatura(itens: readonly ItemCarrinho[]): string {
  return JSON.stringify(
    itens.map((i) =>
      i.tipo === 'DEPARTURE'
        ? { t: 'd', id: i.departureId, q: i.quantidade }
        : { t: 'v', id: i.variantId, q: i.quantidade },
    ),
  )
}

export function useValidacao(itens: readonly ItemCarrinho[], ativo: boolean): EstadoDaValidacao {
  const [resposta, setResposta] = useState<Resposta | null>(null)
  const [tentativa, setTentativa] = useState(0)

  const revalidar = useCallback(() => setTentativa((n) => n + 1), [])

  const vazia = itens.length === 0
  const corpo = assinatura(itens)
  const chave = `${tentativa}|${corpo}`

  /**
   * Revalida quando a aba volta a ficar visível.
   *
   * O botão "Finalizar" é um `<a href>` de verdade, com o link já montado — e
   * precisa ser, porque construir a URL depois de um `await` faria o navegador
   * tratar a abertura como pop-up e bloquear. O preço do link, então, é o da
   * última validação.
   *
   * Uma aba esquecida aberta a tarde inteira teria esse preço envelhecendo na
   * tela. Voltar para a aba é exatamente o momento em que a pessoa vai
   * finalizar, e é onde a conferência tem que acontecer.
   */
  useEffect(() => {
    if (!ativo || vazia) return

    const aoVoltar = () => {
      if (document.visibilityState === 'visible') setTentativa((n) => n + 1)
    }

    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [ativo, vazia])

  useEffect(() => {
    if (!ativo || vazia) return

    // `AbortController`: trocar a quantidade três vezes seguidas dispara três
    // requisições, e sem isto a resposta da PRIMEIRA pode chegar por último e
    // sobrescrever a tela com um estado antigo. A `chave` guardada junto já
    // protegeria disso, mas abortar economiza a conexão.
    const controlador = new AbortController()

    fetch('/api/cart/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itens: paraEnvio(corpo) }),
      signal: controlador.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status))
        const json: unknown = await r.json()
        return (json as { data: ResultadoValidacao }).data
      })
      .then((dados) => setResposta({ chave, dados, erro: null }))
      .catch((causa: unknown) => {
        if (causa instanceof DOMException && causa.name === 'AbortError') return
        // Sem detalhe técnico na tela: a pessoa não pode agir sobre um 500.
        // O que ela pode fazer é tentar de novo, e é isso que a tela oferece.
        setResposta({
          chave,
          dados: null,
          erro: 'Não foi possível conferir sua mochila agora.',
        })
      })

    return () => controlador.abort()
  }, [chave, corpo, ativo, vazia])

  // Tudo daqui para baixo é DERIVADO. Nenhum `setState` fora dos callbacks
  // assíncronos acima.
  const atual = resposta?.chave === chave ? resposta : null

  return {
    resultado: atual?.dados ?? null,
    carregando: ativo && !vazia && atual === null,
    erro: atual?.erro ?? null,
    revalidar,
  }
}

/**
 * Reconstrói o corpo da requisição a partir da assinatura.
 *
 * Parece um rodeio, e é deliberado: a assinatura é a dependência do efeito,
 * então derivar o corpo dela garante que o que foi enviado é exatamente o que
 * disparou o envio. Montar o corpo a partir de `itens` abriria a possibilidade
 * de os dois divergirem num render intermediário.
 *
 * O `lineId` é remontado com o mesmo formato de `lineIdDeSaida` e
 * `lineIdDeVariante` — é a chave que a resposta usa para casar cada linha com o
 * item do storage na hora de mudar quantidade ou remover.
 */
function paraEnvio(corpo: string) {
  const cru = JSON.parse(corpo) as { t: 'd' | 'v'; id: number; q: number }[]

  return cru.map((i) =>
    i.t === 'd'
      ? { lineId: `d:${i.id}`, tipo: 'DEPARTURE' as const, departureId: i.id, quantidade: i.q }
      : { lineId: `v:${i.id}`, tipo: 'WEAR' as const, variantId: i.id, quantidade: i.q },
  )
}
