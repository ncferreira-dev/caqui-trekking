import { AppError, ErrorCode } from '@/lib/api/errors'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria, type EntidadeAuditavel } from '@/server/services/audit-service'

/**
 * A ordem das vitrines.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O SITE OBEDECIA DOIS CAMPOS QUE NINGUÉM CONSEGUIA ESCREVER
 * ────────────────────────────────────────────────────────────────────────────
 * `/trekking` e `/wear` ordenam por `featured` desc e depois `sortOrder` asc.
 * Os dois campos existem desde o primeiro dia. Nenhuma tela do CRM escrevia
 * nenhum dos dois: a ordem da vitrine era a que o seed deixou, e a etiqueta
 * "destaque" na lista de roteiros era decoração de leitura.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UMA CHAMADA COM O MANIFESTO COMPLETO, NÃO UM PATCH POR ITEM
 * ────────────────────────────────────────────────────────────────────────────
 * Mesma decisão de `reordenarMidias`, e pela mesma razão: N chamadas deixam o
 * catálogo em estado intermediário se a rede cair no meio da sequência, e dois
 * itens acabam com o mesmo `sortOrder`. Aqui é uma transação: ou a ordem
 * inteira entra, ou nada muda.
 *
 * A lista precisa conter TODOS os itens vivos da coleção e só eles. Uma lista
 * parcial renumeraria a metade enviada a partir do zero e deixaria a outra
 * metade com a numeração antiga, embaralhando as duas de um jeito que ninguém
 * pediu.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TRÊS COLEÇÕES, UM SERVIÇO
 * ────────────────────────────────────────────────────────────────────────────
 * Roteiro, peça e guia têm a mesma operação: `sortOrder = índice`. Este é o
 * terceiro caso, que é exatamente quando a regra deste projeto manda subir
 * para o comum em vez de duplicar. As ROTAS continuam separadas, porque a
 * tabela de autorização é por recurso e é ela que responde "quem pode mexer
 * nisto" — uma rota genérica daria uma resposta só para três perguntas.
 */

type Contexto = { userId: number; ip: string | null }

export type Colecao = 'trips' | 'products' | 'guides'

/**
 * O que cada coleção precisa: como listar os vivos, como gravar, e o nome que
 * vai para a auditoria.
 *
 * `deletedAt: null` em todas as três: item arquivado sai da tela do CRM, então
 * exigi-lo no manifesto obrigaria a interface a mandar um id que ela não
 * mostra.
 */
const COLECOES = {
  trips: {
    entidade: 'Trip' as EntidadeAuditavel,
    rotulo: 'roteiro',
    vivos: () => prisma.trip.findMany({ where: { deletedAt: null }, select: { id: true } }),
    gravar: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], id: number, i: number) =>
      tx.trip.update({ where: { id }, data: { sortOrder: i } }),
  },
  products: {
    entidade: 'Product' as EntidadeAuditavel,
    rotulo: 'peça',
    vivos: () => prisma.product.findMany({ where: { deletedAt: null }, select: { id: true } }),
    gravar: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], id: number, i: number) =>
      tx.product.update({ where: { id }, data: { sortOrder: i } }),
  },
  guides: {
    entidade: 'Guide' as EntidadeAuditavel,
    rotulo: 'guia',
    vivos: () => prisma.guide.findMany({ where: { deletedAt: null }, select: { id: true } }),
    gravar: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], id: number, i: number) =>
      tx.guide.update({ where: { id }, data: { sortOrder: i } }),
  },
} as const

export async function reordenarCatalogo(
  colecao: Colecao,
  ids: number[],
  ctx: Contexto,
): Promise<{ ordem: number[] }> {
  const config = COLECOES[colecao]

  if (new Set(ids).size !== ids.length) {
    throw new AppError(ErrorCode.CONFLICT, 'A lista de ordem tem ids repetidos.', { status: 409 })
  }

  const vivos = await config.vivos()
  const noBanco = new Set(vivos.map((x) => x.id))
  const enviados = new Set(ids)

  const faltando = [...noBanco].filter((id) => !enviados.has(id))
  const desconhecidos = ids.filter((id) => !noBanco.has(id))

  if (faltando.length > 0 || desconhecidos.length > 0) {
    const partes: string[] = []
    if (faltando.length > 0) partes.push(`faltando: ${faltando.join(', ')}`)
    if (desconhecidos.length > 0) partes.push(`não existem: ${desconhecidos.join(', ')}`)

    throw new AppError(
      ErrorCode.CONFLICT,
      `A ordem precisa listar todos os itens de ${config.rotulo}, e só eles (${partes.join('; ')}).`,
      { status: 409 },
    )
  }

  await prisma.$transaction(async (tx) => {
    for (const [indice, id] of ids.entries()) {
      await config.gravar(tx, id, indice)
    }

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'catalogo.reordenar',
        entityType: config.entidade,
        // A operação é da COLEÇÃO, não de uma linha. O id fica com o nome da
        // coleção para a trilha não fingir que mexeu num item só.
        entityId: colecao,
        after: { ordem: ids },
        ip: ctx.ip,
      },
      tx,
    )
  })

  return { ordem: ids }
}
