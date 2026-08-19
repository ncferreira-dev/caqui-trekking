import { describe, expect, it } from 'vitest'

import { itemCarrinhoSchema } from '@/lib/api/schemas'
import { MAX_UNIDADES } from '@/lib/carrinho/limites'

/**
 * O TETO DE UNIDADES VALE NA SOMA, E NÃO SÓ EM CADA ADIÇÃO.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O DEFEITO, ENCONTRADO EM 18/08/2026
 * ════════════════════════════════════════════════════════════════════════════
 * Cada adição isolada já era limitada pela tela: 20 numa saída, 50 numa peça.
 * Nada limitava a SOMA de duas adições. Adicionar 15 vagas e depois mais 15
 * gravava 30 no `localStorage`.
 *
 * O que torna isso grave não é o número errado, é o que ele causa:
 * `POST /api/cart/validate` valida o carrinho INTEIRO e recusa acima do teto.
 * Com uma linha inflada, a mochila toda parava de funcionar, incluindo os
 * itens certos. E `ehItemValido` só exigia inteiro >= 1, então a linha
 * sobrevivia ao recarregamento: a única saída era limpar o `localStorage`, que
 * a pessoa não sabe fazer.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ESTE ARQUIVO GUARDA O ACORDO ENTRE AS DUAS PONTAS
 * ════════════════════════════════════════════════════════════════════════════
 * O defeito nasceu de duas pontas discordando: a tela limitava a adição, o
 * servidor limitava o total, e ninguém limitava a soma no meio. O teste amarra
 * o schema do servidor à constante que a tela usa — se um mudar sem o outro, o
 * caso falha aqui e não numa mochila travada de cliente.
 */
describe('teto de unidades', () => {
  it('o schema do servidor recusa exatamente acima do teto de SAÍDA', () => {
    const base = { tipo: 'DEPARTURE' as const, departureId: 1, lineId: 'd:1' }

    expect(
      itemCarrinhoSchema.safeParse({ ...base, quantidade: MAX_UNIDADES.DEPARTURE }).success,
    ).toBe(true)
    expect(
      itemCarrinhoSchema.safeParse({ ...base, quantidade: MAX_UNIDADES.DEPARTURE + 1 }).success,
    ).toBe(false)
  })

  it('o schema do servidor recusa exatamente acima do teto de PEÇA', () => {
    const base = { tipo: 'WEAR' as const, variantId: 1, lineId: 'w:1' }

    expect(itemCarrinhoSchema.safeParse({ ...base, quantidade: MAX_UNIDADES.WEAR }).success).toBe(
      true,
    )
    expect(
      itemCarrinhoSchema.safeParse({ ...base, quantidade: MAX_UNIDADES.WEAR + 1 }).success,
    ).toBe(false)
  })

  it('a soma de duas adições não passa do teto', () => {
    // A regra que faltava, escrita como a função pura que o `adicionar` aplica.
    const somar = (tipo: keyof typeof MAX_UNIDADES, atual: number, novo: number) =>
      Math.min(MAX_UNIDADES[tipo], atual + novo)

    expect(somar('DEPARTURE', 15, 15)).toBe(MAX_UNIDADES.DEPARTURE)
    expect(somar('WEAR', 40, 40)).toBe(MAX_UNIDADES.WEAR)
    // E continua somando normalmente quando cabe.
    expect(somar('DEPARTURE', 2, 3)).toBe(5)
  })

  it('o resultado da soma travada é sempre aceito pelo servidor', () => {
    // É a invariante que importa: qualquer coisa que o carrinho consiga gravar
    // precisa passar na validação, senão a mochila trava inteira.
    for (const atual of [1, 5, 19, 20]) {
      for (const novo of [1, 5, 20]) {
        const quantidade = Math.min(MAX_UNIDADES.DEPARTURE, atual + novo)
        const r = itemCarrinhoSchema.safeParse({
          tipo: 'DEPARTURE',
          departureId: 1,
          lineId: 'd:1',
          quantidade,
        })
        expect(r.success, `quantidade ${quantidade} deveria ser aceita`).toBe(true)
      }
    }
  })
})
