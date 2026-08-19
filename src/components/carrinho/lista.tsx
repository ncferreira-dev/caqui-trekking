'use client'

import { useEffect, useRef, useState } from 'react'

import { MAX_UNIDADES } from '@/lib/carrinho/limites'
import { useCarrinho } from '@/lib/carrinho/store'
import { formatarBRL } from '@/lib/money'
import { cn } from '@/lib/ui/cn'
import type { ItemValidado, MotivoDivergencia } from '@/server/services/cart-service'

/**
 * As linhas da mochila, agrupadas.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * "SUAS EXPERIÊNCIAS" E "CAQUI WEAR" SÃO COISAS DIFERENTES
 * ────────────────────────────────────────────────────────────────────────────
 * Uma vaga em saída tem DATA e é perecível: some da agenda quando o dia chega.
 * Uma camiseta tem tamanho e cor e fica. Listar as duas na mesma coluna faria a
 * data virar mais um detalhe de linha, quando ela é o dado que decide se o
 * pedido ainda vale.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TUDO QUE ESTÁ NA TELA VEIO DO SERVIDOR
 * ────────────────────────────────────────────────────────────────────────────
 * O `localStorage` tem `id` e `quantidade`. Nome, data, tamanho, cor e preço
 * chegam de `POST /api/cart/validate` no momento em que a mochila abre. É por
 * isso que não existe estado "carrinho carregado do storage" com preço dentro:
 * o preço nunca esteve lá.
 */

const AVISOS: Record<MotivoDivergencia, { titulo: string; texto: string }> = {
  DEPARTURE_PAST: {
    titulo: 'Data já passou',
    texto: 'Esta saída aconteceu enquanto o item estava na mochila. Veja as próximas na agenda.',
  },
  DEPARTURE_NOT_AVAILABLE: {
    titulo: 'Esgotou',
    texto: 'As vagas acabaram. Dá para pedir aviso na página da expedição, se abrir vaga.',
  },
  DEPARTURE_NOT_FOUND: {
    titulo: 'Saiu do ar',
    texto: 'Esta saída não está mais publicada.',
  },
  VARIANT_UNAVAILABLE: {
    titulo: 'Sem estoque',
    texto: 'Esta combinação de tamanho e cor está indisponível.',
  },
  VARIANT_NOT_FOUND: {
    titulo: 'Saiu de linha',
    texto: 'Esta peça não está mais no catálogo.',
  },
  PRICE_CHANGED: {
    titulo: 'Preço mudou',
    texto: 'O valor foi atualizado. Confira antes de finalizar.',
  },
}

export function ListaDaMochila({
  itens,
  compacta = false,
}: {
  itens: ItemValidado[]
  /** No drawer o espaço é curto: some com o subtítulo dos grupos. */
  compacta?: boolean
}) {
  const experiencias = itens.filter((i) => i.tipo === 'DEPARTURE')
  const pecas = itens.filter((i) => i.tipo === 'WEAR')

  return (
    <div className="flex flex-col gap-8">
      {experiencias.length > 0 && (
        <Grupo
          titulo="Trilhas"
          subtitulo={compacta ? undefined : 'Vagas em saídas com data marcada.'}
          itens={experiencias}
        />
      )}
      {pecas.length > 0 && (
        <Grupo
          titulo="Caqui Wear"
          subtitulo={compacta ? undefined : 'Peças da marca.'}
          itens={pecas}
        />
      )}
    </div>
  )
}

/**
 * Um grupo da mochila, e o que acontece quando uma linha some.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * REMOVER DESTRUÍA O FOCO E NÃO DIZIA NADA
 * ────────────────────────────────────────────────────────────────────────────
 * Ao apagar a linha, o `<button>` que tinha o foco deixa de existir. O
 * navegador devolve o foco para o `<body>`: quem navega por teclado volta ao
 * topo do documento e precisa tabular a mochila inteira de novo, e quem usa
 * leitor de tela não ouve absolutamente nada — a lista encolheu em silêncio.
 *
 * As duas metades do conserto:
 *
 *  • **Anúncio.** Um `role="status"` fora da lista (fora dela de propósito: um
 *    live region que some junto com o item não chega a anunciar) recebe
 *    "Camiseta removida da mochila". A região nasce vazia, senão o leitor
 *    recitaria a mensagem ao montar a página.
 *  • **Foco.** Vai para o botão "Remover" da linha que TOMOU O LUGAR da que
 *    saiu, que é onde a pessoa estava olhando. Removida a última, vai para o
 *    título do grupo, que é `tabIndex={-1}` só para poder receber foco por
 *    código (nunca entra na ordem de tabulação).
 */
