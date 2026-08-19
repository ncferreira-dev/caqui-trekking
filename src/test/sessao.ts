import { POST as loginRota } from '@/app/api/auth/login/route'
import { gerarHash } from '@/lib/auth/password'
import { prisma } from '@/lib/prisma'
import { limparBanco, post } from '@/test/fixtures'

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
        name: 'Dono da Caqui',
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

/**
 * ────────────────────────────────────────────────────────────────────────────
 * O LOGIN É UM RECURSO ESCASSO DENTRO DA SUÍTE INTEIRA
 * ────────────────────────────────────────────────────────────────────────────
 * `POST /api/auth/login` tem rate limit por IP, e o contador dele vive na
 * MEMÓRIA do processo (`lib/api/rate-limit.ts`). `limparBanco()` não o zera:
 * ele atravessa arquivos de teste, porque o vitest roda tudo no mesmo
 * processo. O orçamento é de 10 logins a cada 15 minutos para a suíte toda.
 *
 * Um `beforeEach` com dois logins e sete casos estoura sozinho, e o teste
 * falha por 429 em vez de falhar pelo que ele mede — que é a pior forma de
 * teste vermelho, porque ela não aponta para nada.
 *
 * A saída é `prepararCookies` abaixo: um login por papel, por ARQUIVO.
 */

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

/**
 * Cookies obtidos UMA vez por arquivo, sobrevivendo aos `limparBanco()`.
 *
 * Funciona porque o cookie carrega SÓ IDENTIDADE (mecanismo 7 da doutrina): o
 * papel e o status ativo são lidos do banco a cada requisição. Então basta que
 * o usuário volte a existir com o mesmo `id` depois do truncate — e ele volta,
 * porque `limparBanco` usa `RESTART IDENTITY` e `criarUsuarios` insere sempre
 * na mesma ordem, dando OWNER=1 e ADMIN=2 em toda execução.
 *
 * Uso:
 *
 *     beforeAll(async () => { cookies = await prepararCookies() })
 *     beforeEach(async () => {
 *       await limparBanco()
 *       await criarUsuarios()   // sem login: os ids voltam iguais
 *       f = await criarFixtures()
 *     })
 */
export async function prepararCookies(): Promise<{ OWNER: string; ADMIN: string }> {
  await limparBanco()
  // A ordem importa: `cookieDeLogin` cria os DOIS usuários na primeira
  // chamada, então o segundo login não recria nada e os ids ficam estáveis.
  const OWNER = await cookieDeLogin('OWNER')
  const ADMIN = await cookieDeLogin('ADMIN')
  return { OWNER, ADMIN }
}
