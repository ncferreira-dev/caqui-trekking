import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { _resetRateLimit } from '@/lib/api/rate-limit'
import { prisma } from '@/lib/prisma'
import { AUTORIZACAO, type ChaveDeRota, type Metodo, type Papel } from '@/server/autorizacao'
import { criarFixtures, limparBanco } from '@/test/fixtures'
import { cookieDeLogin } from '@/test/sessao'

/**
 * A TABELA DE AUTORIZAÇÃO, CONFRONTADA COM O DISCO.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * NASCEU FALHANDO EM 14/08/2026
 * ────────────────────────────────────────────────────────────────────────────
 * Antes deste arquivo existia só a varredura de `auth.test.ts`, que exige 401
 * de toda rota admin sem sessão. Ela pega rota nascendo PÚBLICA e não pega
 * rota nascendo com o PAPEL ERRADO — uma rota de usuários aceitando ADMIN
 * passa naquela varredura com folga, porque recusa quem não tem sessão
 * exatamente como manda.
 *
 * Este teste foi escrito antes das rotas novas do PROMPT 10 e falhou como
 * esperado: `departures/[id]/cancel`, `trips` e `products` estavam na tabela e
 * não existiam no disco. Se voltar a falhar, é regressão, não novidade.
 *
 * O que ele quebra:
 *
 *   1. Rota no disco sem entrada na tabela.
 *   2. Entrada na tabela sem rota no disco.
 *   3. Papel que a tabela nega e o handler aceita.
 *   4. Papel que a tabela permite e o handler nega.
 *
 * O (4) importa tanto quanto o (3): guard apertado demais quebra a operação
 * diária, e ninguém percebe até a Caqui tentar mudar disponibilidade do
 * celular num sábado e receber 403.
 */

const RAIZ = path.resolve(import.meta.dirname, '../app/api/admin')
const METODOS: readonly Metodo[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

type Handler = (req: Request, ctx?: unknown) => Promise<Response>

function encontrarRotas(dir: string, achadas: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const caminho = path.join(dir, entrada)
    if (statSync(caminho).isDirectory()) encontrarRotas(caminho, achadas)
    else if (entrada === 'route.ts') achadas.push(caminho)
  }
  return achadas
}

/** `…/admin/trips/[id]/route.ts` → `trips/[id]`. */
function chaveDe(arquivo: string): ChaveDeRota {
  return path
    .relative(RAIZ, arquivo)
    .replace(/\/route\.ts$/, '')
    .replace(/^route\.ts$/, '')
}

const ARQUIVOS = encontrarRotas(RAIZ)

let cookieOwner = ''
let cookieAdmin = ''

beforeEach(async () => {
  await limparBanco()
  _resetRateLimit()
  await criarFixtures()
  cookieOwner = await cookieDeLogin('OWNER')
  cookieAdmin = await cookieDeLogin('ADMIN')
})

afterAll(async () => {
  await prisma.$disconnect()
})

function requisicao(caminho: string, metodo: Metodo, cookie: string): Request {
  const corpo = metodo === 'GET' || metodo === 'DELETE' ? undefined : JSON.stringify({})
  return new Request(`http://localhost:3000/api/admin/${caminho}`, {
    method: metodo,
    headers: { cookie, 'content-type': 'application/json' },
    ...(corpo ? { body: corpo } : {}),
  })
}

/** `[id]` vira `1` — o handler só precisa chegar no guard. */
function ctxDe(chave: string) {
  const params: Record<string, string> = {}
  for (const parte of chave.split('/')) {
    const m = /^\[(.+)\]$/.exec(parte)
    if (m?.[1]) params[m[1]] = '1'
  }
  return { params: Promise.resolve(params) }
}

// =============================================================================
describe('a tabela e o disco não divergem', () => {
  it('toda rota no disco tem entrada na tabela', () => {
    const semEntrada = ARQUIVOS.map(chaveDe).filter((c) => !(c in AUTORIZACAO))

    expect(
      semEntrada,
      `Rota administrativa sem entrada em src/server/autorizacao.ts. ` +
        `Decida por escrito quem pode chamar antes de publicar.`,
    ).toEqual([])
  })

  it('toda entrada na tabela existe no disco', () => {
    const noDisco = new Set(ARQUIVOS.map(chaveDe))
    const orfas = Object.keys(AUTORIZACAO).filter((c) => !noDisco.has(c))

    expect(
      orfas,
      'Entrada na tabela para rota que não existe. Tabela envelhecida é pior que tabela nenhuma.',
    ).toEqual([])
  })

  it('todo método exportado tem papel declarado', async () => {
    const faltando: string[] = []

    for (const arquivo of ARQUIVOS) {
      const chave = chaveDe(arquivo)
      const modulo = (await import(/* @vite-ignore */ arquivo)) as Record<string, unknown>

      for (const metodo of METODOS) {
        if (typeof modulo[metodo] !== 'function') continue
        if (!AUTORIZACAO[chave]?.[metodo]) faltando.push(`${metodo} ${chave}`)
      }
    }

    expect(faltando).toEqual([])
  })

  it('todo papel declarado corresponde a um método exportado', async () => {
    const sobrando: string[] = []

    for (const arquivo of ARQUIVOS) {
      const chave = chaveDe(arquivo)
      const modulo = (await import(/* @vite-ignore */ arquivo)) as Record<string, unknown>

      for (const metodo of METODOS) {
        if (!AUTORIZACAO[chave]?.[metodo]) continue
        if (typeof modulo[metodo] !== 'function') sobrando.push(`${metodo} ${chave}`)
      }
    }

    expect(sobrando).toEqual([])
  })
})

// =============================================================================
describe('o comportamento obedece a tabela', () => {
  const casos: { chave: ChaveDeRota; metodo: Metodo; papeis: readonly Papel[] }[] = []

  for (const [chave, regra] of Object.entries(AUTORIZACAO)) {
    for (const metodo of METODOS) {
      const papeis = regra[metodo]
      if (papeis) casos.push({ chave, metodo, papeis })
    }
  }

  for (const { chave, metodo, papeis } of casos) {
    const permitidos = papeis.join('+')

    it(`${metodo} /api/admin/${chave || '·'} → ${permitidos}`, async () => {
      const arquivo = path.join(RAIZ, chave, 'route.ts')
      const modulo = (await import(/* @vite-ignore */ arquivo)) as Record<string, Handler>
      const handler = modulo[metodo]
      if (!handler) throw new Error(`sem handler ${metodo} em ${chave}`)

      for (const papel of ['OWNER', 'ADMIN'] as const) {
        const cookie = papel === 'OWNER' ? cookieOwner : cookieAdmin
        const res = await handler(requisicao(chave, metodo, cookie), ctxDe(chave))

        if (papeis.includes(papel)) {
          // Pode dar 400 (corpo vazio), 404 (id 1 inexistente), 409… O que NÃO
          // pode é 403: isso significaria guard apertado demais, e quem
          // descobre é a Caqui num sábado, do celular.
          expect(res.status, `${papel} deveria poder ${metodo} ${chave}, mas levou 403`).not.toBe(
            403,
          )
        } else {
          expect(
            res.status,
            `${papel} NÃO deveria poder ${metodo} ${chave}, mas passou do guard`,
          ).toBe(403)
        }

        // Em nenhum caso a resposta pode ser 401: os dois têm sessão válida.
        expect(res.status, `${papel} tem sessão; 401 aqui é bug de guard`).not.toBe(401)
      }
    })
  }
})
