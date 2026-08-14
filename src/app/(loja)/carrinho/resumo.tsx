'use client'

import { LinkBotao } from '@/components/ui/button'
import { Esqueleto } from '@/components/ui/esqueleto'
import { useCarrinho } from '@/lib/carrinho/store'

/**
 * O que a mochila já sabe hoje.
 *
 * O carrinho guarda referência e quantidade — de propósito, e é por isso que
 * esta tela ainda não mostra nome nem preço: eles não estão no
 * `localStorage`, e não vão estar. Quem sabe o preço é o servidor.
 *
 * O PROMPT 09 chama `POST /api/cart/validate`, recebe nome, preço, capa e
 * disponibilidade de cada linha, e monta a mensagem do WhatsApp com o total
 * calculado no servidor.
 */
export function ResumoDaMochila() {
  const { itens, quantidadeTotal, pronto, remover, limpar } = useCarrinho()

  if (!pronto) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <span role="status" className="sr-only">
          Carregando sua mochila
        </span>
        <Esqueleto className="h-16" />
        <Esqueleto className="h-16" />
      </div>
    )
  }

  if (itens.length === 0) {
    return (
      <div className="flex flex-col items-start gap-6">
        <p className="text-caqui-ink-700 text-corpo-lg">
          Sua mochila está vazia. Escolha uma data na agenda ou uma peça na Caqui Wear.
        </p>
        <div className="flex flex-wrap gap-4">
          <LinkBotao href="/agenda">Ver a agenda</LinkBotao>
          <LinkBotao href="/wear" variante="secondary">
            Ver a Caqui Wear
          </LinkBotao>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col">
        {itens.map((item) => (
          <li
            key={item.lineId}
            className="border-caqui-rule flex items-center justify-between gap-4 border-b py-4"
          >
            <div>
              <p className="font-display text-corpo uppercase">
                {item.tipo === 'DEPARTURE' ? 'Vaga em saída' : 'Peça da Caqui Wear'}
              </p>
              <p className="text-caqui-ink-500 text-micro font-mono uppercase">
                {item.quantidade} ×{' '}
                {item.tipo === 'DEPARTURE'
                  ? `saída #${item.departureId}`
                  : `variante #${item.variantId}`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => remover(item.lineId)}
              className="text-caqui-ink-500 hover:text-caqui-danger text-micro rounded-xs px-2 py-1 font-mono uppercase transition-colors"
            >
              Remover
            </button>
          </li>
        ))}
      </ul>

      <p className="text-caqui-ink-700 border-caqui-rule text-corpo-sm border-l-2 pl-4">
        {quantidadeTotal} {quantidadeTotal === 1 ? 'item' : 'itens'}. Nome, preço e disponibilidade
        são buscados no servidor na hora de fechar — o navegador guarda só a referência. É o que
        impede um carrinho aberto na terça mostrar o preço de terça numa saída que mudou na quinta.
      </p>

      <button
        type="button"
        onClick={limpar}
        className="text-caqui-ink-500 hover:text-caqui-danger text-micro self-start rounded-xs font-mono uppercase transition-colors"
      >
        Esvaziar mochila
      </button>
    </div>
  )
}
