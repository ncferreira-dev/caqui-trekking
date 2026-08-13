import { ok } from '@/lib/api/respond'
import { rota } from '@/lib/api/route-handler'
import { exigirAutenticacao } from '@/lib/auth/guard'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/me
 *
 * Quem está logado. Devolve 401 sem sessão — e é 401 mesmo, não 403, para o
 * front conseguir distinguir "faça login" de "sem permissão".
 */
export const GET = rota(async (request: Request) => {
  const usuario = await exigirAutenticacao(request)

  return ok({ nome: usuario.nome, email: usuario.email, role: usuario.role })
})
