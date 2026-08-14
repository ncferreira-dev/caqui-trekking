import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { atualizarProdutoSchema } from '@/lib/api/schema-produto'
import { idSchema } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { atualizarProduto } from '@/server/services/admin/product-admin-service'
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
