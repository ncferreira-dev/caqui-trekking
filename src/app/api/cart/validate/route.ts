import type { NextRequest } from 'next/server'

import { consumirRateLimit } from '@/lib/api/rate-limit'
import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { validarCarrinhoSchema } from '@/lib/api/schemas'
import { validarCarrinho } from '@/server/services/cart-service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cart/validate
 *
 * Recebe o que está no localStorage e devolve o estado ATUAL de cada item:
 * preço vigente, se a saída segue publicada, se a variante segue disponível,
 * se a data já passou.
 *
 * Responde **200 com um relatório item a item**, não 400 com uma frase — o
 * front precisa saber QUAL item divergiu e POR QUÊ para avisar antes de montar
 * a mensagem do WhatsApp. Um erro genérico não é acionável.
 *
 * `no-store` obrigatório: é o estado vivo de preço e disponibilidade. Cachear
 * isso reintroduziria exatamente o problema que o endpoint existe para
 * resolver.
 */
export const POST = rota(async (request: NextRequest) => {
  // É escrita? Não — mas é a rota mais chamada do funil e faz duas queries.
  // Limite generoso, só para barrar loop automatizado.
  consumirRateLimit(request, { balde: 'cart-validate', limite: 60, janelaMs: 60_000 })

  const corpo: unknown = await request.json().catch(() => null)
  const { itens } = validarOuFalhar(validarCarrinhoSchema.safeParse(corpo))

  const resultado = await validarCarrinho(itens)

  return ok(resultado)
})
