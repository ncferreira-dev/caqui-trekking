import { limitarLeituraPublica } from '@/lib/api/rate-limit'
import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { slugSchema } from '@/lib/api/schemas'
import { buscarProdutoPorSlug } from '@/server/services/product-service'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ slug: string }> }

/**
 * GET /api/products/:slug
 *
 * Devolve TODAS as variantes, inclusive as indisponíveis, com o flag
 * `disponivel`. Combinação esgotada não some da resposta: a UI precisa
 * mostrá-la desabilitada, porque a pessoa precisa saber que ela existe.
 */
export const GET = rota(async (request: Request, contexto: Contexto) => {
  limitarLeituraPublica(request, 'product')

  const { slug } = await contexto.params
  const slugValido = validarOuFalhar(slugSchema.safeParse(slug))

  const produto = await buscarProdutoPorSlug(slugValido)

  return ok(produto, { cache: { sMaxAge: 60, staleWhileRevalidate: 300 } })
})
