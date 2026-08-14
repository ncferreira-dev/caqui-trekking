import { dataPorExtenso, horaLocal, jaEncerrada } from '@/lib/datetime'
import { centavosParaDecimal, formatarBRL, precoEfetivo, somarCentavos } from '@/lib/money'
import { prisma } from '@/lib/prisma'

/**
 * Revalidação do carrinho.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE ENDPOINT EXISTE
 * ────────────────────────────────────────────────────────────────────────────
 * O carrinho vive no `localStorage` e pode ficar semanas parado no navegador.
 * Sem revalidação, a pessoa manda no WhatsApp um pedido com preço velho de uma
 * saída que já aconteceu — e a conversa começa com a Caqui desdizendo o
 * próprio site.
 *
 * O projeto de referência é a prova do custo: o `price` e o `subtotal` eram
 * congelados no localStorage no momento em que o item foi adicionado e iam
 * DIRETO para a mensagem, sem nenhuma conferência. Pior: como o localStorage é
 * editável, `localStorage.setItem('cart', ...)` com preço 1,00 gerava uma
 * mensagem oficial do site dizendo "colar = R$ 1,00", e a atendente, vendo o
 * formato conhecido, tendia a acreditar.
 *
 * Regras aqui:
 *
 *  1. O PREÇO VEM SEMPRE DO BANCO. O cliente pode informar o preço que exibiu,
 *     mas ele serve UNICAMENTE para detectar divergência e avisar. Nunca para
 *     calcular.
 *  2. O total é somado em centavos inteiros, no servidor.
 *  3. A resposta é 200 com um relatório item a item, não um 400 com uma frase.
 *     O front precisa saber QUAL item mudou e POR QUÊ para poder avisar antes
 *     de montar a mensagem.
 *  4. Busca em lote com `in`, nunca uma query por item.
 */

export type ItemCarrinhoEntrada =
  | {
      lineId: string
      tipo: 'DEPARTURE'
      departureId: number
      quantidade: number
      precoCentavosNoCarrinho?: number
    }
  | {
      lineId: string
      tipo: 'WEAR'
      variantId: number
      quantidade: number
      precoCentavosNoCarrinho?: number
    }

export type MotivoDivergencia =
  | 'DEPARTURE_PAST'
  | 'DEPARTURE_NOT_AVAILABLE'
  | 'DEPARTURE_NOT_FOUND'
  | 'VARIANT_UNAVAILABLE'
  | 'VARIANT_NOT_FOUND'
  | 'PRICE_CHANGED'

export type ItemValidado = {
  lineId: string
  tipo: 'DEPARTURE' | 'WEAR'
  /** `false` = não pode ir para a mensagem do WhatsApp. */
  ok: boolean
  /** `null` quando não há divergência. */
  motivo: MotivoDivergencia | null
  /** Preço vigente, vindo do banco. Autoritativo. */
  precoCentavos: number | null
  precoDecimal: string | null
  precoAnteriorCentavos: number | null
  quantidade: number
  subtotalCentavos: number
  /** Texto pronto para a linha da mensagem. */
  descricao: string | null
  detalhe: string | null
}

export type ResultadoValidacao = {
  itens: ItemValidado[]
  totalCentavos: number
  totalFormatado: string
  temDivergencia: boolean
  /** `true` quando todo item está ok e o pedido pode ir para o WhatsApp. */
  podeFinalizar: boolean
}

