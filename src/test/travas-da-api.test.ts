import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { AppError } from '@/lib/api/errors'
import { consumirRateLimit } from '@/lib/api/rate-limit'

/**
 * TRAVAS DAS ROTAS PÚBLICAS.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O BURACO, MEDIDO EM 18/08/2026
 * ════════════════════════════════════════════════════════════════════════════
 * As rotas públicas de ESCRITA (contato, leads) tinham teto desde sempre. As
 * de LEITURA não tinham nenhum: `/api/trips`, `/api/departures`,
 * `/api/products`, `/api/guides`, `/api/settings` e as duas de detalhe
 * respondiam sem limite a qualquer laço.
 *
 * Não é corrupção de dado, é conta: na Vercel cada chamada é invocação
 * cobrada, e no Neon é conexão ocupada.
 *
 * A varredura abaixo é o mecanismo: rota pública de leitura NOVA nasce
 * quebrando o teste, e não descoberta meses depois na fatura.
 */

const API = path.resolve(import.meta.dirname, '../app/api')

/**
 * `/api/admin/*` já é barrada pelo guard, e sessão é o limite.
 * `/api/auth/login` tem teto próprio, mais apertado, com bloqueio por conta.
 * `/api/health` fica de fora de propósito: monitor de uptime bate de minuto em
 * minuto e não pode tomar 429 justo quando a página está fora do ar.
 */
const FORA = ['/admin/', '/auth/', '/health/']

/** Tira as linhas de import: `import { x }` não é uso de `x`. */
function semImports(texto: string): string {
  return texto
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('import'))
    .join('\n')
}

function rotasPublicas(dir: string, acumulado: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = path.join(dir, nome)
    if (statSync(caminho).isDirectory()) rotasPublicas(caminho, acumulado)
    else if (nome === 'route.ts') acumulado.push(caminho)
  }
  return acumulado
}

describe('toda leitura pública tem teto', () => {
  it('nenhuma rota pública de GET fica sem limite', () => {
    const semTeto: string[] = []
    let olhadas = 0

    for (const arquivo of rotasPublicas(API)) {
      const relativo = arquivo.slice(API.length).replace(/\\/g, '/')
      if (FORA.some((f) => relativo.includes(f))) continue

      const texto = readFileSync(arquivo, 'utf8')
      if (!/export const GET\b/.test(texto)) continue

      olhadas += 1
      // A CHAMADA, e não a menção. A primeira versão procurava só o nome, e o
      // `import` sozinho já a satisfazia: apagar a chamada e deixar o import
      // (que é o que acontece quando alguém comenta uma linha) passava verde.
      // Foi pego por mutação, não por revisão.
      if (!/limitarLeituraPublica\s*\(/.test(semImports(texto))) semTeto.push(relativo)
    }

    // Sem este piso, a varredura passaria verde no dia em que o caminho da
    // pasta mudasse e ela deixasse de encontrar rota nenhuma.
    expect(olhadas).toBeGreaterThanOrEqual(7)
    expect(semTeto).toEqual([])
  })
})

describe('consumirRateLimit', () => {
  const requisicao = (ip: string) =>
    new Request('http://localhost:3000/api/teste', { headers: { 'x-forwarded-for': ip } })

  it('deixa passar até o limite e recusa o seguinte', () => {
    const balde = `teste-${Math.trunc(performance.now())}`
    const opcoes = { balde, limite: 3, janelaMs: 60_000 }

    for (let i = 0; i < 3; i++) {
      expect(() => consumirRateLimit(requisicao('1.1.1.1'), opcoes)).not.toThrow()
    }

    expect(() => consumirRateLimit(requisicao('1.1.1.1'), opcoes)).toThrow(AppError)
  })

  it('o balde é POR IP: um abusador não derruba os outros', () => {
    // O defeito oposto do que o teto existe para evitar: um contador global
    // faria o primeiro laço tirar o site do ar para todo mundo.
    const balde = `teste-ip-${Math.trunc(performance.now())}`
    const opcoes = { balde, limite: 1, janelaMs: 60_000 }

    consumirRateLimit(requisicao('2.2.2.2'), opcoes)
    expect(() => consumirRateLimit(requisicao('2.2.2.2'), opcoes)).toThrow()
    expect(() => consumirRateLimit(requisicao('3.3.3.3'), opcoes)).not.toThrow()
  })

  it('a mensagem diz em quantos segundos volta', () => {
    // 429 sem prazo faz quem consome tentar de novo na hora, em laço, que é
    // exatamente o comportamento que se quer cortar.
    const balde = `teste-msg-${Math.trunc(performance.now())}`
    const opcoes = { balde, limite: 1, janelaMs: 60_000 }

    consumirRateLimit(requisicao('4.4.4.4'), opcoes)
    try {
      consumirRateLimit(requisicao('4.4.4.4'), opcoes)
      throw new Error('devia ter recusado')
    } catch (erro) {
      expect((erro as AppError).message).toMatch(/\d+s/)
      expect((erro as AppError).status).toBe(429)
    }
  })
})
