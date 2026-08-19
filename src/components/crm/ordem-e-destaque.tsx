'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { useToast } from '@/components/ui/toast'
import { api, ErroDaApi } from '@/lib/crm/api'
import { cn } from '@/lib/ui/cn'

/**
 * A ordem da vitrine e o destaque.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SUBIR/DESCER, E NÃO ARRASTAR
 * ────────────────────────────────────────────────────────────────────────────
 * Arrastar-e-soltar é o reflexo, e ele custa três coisas que este projeto não
 * quer pagar: uma biblioteca de arrasto, um caminho alternativo obrigatório
 * para teclado (a WCAG 2.2 exige que toda ação de arrasto tenha um), e um alvo
 * de arrasto confiável no polegar, em pé, com o celular numa mão só.
 *
 * Dois botões de 44px resolvem os três de graça: funcionam no teclado por
 * serem botões, funcionam no toque por serem grandes, e não trazem dependência
 * nenhuma. Com 5 roteiros e 3 peças, "subir" clicado duas vezes é mais rápido
 * que mirar um arrasto.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UMA CHAMADA COM A LISTA INTEIRA, MESMO PARA TROCAR DOIS
 * ────────────────────────────────────────────────────────────────────────────
 * O botão calcula a nova ordem COMPLETA e manda de uma vez. Dois `PATCH` de
 * `sortOrder` (um para cada vizinho) seriam duas transações: se a segunda
 * falhasse, os dois itens ficariam com o mesmo número e a vitrine passaria a
 * depender do critério de desempate. Ver `ordem-service.ts`.
 */

export type Colecao = 'trips' | 'products' | 'guides'

export function BotoesDeOrdem({
  colecao,
  ids,
  id,
  rotulo,
}: {
  colecao: Colecao
  /** A ordem ATUAL e completa da coleção, como a tela a mostra. */
  ids: number[]
  id: number
  /** Nome do item, para o leitor de tela saber o que está subindo. */
  rotulo: string
}) {
  const router = useRouter()
  const { mostrar } = useToast()
  const [enviando, setEnviando] = useState(false)

  const posicao = ids.indexOf(id)
  const primeiro = posicao <= 0
  const ultimo = posicao === ids.length - 1

  async function mover(passo: -1 | 1) {
    const destino = posicao + passo
    if (enviando || posicao < 0 || destino < 0 || destino >= ids.length) return

    const nova = [...ids]
    const a = nova[posicao]!
    const b = nova[destino]!
    nova[posicao] = b
    nova[destino] = a

    setEnviando(true)
    try {
      await api.patch(`/api/admin/${colecao}/reorder`, { ids: nova })
      router.refresh()
    } catch (causa) {
      mostrar({
        tom: 'erro',
        titulo: 'A ordem não mudou',
        descricao: causa instanceof ErroDaApi ? causa.message : 'Tente de novo.',
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <span className="inline-flex">
      <Seta
        sentido="cima"
        rotulo={`Subir ${rotulo} na ordem da vitrine`}
        desabilitado={primeiro || enviando}
        aoClicar={() => mover(-1)}
      />
      <Seta
        sentido="baixo"
        rotulo={`Descer ${rotulo} na ordem da vitrine`}
        desabilitado={ultimo || enviando}
        aoClicar={() => mover(1)}
      />
    </span>
  )
}

function Seta({
  sentido,
  rotulo,
  desabilitado,
  aoClicar,
}: {
  sentido: 'cima' | 'baixo'
  rotulo: string
  desabilitado: boolean
  aoClicar: () => void
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      disabled={desabilitado}
      aria-label={rotulo}
      className={cn(
        'border-caqui-rule text-caqui-ink-700 inline-flex size-11 items-center justify-center border',
        'hover:bg-caqui-sand-100 hover:text-caqui-ink-900 transition-colors',
        'focus-visible:ring-caqui-ink-900 focus-visible:ring-2 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent',
        sentido === 'baixo' && '-ml-px',
      )}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d={sentido === 'cima' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} strokeLinecap="square" />
      </svg>
    </button>
  )
}

/**
 * O destaque.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ELE NÃO É O PRIMEIRO CRITÉRIO DA VITRINE, E A TELA PRECISA DIZER ISSO
 * ────────────────────────────────────────────────────────────────────────────
 * `/trekking` ordena por destaque e por ordem manual no banco, e DEPOIS
 * reordena em JS pondo quem tem saída futura na frente. Essa terceira regra
 * vence as duas.
 *
 * A decisão está certa: roteiro sem data não dá para comprar, e liderar a
 * vitrine com ele seria vender o que não existe. Mas o efeito é que marcar
 * destaque num roteiro sem data marcada NÃO MUDA NADA na tela, e a pessoa
 * clicaria de novo achando que não pegou.
 *
 * Por isso o aviso aparece exatamente onde a decisão é tomada, e não numa
 * documentação que ninguém abre no meio do dia.
 */
export function BotaoDestaque({
  colecao,
  id,
  destacado,
  rotulo,
  semDataFutura = false,
}: {
  colecao: 'trips' | 'products'
  id: number
  destacado: boolean
  rotulo: string
  /** Só para roteiro: muda o que o botão promete. */
  semDataFutura?: boolean
}) {
  const router = useRouter()
  const { mostrar } = useToast()
  const [enviando, setEnviando] = useState(false)

  async function alternar() {
    if (enviando) return
    setEnviando(true)
    try {
      await api.patch(`/api/admin/${colecao}/${id}`, { featured: !destacado })
      mostrar({
        tom: 'sucesso',
        titulo: destacado ? 'Saiu do destaque' : 'Em destaque',
        descricao:
          !destacado && semDataFutura
            ? 'Sem data marcada, ele continua no fim da vitrine: quem tem data vem primeiro.'
            : undefined,
      })
      router.refresh()
    } catch (causa) {
      mostrar({
        tom: 'erro',
        titulo: 'Não mudou',
        descricao: causa instanceof ErroDaApi ? causa.message : 'Tente de novo.',
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={enviando}
      aria-pressed={destacado}
      aria-label={destacado ? `Tirar ${rotulo} do destaque` : `Destacar ${rotulo}`}
      title={
        semDataFutura
          ? 'Destaque só levanta na vitrine quem tem data marcada.'
          : 'Aparece antes dos outros na vitrine.'
      }
      className={cn(
        'text-micro inline-flex min-h-11 items-center gap-1.5 border px-3 font-mono uppercase transition-colors',
        destacado
          ? 'border-caqui-ink-900 bg-caqui-orange-500 text-caqui-ink-900'
          : 'border-caqui-rule text-caqui-ink-500 hover:text-caqui-ink-900 hover:bg-caqui-sand-100 bg-white',
      )}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5">
        <path
          d="M12 3l2.6 5.6 6.4.8-4.7 4.3 1.2 6.3L12 17l-5.5 3 1.2-6.3L3 9.4l6.4-.8z"
          fill={destacado ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      Destaque
    </button>
  )
}
