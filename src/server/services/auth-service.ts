import { AppError, ErrorCode } from '@/lib/api/errors'
import { queimarTempoDeHash, verificarSenha } from '@/lib/auth/password'
import { prisma } from '@/lib/prisma'

/**
 * Login com bloqueio progressivo persistido no banco.
 *
 * O rate limit por IP (em memória) e o bloqueio por conta (no banco) são
 * defesas diferentes e complementares: o primeiro barra um IP martelando, o
 * segundo barra um ataque distribuído contra UMA conta conhecida. O projeto de
 * referência não tinha nenhum dos dois no servidor — só um contador no
 * localStorage do navegador, que qualquer `curl` ignorava.
 */

const MAX_TENTATIVAS = 5
const BLOQUEIO_MINUTOS = 15

export type ResultadoLogin = {
  userId: number
  role: 'OWNER' | 'ADMIN'
  tokenVersion: number
  nome: string
  email: string
}

export async function autenticar(email: string, senha: string): Promise<ResultadoLogin> {
  const usuario = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      passwordHash: true,
      tokenVersion: true,
      failedLoginAttempts: true,
      lockedUntil: true,
    },
  })

  if (!usuario || !usuario.active) {
    // Gasta o mesmo tempo de um bcrypt real. Sem isto, a resposta para e-mail
    // inexistente volta perceptivelmente mais rápido, e isso permite enumerar
    // quais e-mails têm conta só cronometrando.
    await queimarTempoDeHash()
    throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'E-mail ou senha incorretos.', {
      status: 401,
    })
  }

  if (usuario.lockedUntil && usuario.lockedUntil > new Date()) {
    const minutos = Math.ceil((usuario.lockedUntil.getTime() - Date.now()) / 60_000)
    throw new AppError(
      ErrorCode.ACCOUNT_LOCKED,
      `Conta bloqueada por tentativas de acesso. Tente em ${minutos} min.`,
      { status: 423 },
    )
  }

  const senhaConfere = await verificarSenha(senha, usuario.passwordHash)

  if (!senhaConfere) {
    const tentativas = usuario.failedLoginAttempts + 1
    const bloquear = tentativas >= MAX_TENTATIVAS

    await prisma.user.update({
      where: { id: usuario.id },
      data: {
        failedLoginAttempts: bloquear ? 0 : tentativas,
        lockedUntil: bloquear ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60_000) : null,
      },
    })

    if (bloquear) {
      throw new AppError(
        ErrorCode.ACCOUNT_LOCKED,
        `Conta bloqueada por ${BLOQUEIO_MINUTOS} minutos após ${MAX_TENTATIVAS} tentativas.`,
        { status: 423 },
      )
    }

    // A mensagem é a MESMA de usuário inexistente, de propósito: não revela se
    // o e-mail existe.
    throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'E-mail ou senha incorretos.', {
      status: 401,
    })
  }

  await prisma.user.update({
    where: { id: usuario.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  })

  return {
    userId: usuario.id,
    role: usuario.role,
    tokenVersion: usuario.tokenVersion,
    nome: usuario.name,
    email: usuario.email,
  }
}

/**
 * Encerra TODAS as sessões do usuário.
 *
 * Incrementar o `tokenVersion` invalida no servidor todo token já emitido —
 * é o que faz o botão "Sair" ser verdade, inclusive para um aparelho perdido
 * que continua com a sessão aberta.
 */
export async function encerrarSessoes(userId: number): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  })
}
