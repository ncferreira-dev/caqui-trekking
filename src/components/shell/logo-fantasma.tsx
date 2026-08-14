'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { Brasao } from '@/components/marca/grafismos'
import { cn } from '@/lib/ui/cn'

/**
 * A logo, e o gesto que revela o CRM.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ISTO NÃO É AUTENTICAÇÃO. NÃO CHEGA PERTO.
 * ════════════════════════════════════════════════════════════════════════════
 * O gesto apenas REVELA um link. Digitar `/crm` na barra de endereço leva ao
 * mesmo lugar, e é assim que tem que ser: a barreira real é o middleware do
 * backend, aplicado rota a rota, com um teste que percorre o diretório e falha
 * se alguma rota administrativa nascer sem guard (ver docs/04-permissoes.md).
 *
 * O projeto de referência ilustra o oposto melhor do que qualquer argumento:
 * escondia o botão do painel atrás de 5 cliques no copyright e, ao mesmo
 * tempo, listava `/login`, `/dashboard`, `/clients` e `/admin/` no
 * `robots.txt` — público, para qualquer um ler.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * A ARMADILHA: A LOGO É UM LINK
 * ════════════════════════════════════════════════════════════════════════════
 * Se cada toque navegasse, o componente desmontaria no primeiro e a contagem
 * morreria junto — de `/agenda`, seria impossível chegar a 5. Duas medidas
 * resolvem:
 *
 *  1. **A contagem vive no `sessionStorage`**, não em memória. Sobrevive à
 *     navegação do primeiro toque.
 *  2. **Do segundo toque em diante, a navegação é cancelada.** O primeiro
 *     toque continua fazendo o que qualquer pessoa espera de uma logo: ir para
 *     a home. Os seguintes são engolidos, e a página não pisca.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * A JANELA É DE OCIOSIDADE, NÃO DE DURAÇÃO TOTAL
 * ════════════════════════════════════════════════════════════════════════════
 * O briefing pede "5 toques em até 3 segundos" e "contador zera após 3s
 * parado". Implementei a segunda: o que zera é a PAUSA entre toques. Cinco
 * toques rápidos levam menos de um segundo de qualquer jeito, então a regra
 * mais permissiva satisfaz as duas — e o briefing é explícito sobre o gesto
 * não ser frustrante de acertar.
 */

const CHAVE_CONTAGEM = 'caqui:toques'
const CHAVE_REVELADO = 'caqui:crm-revelado'

const TOQUES_NECESSARIOS = 5
/** A partir daqui a logo dá sinal de vida. Antes disso, nada acontece. */
const TOQUES_ATE_FEEDBACK = 3
const JANELA_MS = 3000

type Contagem = { total: number; ultimoToque: number }

function lerContagem(): Contagem {
  try {
    const cru = sessionStorage.getItem(CHAVE_CONTAGEM)
    if (!cru) return { total: 0, ultimoToque: 0 }
    const dados = JSON.parse(cru) as Partial<Contagem>
    if (typeof dados.total !== 'number' || typeof dados.ultimoToque !== 'number') {
      return { total: 0, ultimoToque: 0 }
    }
    return { total: dados.total, ultimoToque: dados.ultimoToque }
  } catch {
    return { total: 0, ultimoToque: 0 }
  }
}

function gravarContagem(contagem: Contagem): void {
  try {
    sessionStorage.setItem(CHAVE_CONTAGEM, JSON.stringify(contagem))
  } catch {
    // Storage bloqueado. O gesto para de funcionar; o CRM continua acessível
    // pela URL. Degradação aceitável para um atalho.
  }
}

/**
 * O "revelado" também é estado EXTERNO — mora no `sessionStorage`, sobrevive à
 * navegação e pode ser ligado por outra instância deste componente. Ler isso
 * num `useEffect` com `setState` seria render em cascata; `useSyncExternalStore`
 * é o mecanismo que o React oferece exatamente para o caso. Mesma decisão do
 * carrinho — ver `lib/carrinho/store.ts`.
 */
const EVENTO_REVELADO = 'caqui:crm-revelado'

