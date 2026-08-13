import { AppError, ErrorCode } from '@/lib/api/errors'

/**
 * Rate limit por IP, em memória, com janela deslizante.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LIMITAÇÃO CONHECIDA, DECLARADA DE PROPÓSITO
 * ────────────────────────────────────────────────────────────────────────────
 * O contador vive na memória do processo. Em serverless com várias instâncias
 * (Vercel), cada instância tem o seu, então o limite efetivo é
 * `limite × nº de instâncias`. Isso segura abuso casual e script ingênuo, mas
 * não um atacante determinado.
 *
 * A substituição correta é um contador compartilhado (Upstash Redis ou
 * equivalente) e entra junto com o rate limit do login, no PROMPT 04 — onde a
 * força bruta é o risco real.
 *
 * O que NÃO se faz aqui, e é o ponto: o projeto de referência anunciava
 * "3 tentativas → bloqueio de 10 min" com o contador no `localStorage` do
 * NAVEGADOR. Um `curl` em loop nunca via o bloqueio, e `localStorage.clear()`
 * zerava tudo. Controle que o cliente pode apagar não é controle. Este aqui é
 * fraco por escala, não por estar do lado errado.
 */

type Janela = { contagem: number; expiraEm: number }

const janelas = new Map<string, Janela>()

/** Remove janelas expiradas para o Map não crescer sem limite. */
function limpar(agora: number): void {
  if (janelas.size < 5_000) return
  for (const [chave, janela] of janelas) {
    if (janela.expiraEm <= agora) janelas.delete(chave)
  }
}

export type OpcoesRateLimit = {
  /** Identificador do balde, normalmente o nome da rota. */
  balde: string
  limite: number
  janelaMs: number
}

/**
 * Consome uma unidade do balde. Lança RATE_LIMITED (429) ao estourar.
 */
export function consumirRateLimit(request: Request, opcoes: OpcoesRateLimit): void {
  const agora = Date.now()
  limpar(agora)

  const chave = `${opcoes.balde}:${extrairIp(request)}`
  const janela = janelas.get(chave)

  if (!janela || janela.expiraEm <= agora) {
    janelas.set(chave, { contagem: 1, expiraEm: agora + opcoes.janelaMs })
    return
  }

  janela.contagem += 1

  if (janela.contagem > opcoes.limite) {
    const segundos = Math.ceil((janela.expiraEm - agora) / 1000)
    throw new AppError(
      ErrorCode.RATE_LIMITED,
      `Muitas requisições. Tente novamente em ${segundos}s.`,
      { status: 429 },
    )
  }
}

/**
 * IP da requisição.
 *
 * `x-forwarded-for` é enviado pelo cliente e portanto forjável. Confiamos nele
 * apenas porque em produção a Vercel sobrescreve o header na borda. O projeto
 * de referência usava `app.set('trust proxy', true)`, que aceita o valor mais
 * à esquerda que o cliente escrever — inutilizando o próprio log.
 */
function extrairIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const primeiro = forwarded.split(',')[0]?.trim()
    if (primeiro) return primeiro
  }
  return request.headers.get('x-real-ip') ?? 'desconhecido'
}

/** Só para os testes: zera o estado entre casos. */
export function _resetRateLimit(): void {
  janelas.clear()
}
