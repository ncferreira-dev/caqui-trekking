/**
 * A conta da paginação, fora de qualquer tela.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O DEFEITO QUE ELA SUBSTITUI: O TETO MUDO
 * ────────────────────────────────────────────────────────────────────────────
 * As telas do CRM liam com `take: 100` (ou 200) e mais nada. Com o catálogo
 * atual isso nunca corta, e é justamente esse o problema: no dia em que cortar,
 * a tela vai mostrar 100 itens com a mesma cara de "são todos", e o que ficou
 * de fora não vira erro, não vira aviso, não vira nada.
 *
 * Truncar em silêncio é pior que truncar: quem vê 100 linhas conclui que tem
 * 100 linhas.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PURA, PORQUE ELA ERRA EM SILÊNCIO
 * ────────────────────────────────────────────────────────────────────────────
 * Todo defeito de paginação é aritmético e invisível: a página 3 pulando um
 * item, a última página vazia, `?pagina=0` virando `skip: -50`. Nada disso
 * quebra nada, e ninguém percebe até faltar um registro. Por isso a conta mora
 * aqui, sem framework e sem banco, e é testada sozinha.
 */

export type Fatia = {
  /** Quantos itens existem no total. O rodapé imprime este número. */
  total: number
  /** 1-based, já corrigida para caber no intervalo existente. */
  pagina: number
  /** Quantas páginas existem. Nunca 0: lista vazia tem 1 página vazia. */
  paginas: number
  /** Para o `skip` do Prisma. */
  offset: number
  /** Para o `take` do Prisma. */
  tamanho: number
  /** Posição do primeiro item da página, 1-based. `0` quando não há nada. */
  primeiro: number
  /** Posição do último item. */
  ultimo: number
  /** Existe página anterior / seguinte. */
  temAnterior: boolean
  temSeguinte: boolean
}

/**
 * `?pagina=` é entrada não confiável: pode vir vazia, negativa, com letra, ou
 * apontando para uma página que existia antes de alguém arquivar meio
 * catálogo. Em todos os casos a saída é uma página VÁLIDA, e não um erro:
 * ninguém deve ver uma tela quebrada por causa de um link velho.
 */
export function fatiar(
  bruto: string | string[] | undefined,
  total: number,
  tamanho: number,
): Fatia {
  const texto = Array.isArray(bruto) ? bruto[0] : bruto
  const paginas = Math.max(1, Math.ceil(total / tamanho))

  const pedido = Number(texto)
  const pagina = Number.isFinite(pedido) ? Math.min(Math.max(Math.trunc(pedido), 1), paginas) : 1

  const offset = (pagina - 1) * tamanho

  return {
    total,
    pagina,
    paginas,
    offset,
    tamanho,
    primeiro: total === 0 ? 0 : offset + 1,
    ultimo: Math.min(offset + tamanho, total),
    temAnterior: pagina > 1,
    temSeguinte: pagina < paginas,
  }
}
