/**
 * As categorias de peça, num módulo NEUTRO.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO MORA DENTRO DO COMPONENTE QUE AS USA
 * ────────────────────────────────────────────────────────────────────────────
 * A lista nasceu exportada de `filtro-de-categoria.tsx`, que é `'use client'`,
 * e a página de produtos — componente de SERVIDOR — importava de lá. O Next
 * transforma todo export de um módulo cliente numa referência opaca do outro
 * lado da fronteira, então no servidor a constante deixava de ser um array:
 *
 *     TypeError: {imported module …}.CATEGORIAS_DA_PECA.map is not a function
 *
 * A tela caiu inteira, com 500. Um módulo sem diretiva atravessa a fronteira
 * como dado de verdade, e é por isso que ele existe.
 *
 * A fonte da verdade continua sendo o enum `ProductCategory` do Prisma; isto
 * aqui é só o rótulo em português e a ordem em que aparecem para quem opera.
 */

export const CATEGORIAS_DA_PECA = [
  { valor: 'CAMISETA', rotulo: 'Camisetas' },
  { valor: 'REGATA', rotulo: 'Regatas' },
  { valor: 'MOCHILA', rotulo: 'Mochilas' },
  { valor: 'BONE', rotulo: 'Bonés' },
  { valor: 'ACESSORIO', rotulo: 'Acessórios' },
] as const

export const VALORES_DE_CATEGORIA: ReadonlySet<string> = new Set(
  CATEGORIAS_DA_PECA.map((c) => c.valor),
)