function Grupo({
  titulo,
  subtitulo,
  itens,
}: {
  titulo: string
  subtitulo?: string
  itens: ItemValidado[]
}) {
  const lista = useRef<HTMLUListElement>(null)
  const cabecalho = useRef<HTMLHeadingElement>(null)
  const [aviso, setAviso] = useState('')

  // `useRef` e não `useState` para o índice pendente: ele não é renderizado, e
  // guardá-lo em estado obrigaria a zerá-lo DENTRO do efeito, que é o padrão
  // de render em cascata que o compilador do React recusa. Aqui o efeito só
  // lê, age e limpa.
  const focoPendente = useRef<number | null>(null)

  // Depende do TAMANHO da lista, não do array: `itens` é recriado por `filter`
  // a cada render do pai, e o efeito rodaria à toa em toda digitação da
  // página. O tamanho muda exatamente quando uma linha entra ou sai, que é o
  // único momento em que há foco para reposicionar.
  useEffect(() => {
    const indice = focoPendente.current
    if (indice === null) return
    focoPendente.current = null

    const botoes = lista.current?.querySelectorAll<HTMLButtonElement>('[data-remover]')
    const alvo = botoes?.[Math.min(indice, Math.max(botoes.length - 1, 0))]
    if (alvo) alvo.focus()
    else cabecalho.current?.focus()
  }, [itens.length])

  return (
    <section>
      <div className="border-caqui-rule-forte border-b pb-2">
        <h2
          ref={cabecalho}
          tabIndex={-1}
          className="text-display-s uppercase focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {titulo}
        </h2>
        {subtitulo && (
          <p className="text-caqui-ink-500 text-micro font-mono uppercase">{subtitulo}</p>
        )}
      </div>

      <ul ref={lista}>
        {itens.map((item, indice) => (
          <Linha
            key={item.lineId}
            item={item}
            aoRemover={() => {
              setAviso(`${item.descricao ?? 'Item'} removido da mochila.`)
              focoPendente.current = indice
            }}
          />
        ))}
      </ul>

      <p role="status" aria-live="polite" className="sr-only">
        {aviso}
      </p>
    </section>
  )
}

