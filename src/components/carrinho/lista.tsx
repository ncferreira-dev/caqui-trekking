'use client'

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
          titulo="Suas experiências"
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

function Grupo({
  titulo,
  subtitulo,
  itens,
}: {
  titulo: string
  subtitulo?: string
  itens: ItemValidado[]
}) {
  return (
    <section>
      <div className="border-caqui-rule-forte border-b pb-2">
        <h2 className="text-display-s uppercase">{titulo}</h2>
        {subtitulo && (
          <p className="text-caqui-ink-500 text-micro font-mono uppercase">{subtitulo}</p>
        )}
      </div>

      <ul>
        {itens.map((item) => (
          <Linha key={item.lineId} item={item} />
        ))}
      </ul>
    </section>
  )
}

function Linha({ item }: { item: ItemValidado }) {
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
                aoMudar={(n) => alterarQuantidade(item.lineId, n)}
              />
            ) : (
              <span className="text-caqui-ink-500 text-micro font-mono uppercase">
                {item.quantidade} {item.tipo === 'DEPARTURE' ? 'vaga(s)' : 'un'}
              </span>
            )}

            <button
              type="button"
              onClick={() => remover(item.lineId)}
              className="text-caqui-ink-500 hover:text-caqui-danger text-micro rounded-xs font-mono uppercase transition-colors"
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
            <p className="text-caqui-ink-500 text-micro font-mono uppercase">—</p>
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
  aoMudar,
}: {
  valor: number
  rotulo: string
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
        className="hover:bg-caqui-sand-100 inline-flex size-9 items-center justify-center"
      >
        <span aria-hidden="true">−</span>
      </button>

      <span className="text-dado inline-flex min-w-9 items-center justify-center px-1 font-mono font-medium">
        {valor}
      </span>

      <button
        type="button"
        onClick={() => aoMudar(valor + 1)}
        disabled={valor >= 20}
        aria-label={`Aumentar ${rotulo}`}
        className="hover:bg-caqui-sand-100 inline-flex size-9 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span aria-hidden="true">+</span>
      </button>
    </span>
  )
}