function assinarRevelado(aoMudar: () => void): () => void {
  window.addEventListener(EVENTO_REVELADO, aoMudar)
  return () => window.removeEventListener(EVENTO_REVELADO, aoMudar)
}

function lerRevelado(): boolean {
  try {
    return sessionStorage.getItem(CHAVE_REVELADO) === '1'
  } catch {
    return false
  }
}

const NUNCA_REVELADO = () => false

export function LogoFantasma({
  className,
  aoRevelar,
}: {
  className?: string
  /** Chamado uma vez, quando o gesto completa. */
  aoRevelar?: () => void
}) {
  const [toques, setToques] = useState(0)
  const revelado = useSyncExternalStore(assinarRevelado, lerRevelado, NUNCA_REVELADO)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  // A contagem NÃO é restaurada na montagem, de propósito: ela já vive no
  // `sessionStorage` e `registrarToque` a lê a cada toque. Depois de uma
  // navegação, o próximo toque continua de onde parou — só o pulso reaparece
  // um toque mais tarde, o que ninguém percebe.
  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current)
    }
  }, [])

  const registrarToque = useCallback(() => {
    const agora = Date.now()
    const anterior = lerContagem()

    const total = agora - anterior.ultimoToque > JANELA_MS ? 1 : anterior.total + 1

    gravarContagem({ total, ultimoToque: agora })
    setToques(total)

    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => {
      gravarContagem({ total: 0, ultimoToque: 0 })
      setToques(0)
    }, JANELA_MS)

    if (total >= TOQUES_NECESSARIOS) {
      try {
        sessionStorage.setItem(CHAVE_REVELADO, '1')
      } catch {
        // Sem persistência: o gesto não sobrevive à navegação, mas o link
        // aparece nesta tela porque o evento abaixo é disparado do mesmo jeito.
      }
      window.dispatchEvent(new CustomEvent(EVENTO_REVELADO))
      gravarContagem({ total: 0, ultimoToque: 0 })
      setToques(0)
      aoRevelar?.()
    }
  }, [aoRevelar])

  /**
   * `onPointerDown` e não `onClick`: dispara antes da navegação, então o toque
   * é contabilizado mesmo quando o link leva a página embora.
   */
  const aoApontar = useCallback(() => registrarToque(), [registrarToque])

  const aoClicar = useCallback((evento: React.MouseEvent) => {
    // A contagem já subiu no `pointerdown`. Se este é o 2º ou seguinte da
    // sequência, engole a navegação: o primeiro já levou para a home.
    if (lerContagem().total > 1) evento.preventDefault()
  }, [])

  const pulsando = toques >= TOQUES_ATE_FEEDBACK && toques < TOQUES_NECESSARIOS

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Link
        href="/"
        onPointerDown={aoApontar}
        onClick={aoClicar}
        aria-label="Caqui Trekking — ir para a página inicial"
        className={cn(
          'relative block shrink-0 rounded-xs',
          'transition-transform duration-150',
          // O pulso é `transform` e `opacity` apenas — nada que force layout.
          pulsando && 'motion-safe:animate-[caqui-pulso-logo_600ms_ease-in-out_infinite]',
        )}
      >
        <Brasao className="h-12 w-auto sm:h-14" titulo="" />

        {/* Sinal a partir do 3º toque.
            Existe separado da animação porque, sob `prefers-reduced-motion`, o
            pulso não roda — e aí este ponto é o ÚNICO retorno de que o gesto
            está sendo reconhecido. Sem ele, quem desligou animação tentaria no
            escuro. */}
        {pulsando && (
          <span
            aria-hidden="true"
            className="bg-caqui-orange-500 border-caqui-ink-900 absolute -top-0.5 -right-0.5 size-2.5 rounded-full border"
          />
        )}
      </Link>

      {revelado && (
        <Link
          href="/crm"
          className={cn(
            'border-caqui-ink-900 text-caqui-ink-900 border px-2 py-1',
            'text-micro font-mono uppercase',
            'hover:bg-caqui-sand-100 transition-colors',
            'motion-safe:animate-[caqui-entrada_200ms_var(--ease-saida)]',
          )}
        >
          CRM
        </Link>
      )}
    </div>
  )
}
