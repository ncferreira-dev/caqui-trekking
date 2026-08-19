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

  // ══════════════════════════════════════════════════════════════════════════
  // A SENHA É CONFERIDA ANTES DO BLOQUEIO, E ISSO É A CORREÇÃO DE 18/08/2026
  // ══════════════════════════════════════════════════════════════════════════
  // Antes, o bloqueio era conferido primeiro e respondia 423 ACCOUNT_LOCKED.
  // Duas consequências saíam daí, e as duas são sérias:
  //
  //  1. VIRAVA UM ORÁCULO. E-mail sem conta responde 401 sempre; e-mail com
  //     conta responde 423 na quinta tentativa. Ou seja, o status dizia quais
  //     e-mails têm acesso ao CRM. O comentário logo abaixo afirmava o
  //     contrário ("a mensagem é a MESMA de usuário inexistente"), e a
  //     mensagem era mesmo; o STATUS não.
  //
  //  2. QUALQUER PESSOA TRANCAVA A CAQUI PARA FORA DO PRÓPRIO CRM. Cinco
  //     requisições a cada quinze minutos, de um IP só, sem sessão. O e-mail
  //     necessário não é segredo: é o comercial, publicado no rodapé do site e
  //     em `GET /api/settings`. E não existe recuperação de senha no sistema,
  //     então não havia saída pelo produto: só esperar, ou mexer no banco. No
  //     sábado de manhã, com o grupo no ponto de encontro, o painel não abriria.
  //
  // Agora o bloqueio barra apenas quem NÃO sabe a senha, que é exatamente o
  // ataque que ele existe para conter. A taxa de adivinhação não mudou: cinco
  // tentativas por janela continuam sendo cinco tentativas por janela, porque
  // durante o bloqueio a tentativa errada nem é contada, e portanto também não
  // renova a janela.
  const senhaConfere = await verificarSenha(senha, usuario.passwordHash)
  const bloqueado = usuario.lockedUntil !== null && usuario.lockedUntil > new Date()

  if (!senhaConfere) {
    // Durante o bloqueio a tentativa não conta. Sem isso, quem ataca renova a
    // janela para sempre e o bloqueio vira a própria negação de serviço.
    if (!bloqueado) {
      const tentativas = usuario.failedLoginAttempts + 1
      const bloquear = tentativas >= MAX_TENTATIVAS

      await prisma.user.update({
        where: { id: usuario.id },
        data: {
          failedLoginAttempts: bloquear ? 0 : tentativas,
          lockedUntil: bloquear ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60_000) : null,
        },
      })
    }

    // UMA resposta só para todo fracasso: e-mail que não existe, conta
    // desativada, senha errada, conta bloqueada. Mesmo status, mesmo código,
    // mesma mensagem, mesmo tempo. É o que fecha o oráculo de verdade.
    throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'E-mail ou senha incorretos.', {
      status: 401,
    })
  }

  // Senha certa: entra, o contador zera e o bloqueio some, mesmo que estivesse
  // ativo. Quem sabe a senha é a dona do CRM; mantê-la de fora só serviria a
  // quem trancou a porta de propósito.
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