function Linha({ item, aoRemover }: { item: ItemValidado; aoRemover: () => void }) {
  const { alterarQuantidade, remover } = useCarrinho()
  const aviso = item.motivo ? AVISOS[item.motivo] : null

  // Item que não pode ser comprado perde o controle de quantidade: aumentar a
  // quantidade de algo esgotado não é uma ação que faça sentido oferecer.
  const editavel = item.motivo === null || item.motivo === 'PRICE_CHANGED'

  return (
    <li className="border-caqui-rule relative border-b py-4 last:border-b-0">
      {!editavel && <span className="trama-indisponivel absolute inset-0" aria-hidden="true" />}

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-display text-corpo uppercase">{item.descricao}</p>
          {item.detalhe && (
            <p className="text-caqui-ink-700 text-corpo-sm mt-0.5">{item.detalhe}</p>
          )}

          {aviso && (
            <p
              className={cn(
                'text-corpo-sm mt-2 border-l-4 px-3 py-1.5',
                item.motivo === 'PRICE_CHANGED'
                  ? 'border-caqui-orange-500 bg-caqui-sand-100'
                  : 'border-caqui-danger bg-caqui-sand-100',
              )}
            >
              <strong className="font-display text-corpo-sm uppercase">{aviso.titulo}.</strong>{' '}
              {aviso.texto}
              {item.precoAnteriorCentavos !== null && item.precoCentavos !== null && (
                <>
                  {' '}
                  <span className="font-mono">
                    <s>{formatarBRL(item.precoAnteriorCentavos)}</s> →{' '}
                    {formatarBRL(item.precoCentavos)}
                  </span>
                </>
              )}
            </p>
          )}

          <div className="mt-3 flex items-center gap-3">
            {editavel ? (
              <Quantidade
                valor={item.quantidade}
                rotulo={item.descricao ?? 'item'}
                max={MAX_UNIDADES[item.tipo]}
                aoMudar={(n) => alterarQuantidade(item.lineId, n)}
              />
            ) : (
              <span className="text-caqui-ink-500 text-micro font-mono uppercase">
                {/* "vaga(s)" e convencao de CRM. Aqui quem le e o cliente,
                    e a quantidade ja esta na tela ao lado: da para concordar. */}
                {item.quantidade}{' '}
                {item.tipo === 'DEPARTURE' ? (item.quantidade === 1 ? 'vaga' : 'vagas') : 'un'}
              </span>
            )}

            <button
              type="button"
              data-remover
              onClick={() => {
                // O aviso e o foco são resolvidos ANTES da remoção, enquanto
                // esta linha ainda existe e sabe o próprio índice e nome.
                aoRemover()
                remover(item.lineId)
              }}
              className="text-caqui-ink-500 hover:text-caqui-danger text-micro min-h-11 rounded-xs font-mono uppercase transition-colors"
            >
              Remover
              <span className="sr-only"> {item.descricao} da mochila</span>
            </button>
          </div>
        </div>

        <div className="shrink-0 text-right">
          {item.precoCentavos !== null ? (
            <>
              <p className="text-dado font-mono font-medium">
                {formatarBRL(item.subtotalCentavos)}
              </p>
              {item.quantidade > 1 && (
                <p className="text-caqui-ink-500 text-micro font-mono">
                  {item.quantidade} × {formatarBRL(item.precoCentavos)}
                </p>
              )}
            </>
          ) : (
            <p className="text-caqui-ink-500 text-micro font-mono uppercase">Sem preço</p>
          )}
        </div>
      </div>
    </li>
  )
}

/**
 * Menos/mais em volta do número.
 *
 * Sem `<input type="number">` aqui, ao contrário do seletor de saída: numa
 * lista de várias linhas, um campo editável por linha convida a digitar e
 * esquecer de confirmar — e cada tecla dispararia uma revalidação. Os botões
 * dão passos discretos, e cada passo é uma intenção completa.
 */
function Quantidade({
  valor,
  rotulo,
  max,
  aoMudar,
}: {
  valor: number
  rotulo: string
  /** Teto por tipo: 20 para saída, 50 para peça. Vem de MAX_UNIDADES. */
  max: number
  aoMudar: (n: number) => void
}) {
  return (
    <span className="border-caqui-ink-900 inline-flex items-stretch border">
      <button
        type="button"
        onClick={() => aoMudar(valor - 1)}
        // Em 1, o menos REMOVE — é o que `alterarQuantidade` faz com 0, e é o
        // gesto que a pessoa espera. Desabilitar aqui deixaria o botão morto
        // exatamente no estado mais comum.
        aria-label={valor === 1 ? `Remover ${rotulo}` : `Diminuir ${rotulo}`}
        // 44px, e não 36px. O projeto inteiro trava alvo de toque em 44px
        // (ver `pecas.tsx` do painel e o rodapé); este controle tinha ficado
        // em `size-9` = 36px, e é o alvo MAIS apertado do site: dois botões
        // colados, num polegar, decidindo quantidade de vaga. Errar aqui
        // custa uma vaga a mais na mensagem do WhatsApp.
        className="hover:bg-caqui-sand-100 inline-flex size-11 items-center justify-center"
      >
        <span aria-hidden="true">−</span>
      </button>

      <span className="text-dado inline-flex min-w-11 items-center justify-center px-1 font-mono font-medium">
        {valor}
      </span>

      <button
        type="button"
        onClick={() => aoMudar(valor + 1)}
        disabled={valor >= max}
        aria-label={`Aumentar ${rotulo}`}
        className="hover:bg-caqui-sand-100 inline-flex size-11 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span aria-hidden="true">+</span>
      </button>
    </span>
  )
}
