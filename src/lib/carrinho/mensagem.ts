import { formatarBRL } from '@/lib/money'
import type { ItemValidado, ResultadoValidacao } from '@/server/services/cart-service'

/**
 * A mensagem do WhatsApp — o produto final do site.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ELA É MONTADA A PARTIR DO QUE O SERVIDOR VALIDOU, NUNCA DO `localStorage`
 * ────────────────────────────────────────────────────────────────────────────
 * A entrada é o `ResultadoValidacao` de `POST /api/cart/validate`: nome, preço
 * e detalhe vêm todos do banco, no instante do envio. O `localStorage` só
 * contribuiu com `id` e `quantidade`.
 *
 * No projeto de referência, `price` e `subtotal` eram congelados no
 * localStorage quando o item entrava no carrinho e iam DIRETO para a mensagem.
 * Como o localStorage é editável, `setItem('cart', …)` com preço 1,00 gerava
 * uma mensagem oficial do site dizendo "colar = R$ 1,00" — e a atendente,
 * reconhecendo o formato, tendia a acreditar.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O TEMPLATE VEM DO CRM, POR INTERPOLAÇÃO — NÃO ESTÁ ESCRITO AQUI
 * ────────────────────────────────────────────────────────────────────────────
 * `whatsappMessageTemplate` é um campo do banco, editável sem deploy. A Caqui
 * pode mudar a saudação, tirar o emoji, trocar a palavra "pedido" — e este
 * arquivo continua igual.
 *
 * O que ele conhece são os dois marcadores: `{{itens}}` e `{{total}}`.
 */

/** Os marcadores que o template pode usar. Qualquer outro passa intacto. */
export const MARCADORES = ['{{itens}}', '{{total}}'] as const

/**
 * Fallback usado quando o template do banco não tem `{{itens}}`.
 *
 * Não é decoração: um template salvo sem o marcador — alguém editou no CRM e
 * apagou sem querer — produziria uma mensagem com saudação e total, e NENHUM
 * item. A Caqui receberia "Olá! Total: R$ 850,00" e não saberia do quê.
 * Melhor anexar a lista ao fim do que perder o pedido.
 */
const TEMPLATE_MINIMO = '{{itens}}\n\n*Total: {{total}}*'

/** 🥾 para o que se anda, 👕 para o que se veste. */
const EMOJI = { DEPARTURE: '🥾', WEAR: '👕' } as const

/**
 * Uma linha de item, em três ou quatro linhas de texto.
 *
 * O formato é o do briefing. A diferença entre os dois tipos não é enfeite: a
 * expedição precisa da DATA em destaque próprio, porque é o dado que a Caqui
 * confere primeiro ao receber a mensagem; a peça precisa de tamanho e cor na
 * mesma linha, porque juntos eles são a variante.
 */
function linhaDoItem(item: ItemValidado): string {
  const partes: string[] = [`${EMOJI[item.tipo]} ${item.descricao ?? 'Item'}`]

  if (item.tipo === 'DEPARTURE') {
    if (item.detalhe) partes.push(`📅 ${item.detalhe}`)
    partes.push(`👤 ${item.quantidade} ${item.quantidade === 1 ? 'vaga' : 'vagas'}`)
  } else {
    const detalhe = item.detalhe ? `${item.detalhe} · ` : ''
    partes.push(`${detalhe}${item.quantidade} un`)
  }

  partes.push(formatarBRL(item.subtotalCentavos))
  return partes.join('\n')
}

/**
 * Só entra na mensagem o que o servidor liberou.
 *
 * Um item esgotado, uma data que já passou ou uma variante que saiu de linha
 * NÃO podem virar linha de pedido: a conversa começaria com a Caqui
 * desdizendo o próprio site. A interface avisa antes; aqui é a última rede.
 */
export function itensQueVaoNaMensagem(resultado: ResultadoValidacao): ItemValidado[] {
  const vao = resultado.itens.filter((i) => i.precoCentavos !== null && i.motivo === null)

  // Experiências primeiro. É o que a Caqui precisa ler antes — data tem prazo,
  // camiseta não.
  return [...vao.filter((i) => i.tipo === 'DEPARTURE'), ...vao.filter((i) => i.tipo === 'WEAR')]
}

/**
 * Interpola o template do CRM com os itens validados.
 *
 * `split`/`join` e não `replace`: com `replace(/{{itens}}/g, texto)`, qualquer
 * `$&`, `$1` ou `$'` dentro do texto do item viraria padrão de substituição do
 * JavaScript e sumiria da mensagem. O nome de um produto pode conter `$` — é
 * literalmente o símbolo de dinheiro.
 */
export function montarMensagem(template: string, resultado: ResultadoValidacao): string {
  const itens = itensQueVaoNaMensagem(resultado)

  const base = template.includes('{{itens}}') ? template : `${template}\n\n${TEMPLATE_MINIMO}`

  // O total soma os SUBTOTAIS QUE ESTÃO NA MENSAGEM, não `totalCentavos`.
  //
  // Os dois normalmente coincidem — a interface bloqueia finalizar enquanto
  // houver divergência, e sem divergência os dois conjuntos são o mesmo. Mas
  // `totalCentavos` inclui item com `PRICE_CHANGED`, e `itensQueVaoNaMensagem`
  // não. Se por qualquer caminho os dois divergirem, o erro que sai daqui é o
  // pior possível: uma mensagem cujas linhas não somam o total impresso nela.
  // Cada centavo do total tem uma linha acima explicando de onde veio.
  //
  // Os valores continuam sendo os do servidor — o que muda é só o recorte.
  const total = formatarBRL(itens.reduce((soma, i) => soma + i.subtotalCentavos, 0))

  return base
    .split('{{itens}}')
    .join(itens.map(linhaDoItem).join('\n\n'))
    .split('{{total}}')
    .join(total)
    .trim()
}
