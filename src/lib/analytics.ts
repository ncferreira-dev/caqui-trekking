import { track } from '@vercel/analytics'

/**
 * Os eventos de conversão, num lugar só.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * NOME DE EVENTO É CONTRATO — NÃO PODE SER STRING SOLTA
 * ────────────────────────────────────────────────────────────────────────────
 * Se cada componente chamasse `track('adicionar')` com a string na mão, um
 * escreveria "adicionar", outro "add_cart", e o funil no painel da Vercel viria
 * partido em três eventos que são o mesmo. Centralizar aqui garante um nome só
 * por ação, e é o único arquivo a mudar se um nome precisar ser renomeado.
 *
 * O que o briefing pede — ver roteiro, adicionar ao carrinho, clicar em
 * finalizar — vira: "ver roteiro" é a visita de página (o `<Analytics />` do
 * layout capta sozinho), e os dois abaixo são as ações que a visita de página
 * não enxerga.
 *
 * As propriedades são poucas de propósito: tipo do item e um rótulo legível.
 * Analytics de conversão quer contar e agrupar, não reconstruir o pedido — o
 * pedido inteiro vai pro WhatsApp, não pra cá.
 */

export function eventoAdicionarAMochila(props: { tipo: 'DEPARTURE' | 'WEAR'; item: string }): void {
  track('adicionar_a_mochila', props)
}

export function eventoFinalizarNoWhatsApp(props: { itens: number; totalCentavos: number }): void {
  // O total vai como número de centavos (inteiro), não como texto formatado: no
  // painel dá para somar e tirar média, o que "R$ 239,90" não permite.
  track('finalizar_no_whatsapp', props)
}
