import { POST as loginRota } from '@/app/api/auth/login/route'
import { gerarHash } from '@/lib/auth/password'
import { prisma } from '@/lib/prisma'
import { post } from '@/test/fixtures'

/**
 * Sessões de teste, num lugar só.
 *
 * `auth.test.ts` já criava os dois usuários e fazia login à mão. Quando
 * `autorizacao.test.ts` precisou do mesmo, a escolha era duplicar (e as duas
 * cópias divergirem na primeira mudança de senha ou de papel) ou extrair.
 *
 * O login acontece pela ROTA de verdade, não montando o cookie na mão. Um
 * cookie forjado testaria a assinatura do teste, não a do sistema — e é
 * exatamente o caminho que precisa estar coberto.
 */

export const SENHAS = {
  OWNER: 'senha-de-teste-owner',
  ADMIN: 'senha-de-teste-admin',
} as const

export const EMAILS = {
  OWNER: 'owner@caqui.test',
  ADMIN: 'admin@caqui.test',
} as const

/** Cria os dois usuários do CRM. Chame depois de `limparBanco()`. */
export async function criarUsuarios(): Promise<void> {
  await prisma.user.createMany({
    data: [
      {
        name: 'Dona da Caqui',
        email: EMAILS.OWNER,
        passwordHash: await gerarHash(SENHAS.OWNER),
        role: 'OWNER',
      },
      {
        name: 'Guia Admin',
        email: EMAILS.ADMIN,
        passwordHash: await gerarHash(SENHAS.ADMIN),
        role: 'ADMIN',
      },
    ],
  })
}

/** Cria o usuário se faltar, loga, e devolve o cookie `nome=valor`. */
export async function cookieDeLogin(papel: 'OWNER' | 'ADMIN'): Promise<string> {
  const email = EMAILS[papel]

  const existe = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!existe) await criarUsuarios()

  const res = await loginRota(post('/api/auth/login', { email, senha: SENHAS[papel] }) as never)
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) throw new Error(`login de ${papel} falhou: ${res.status} ${await res.text()}`)

  return setCookie.split(';')[0] ?? ''
}
