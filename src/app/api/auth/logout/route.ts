import { ok } from '@/lib/api/respond'
import { rota } from '@/lib/api/route-handler'
import { lerSessaoDaRequest, limparCookieDeSessao } from '@/lib/auth/session'
import { encerrarSessoes } from '@/server/services/auth-service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/logout
 *
 * Apaga o cookie E incrementa o `tokenVersion` no banco, o que invalida TODOS
 * os tokens já emitidos para o usuário. É a diferença entre sair de verdade e
 * apenas limpar o próprio navegador: no projeto de referência, o logout era
 * `localStorage.removeItem`, e o token de um celular roubado continuava
 * abrindo a lista de clientes por até 7 dias.
 *
 * Responde 200 mesmo sem sessão: logout é idempotente, e informar "você não
 * estava logado" não ajuda ninguém.
 */
export const POST = rota(async (request: Request) => {
  const sessao = await lerSessaoDaRequest(request)

  if (sessao) {
    await encerrarSessoes(sessao.userId)
  }

  return limparCookieDeSessao(ok({ encerrada: true }))
})
