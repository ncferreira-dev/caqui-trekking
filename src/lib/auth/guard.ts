import { AppError, ErrorCode } from '@/lib/api/errors'
import { lerSessaoDaRequest, type Sessao } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

/**
 * Guardas de autenticação e autorização.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * OS 5 TOQUES NA LOGO NÃO SÃO SEGURANÇA
 * ────────────────────────────────────────────────────────────────────────────
 * O gesto apenas REVELA a rota do CRM. `/crm` e toda rota `/api/admin/*`
 * precisam estar tão protegidas quanto estariam se houvesse um link "Entrar"
 * no menu principal. Segurança por obscuridade não é segurança — e o projeto
 * de referência ilustra bem o ponto: escondia o botão e depois listava
 * `/login`, `/dashboard`, `/clients` e `/admin/` no `robots.txt`, público
 * para qualquer um ler.
 *
 * A barreira real é esta função, aplicada rota a rota.
 */

export type Autenticado = {
  userId: number
  role: 'OWNER' | 'ADMIN'
  nome: string
  email: string
}

/**
 * Exige sessão válida.
 *
 * Confere a assinatura do cookie E o estado atual do usuário no banco. Não
 * basta o token ser válido: se a conta foi desativada ou o `tokenVersion`
 * mudou (logout, troca de senha), a sessão morre na hora.
 *
 * 401 = sem sessão ou expirada → o front desloga.
 * 403 = autenticado, mas sem permissão → o front mostra "sem acesso".
 * No projeto de referência, `UNAUTHORIZED` devolvia 403, e por isso o front
 * não distinguia sessão expirada de falta de permissão.
 */
export async function exigirAutenticacao(request: Request): Promise<Autenticado> {
  const sessao: Sessao | null = await lerSessaoDaRequest(request)

  if (!sessao) {
    throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sessão inválida ou expirada.', { status: 401 })
  }

  const usuario = await prisma.user.findUnique({
    where: { id: sessao.userId },
    select: { id: true, name: true, email: true, role: true, active: true, tokenVersion: true },
  })

  if (!usuario || !usuario.active) {
    throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sessão inválida ou expirada.', { status: 401 })
  }

  // Token emitido antes do último logout / troca de senha.
  if (usuario.tokenVersion !== sessao.tokenVersion) {
    throw new AppError(ErrorCode.UNAUTHENTICATED, 'Sessão encerrada. Entre novamente.', {
      status: 401,
    })
  }

  // O papel vem do BANCO, não do token. Rebaixar alguém de OWNER para ADMIN
  // passa a valer na requisição seguinte, sem esperar o token expirar.
  return { userId: usuario.id, role: usuario.role, nome: usuario.name, email: usuario.email }
}

/**
 * Exige um papel específico.
 *
 * OWNER faz tudo. ADMIN faz tudo menos gerenciar usuários.
 */
export async function exigirPapel(
  request: Request,
  papeis: readonly ('OWNER' | 'ADMIN')[],
): Promise<Autenticado> {
  const usuario = await exigirAutenticacao(request)

  if (!papeis.includes(usuario.role)) {
    throw new AppError(ErrorCode.FORBIDDEN, 'Você não tem permissão para esta operação.', {
      status: 403,
    })
  }

  return usuario
}

/** Atalho para rotas que só o OWNER pode acessar. */
export async function exigirOwner(request: Request): Promise<Autenticado> {
  return exigirPapel(request, ['OWNER'])
}
