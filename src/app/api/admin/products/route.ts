import type { NextRequest } from 'next/server'

import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { criarProdutoSchema } from '@/lib/api/schema-produto'
import { paginacaoSchema, queryParaObjeto } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import { criarProduto } from '@/server/services/admin/product-admin-service'
import { ipDaRequest } from '@/server/services/audit-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/products
 *
 * O catálogo da Caqui Wear como o painel precisa dele: com rascunho, e com
 * TODAS as variantes de cada produto — inclusive as indisponíveis.
 *
 * As variantes vêm inteiras de propósito. A tela é uma tabela com um botão de
 * disponibilidade por linha (tamanho × cor), e esse botão é o análogo, na
 * loja, do que a disponibilidade da saída é na agenda: o campo mexido no dia a
 * dia. Buscar as variantes numa segunda requisição, por produto, faria a
 * tabela abrir vazia e preencher aos pedaços.
 *
 * O teto de `limit` do `paginacaoSchema` é 100 produtos. Com a média de 3
 * variantes por peça isso é uma resposta pequena; se um dia a Caqui tiver
 * catálogo grande, a paginação já está aqui.
 */
export const GET = rota(async (request: NextRequest) => {
  await exigirPapel(request, ['OWNER', 'ADMIN'])

  const url = new URL(request.url)
  const { limit, offset } = validarOuFalhar(paginacaoSchema.safeParse(queryParaObjeto(url)))

  const where = { deletedAt: null }

  const [produtos, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        priceCents: true,
        status: true,
        featured: true,
        sortOrder: true,
        images: { select: { url: true, alt: true }, orderBy: { sortOrder: 'asc' }, take: 1 },
        variants: {
          select: {
            id: true,
            size: true,
            colorName: true,
            colorHex: true,
            priceCents: true,
            available: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      take: limit,
      skip: offset,
    }),
    prisma.product.count({ where }),
  ])

  const dados = produtos.map((p) => ({
    id: p.id,
    slug: p.slug,
    nome: p.name,
    categoria: p.category,
    precoCentavos: p.priceCents,
    status: p.status,
    destaque: p.featured,
    ordem: p.sortOrder,
    capa: p.images[0] ?? null,
    variantes: p.variants.map((v) => ({
      id: v.id,
      tamanho: v.size,
      cor: v.colorName,
      corHex: v.colorHex,
      // `null` significa "usa o preço do produto". O painel mostra a diferença
      // para a Caqui saber quando uma variante foge do preço base.
      precoProprioCentavos: v.priceCents,
      disponivel: v.available,
    })),
    // Atalho para a tabela mostrar "3 de 7 disponíveis" sem recontar na tela.
    variantesDisponiveis: p.variants.filter((v) => v.available).length,
  }))

  return ok(dados, { meta: { total, limit, offset, hasMore: offset + dados.length < total } })
})

/**
 * POST /api/admin/products — cadastrar uma peça com suas variantes.
 *
 * Nasce como DRAFT por padrão: publicar é uma decisão à parte, e uma peça recém
 * cadastrada quase sempre ainda vai receber foto e revisão antes de ir para a
 * loja. O slug é gerado do nome no serviço; o cliente não o envia.
 */
export const POST = rota(async (request: NextRequest) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const corpo: unknown = await request.json().catch(() => null)
  const dados = validarOuFalhar(criarProdutoSchema.safeParse(corpo))

  const resultado = await criarProduto(dados, {
    userId: usuario.userId,
    ip: ipDaRequest(request),
  })

  return ok(resultado)
})
