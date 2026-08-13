import type { NextRequest } from 'next/server'

import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { filtrosProdutoSchema, queryParaObjeto } from '@/lib/api/schemas'
import { listarProdutos } from '@/server/services/product-service'

export const dynamic = 'force-dynamic'

/** GET /api/products — Caqui Wear, com filtro por categoria. */
export const GET = rota(async (request: NextRequest) => {
  const url = new URL(request.url)
  const filtros = validarOuFalhar(filtrosProdutoSchema.safeParse(queryParaObjeto(url)))

  const { produtos, total } = await listarProdutos({
    categoria: filtros.categoria,
    limit: filtros.limit,
    offset: filtros.offset,
  })

  return ok(produtos, {
    meta: {
      total,
      limit: filtros.limit,
      offset: filtros.offset,
      hasMore: filtros.offset + produtos.length < total,
    },
    cache: { sMaxAge: 60, staleWhileRevalidate: 300 },
  })
})
