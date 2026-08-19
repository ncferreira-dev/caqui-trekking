import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { atualizarProdutoSchema } from '@/lib/api/schema-produto'
import { idSchema } from '@/lib/api/schemas'
import { exigirOwner, exigirPapel } from '@/lib/auth/guard'
import { arquivarProduto, atualizarProduto } from '@/server/services/admin/product-admin-service'
import { ipDaRequest } from '@/server/services/audit-service'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ id: string }> }

/**
 * PATCH /api/admin/products/:id — editar dados e reconciliar variantes.
 *
 * O `slug` fica de fora, como no roteiro: é a URL canônica da peça e já foi
 * compartilhado. Renomear a peça não muda o endereço; trocar slug é operação
 * explícita com redirect, não efeito colateral.
 */
export const PATCH = rota(async (request: Request, contexto: Contexto) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const { id } = await contexto.params
  const productId = validarOuFalhar(idSchema.safeParse(id))

  const corpo: unknown = await request.json().catch(() => null)
  const campos = validarOuFalhar(atualizarProdutoSchema.safeParse(corpo))

  const resultado = await atualizarProduto(productId, campos, {
    userId: usuario.userId,
    ip: ipDaRequest(request),
  })

  return ok(resultado)
})

/**
 * DELETE /api/admin/products/:id — ARQUIVAR, e só do OWNER.
 *
 * Mesma régua de `trips/[id]`: tirar da loja uma peça que o site publica é
 * decisão de quem responde pela empresa. E "tirar" é soft delete: as variantes
 * penduram nela e o carrinho de quem já adicionou aponta para o id.
 */
export const DELETE = rota(async (request: Request, contexto: Contexto) => {
  const owner = await exigirOwner(request)

  const { id } = await contexto.params
  const productId = validarOuFalhar(idSchema.safeParse(id))

  return ok(await arquivarProduto(productId, { userId: owner.userId, ip: ipDaRequest(request) }))
})
