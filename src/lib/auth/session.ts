import { jwtVerify, SignJWT } from 'jose'

import { env } from '@/lib/env'

/**
 * Sessão em cookie httpOnly assinado.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE COOKIE httpOnly E NÃO localStorage
 * ────────────────────────────────────────────────────────────────────────────
 * O projeto de referência guardava o JWT em `localStorage`, com validade de
 * 7 dias. `localStorage` é legível por qualquer JavaScript da origem: um único
 * XSS entrega uma credencial administrativa válida por uma semana. E o
 * "logout" era `localStorage.removeItem` — puramente local, sem nada do lado
 * do servidor, então o token de um celular roubado continuava abrindo a lista
 * de clientes mesmo depois de a pessoa "sair" em outro aparelho.
 *
 * Aqui:
 *  - `httpOnly`: JavaScript da página não lê o cookie. XSS não rouba a sessão.
 *  - `secure`: só trafega em HTTPS (desligado em dev, onde não há TLS).
 *  - `sameSite: 'strict'`: o cookie não acompanha requisição vinda de outro
 *    site, o que fecha CSRF nas rotas do CRM.
 *  - 8 horas de validade, não 7 dias. É um turno de trabalho.
 *  - `tokenVersion` no payload: o logout incrementa a versão no banco e todo
 *    token emitido antes para de valer. "Sair" passa a ser verdade.
 */

const NOME_COOKIE = 'caqui_sessao'
const DURACAO_SEGUNDOS = 8 * 60 * 60

export type Sessao = {
  userId: number
  role: 'OWNER' | 'ADMIN'
  tokenVersion: number
}

function chave(): Uint8Array {
  return new TextEncoder().encode(env.AUTH_SECRET)
}

export async function assinarSessao(sessao: Sessao): Promise<string> {
  return new SignJWT({ role: sessao.role, tv: sessao.tokenVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(sessao.userId))
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SEGUNDOS}s`)
    .sign(chave())
}

export async function lerToken(token: string): Promise<Sessao | null> {
  try {
    const { payload } = await jwtVerify(token, chave(), { algorithms: ['HS256'] })

    const userId = Number(payload.sub)
    const role = payload['role']
    const tv = payload['tv']

    if (!Number.isInteger(userId) || userId <= 0) return null
    if (role !== 'OWNER' && role !== 'ADMIN') return null
    if (typeof tv !== 'number') return null

    return { userId, role, tokenVersion: tv }
  } catch {
    // Token expirado, assinatura inválida, algoritmo trocado — tudo é
    // "sem sessão". O motivo não vai para o cliente.
    return null
  }
}

type OpcoesCookie = {
  httpOnly: true
  secure: boolean
  sameSite: 'strict'
  path: string
  maxAge: number
}

function opcoes(maxAge: number): OpcoesCookie {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge,
  }
}

/**
 * Aplica o cookie de sessão na RESPOSTA, em vez de usar o cookie jar global do
 * `next/headers`.
 *
 * Duas razões: o jar exige escopo de requisição, o que torna o handler
 * impossível de chamar direto num teste; e escrever na resposta deixa
 * explícito, ao ler a rota, que ali nasce uma sessão.
 */
export async function aplicarCookieDeSessao<
  T extends { cookies: { set: (n: string, v: string, o: OpcoesCookie) => unknown } },
>(resposta: T, sessao: Sessao): Promise<T> {
  const token = await assinarSessao(sessao)
  resposta.cookies.set(NOME_COOKIE, token, opcoes(DURACAO_SEGUNDOS))
  return resposta
}

export function limparCookieDeSessao<
  T extends { cookies: { set: (n: string, v: string, o: OpcoesCookie) => unknown } },
>(resposta: T): T {
  resposta.cookies.set(NOME_COOKIE, '', opcoes(0))
  return resposta
}

/** Lê a sessão de uma Request — usado quando não há acesso ao cookie jar. */
export async function lerSessaoDaRequest(request: Request): Promise<Sessao | null> {
  const header = request.headers.get('cookie')
  if (!header) return null

  const token = header
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${NOME_COOKIE}=`))
    ?.slice(NOME_COOKIE.length + 1)

  if (!token) return null
  return lerToken(decodeURIComponent(token))
}

export const NOME_COOKIE_SESSAO = NOME_COOKIE