export async function validarCarrinho(
  entrada: readonly ItemCarrinhoEntrada[],
): Promise<ResultadoValidacao> {
  const agora = new Date()

  const idsDeparture = entrada.flatMap((i) => (i.tipo === 'DEPARTURE' ? [i.departureId] : []))
  const idsVariante = entrada.flatMap((i) => (i.tipo === 'WEAR' ? [i.variantId] : []))

  // Duas queries no total, independente de quantos itens o carrinho tem.
  const [saidas, variantes] = await Promise.all([
    idsDeparture.length
      ? prisma.departure.findMany({
          where: { id: { in: idsDeparture } },
          select: {
            id: true,
            startAt: true,
            priceCents: true,
            availability: true,
            status: true,
            trip: { select: { title: true, status: true, deletedAt: true } },
          },
        })
      : Promise.resolve([]),
    idsVariante.length
      ? prisma.productVariant.findMany({
          where: { id: { in: idsVariante } },
          select: {
            id: true,
            size: true,
            colorName: true,
            available: true,
            priceCents: true,
            product: {
              select: { name: true, priceCents: true, status: true, deletedAt: true },
            },
          },
        })
      : Promise.resolve([]),
  ])

  const porIdSaida = new Map(saidas.map((s) => [s.id, s]))
  const porIdVariante = new Map(variantes.map((v) => [v.id, v]))

  const itens = entrada.map((item): ItemValidado => {
    const precoNoCarrinho = item.precoCentavosNoCarrinho ?? null

    if (item.tipo === 'DEPARTURE') {
      const s = porIdSaida.get(item.departureId)

      const publicada =
        s && s.status === 'PUBLISHED' && s.trip.status === 'PUBLISHED' && !s.trip.deletedAt
      if (!s || !publicada) {
        return itemInvalido(item, 'DEPARTURE_NOT_FOUND', 'Esta saída não está mais disponível.')
      }
      if (jaEncerrada(s.startAt, agora)) {
        return itemInvalido(item, 'DEPARTURE_PAST', `${s.trip.title}: esta data já passou.`)
      }
      if (s.availability === 'SOLD_OUT') {
        return itemInvalido(item, 'DEPARTURE_NOT_AVAILABLE', `${s.trip.title}: esgotado.`)
      }

      const preco = s.priceCents
      const mudou = precoNoCarrinho !== null && precoNoCarrinho !== preco

      return {
        lineId: item.lineId,
        tipo: 'DEPARTURE',
        // Preço diferente NÃO invalida o item: só exige confirmação. O front
        // mostra o diff e a pessoa decide.
        ok: !mudou,
        motivo: mudou ? 'PRICE_CHANGED' : null,
        precoCentavos: preco,
        precoDecimal: centavosParaDecimal(preco),
        precoAnteriorCentavos: mudou ? precoNoCarrinho : null,
        quantidade: item.quantidade,
        subtotalCentavos: preco * item.quantidade,
        descricao: s.trip.title,
        detalhe: `${dataPorExtenso(s.startAt)}, ${horaLocal(s.startAt)}`,
      }
    }

    const v = porIdVariante.get(item.variantId)
    const publicado = v && v.product.status === 'PUBLISHED' && !v.product.deletedAt
    if (!v || !publicado) {
      return itemInvalido(item, 'VARIANT_NOT_FOUND', 'Este produto não está mais disponível.')
    }
    if (!v.available) {
      return itemInvalido(
        item,
        'VARIANT_UNAVAILABLE',
        `${v.product.name}, ${descreverVariante(v.size, v.colorName)}: indisponível.`,
      )
    }

    const preco = precoEfetivo(v.product.priceCents, v.priceCents)
    const mudou = precoNoCarrinho !== null && precoNoCarrinho !== preco

    return {
      lineId: item.lineId,
      tipo: 'WEAR',
      ok: !mudou,
      motivo: mudou ? 'PRICE_CHANGED' : null,
      precoCentavos: preco,
      precoDecimal: centavosParaDecimal(preco),
      precoAnteriorCentavos: mudou ? precoNoCarrinho : null,
      quantidade: item.quantidade,
      subtotalCentavos: preco * item.quantidade,
      descricao: v.product.name,
      detalhe: descreverVariante(v.size, v.colorName),
    }
  })

  // Só itens válidos entram no total. Um item esgotado não soma.
  const totalCentavos = somarCentavos(
    itens
      .filter((i) => i.motivo !== 'DEPARTURE_PAST' && i.precoCentavos !== null && podeSomar(i))
      .map((i) => i.subtotalCentavos),
  )

  const temDivergencia = itens.some((i) => i.motivo !== null)

  return {
    itens,
    totalCentavos,
    totalFormatado: formatarBRL(totalCentavos),
    temDivergencia,
    podeFinalizar: itens.length > 0 && itens.every((i) => i.ok),
  }
}

/**
 * Como a variante é DESCRITA para uma pessoa.
 *
 * `VariantSize.UNICO` é valor de enum, não português. "Tam UNICO · Preto" saía
 * na mensagem do WhatsApp e na linha da mochila — a Caqui recebendo o vocabulário
 * interno do banco no pedido do cliente. Pior no catálogo de óculos, que é todo
 * de tamanho único: a informação inteira daquela linha era ruído.
 *
 * Com tamanho único, a cor sozinha já identifica a variante — e é ela que
 * importa. Com grade de verdade, os dois aparecem.
 */
function descreverVariante(tamanho: string, cor: string): string {
  return tamanho === 'UNICO' ? cor : `Tam ${tamanho} · ${cor}`
}

/** Item com preço mudado ainda soma (o preço novo); item indisponível não. */
function podeSomar(item: ItemValidado): boolean {
  return item.motivo === null || item.motivo === 'PRICE_CHANGED'
}

function itemInvalido(
  item: ItemCarrinhoEntrada,
  motivo: MotivoDivergencia,
  descricao: string,
): ItemValidado {
  return {
    lineId: item.lineId,
    tipo: item.tipo,
    ok: false,
    motivo,
    precoCentavos: null,
    precoDecimal: null,
    precoAnteriorCentavos: null,
    quantidade: item.quantidade,
    subtotalCentavos: 0,
    descricao,
    detalhe: null,
  }
}
