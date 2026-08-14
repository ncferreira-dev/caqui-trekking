/**
 * Teto de unidades por linha do carrinho, por tipo.
 *
 * Fonte ÚNICA para as duas pontas que precisam concordar: o schema que valida
 * `POST /api/cart/validate` no servidor (`lib/api/schemas.ts`) e o botão "+" do
 * carrinho (`components/carrinho/lista.tsx`). Antes, o schema aceitava 50 para
 * peça e 20 para saída, mas o carrinho travava tudo em 20 no código — então uma
 * peça com 21–50 unidades era válida pela página do produto e impossível de
 * alcançar pelo carrinho. Com um número só os dois nunca mais divergem.
 *
 * Saída (DEPARTURE) tem teto menor: acima de 20 vagas não é pedido, é engano.
 * Peça (WEAR) vai a 50, que cobre pedido de grupo/uniforme.
 */
export const MAX_UNIDADES = { DEPARTURE: 20, WEAR: 50 } as const

export type TipoDeLinha = keyof typeof MAX_UNIDADES
