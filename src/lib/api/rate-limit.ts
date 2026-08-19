import { AppError, ErrorCode } from '@/lib/api/errors'
import { prisma } from '@/lib/prisma'

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
 * O teto das LEITURAS públicas.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * GENEROSO DE PROPÓSITO: ELE NÃO EXISTE PARA MODERAR USO
 * ────────────────────────────────────────────────────────────────────────────
 * As sete rotas públicas de leitura (`/api/trips`, `/api/departures`,
 * `/api/products`, `/api/guides`, `/api/settings` e as de detalhe) não tinham
 * teto nenhum. Nenhuma delas escreve, então o risco não é corrupção: é um
 * script ingênuo em laço puxando o catálogo inteiro algumas vezes por segundo,
 * o que na Vercel vira invocação cobrada e no Neon vira conexão ocupada.
 *
 * 240 por minuto é quatro por segundo, sustentado, por IP. Nenhuma pessoa
 * navegando chega perto; nenhum leitor de feed razoável chega perto. Quem
 * chega está em laço.
 *
 * As PÁGINAS do site não passam por aqui: elas chamam os serviços direto no
 * servidor (ver `agenda/page.tsx`). Então este teto só alcança consumidor
 * externo, que é exatamente quem ele deve alcançar.
 *
 * Em MEMÓRIA e não no banco, ao contrário do teto de escrita: uma linha
 * gravada por leitura seria o próprio abuso que se quer evitar. A limitação
 * disso está declarada no topo deste arquivo.
 */
export function limitarLeituraPublica(request: Request, balde: string): void {
  consumirRateLimit(request, { balde: `leitura:${balde}`, limite: 240, janelaMs: 60_000 })
}

/**
 * Rate limit PERSISTENTE, para as rotas públicas de ESCRITA (contato, leads).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTE EXISTE, SE JÁ HÁ O DE MEMÓRIA ACIMA
 * ────────────────────────────────────────────────────────────────────────────
 * O de memória reseta a cada cold start e é por instância: na Vercel, o limite
 * efetivo virava `limite × nº de instâncias`, e um loop de curl atravessava. As
 * duas rotas que ESCREVEM sem autenticação (contato e leads) precisam de um
 * teto que sobreviva a restart e seja compartilhado. O login não usa este — ele
 * já tem o bloqueio por conta no banco (auth-service); e o cart-validate não
 * usa porque só LÊ, e é chamado a cada toque de quantidade: uma escrita por
 * toque seria o abuso que estamos evitando.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * JANELA FIXA COM INCREMENTO ATÔMICO
 * ────────────────────────────────────────────────────────────────────────────
 * Uma linha por (chave, janelaInicio). O `increment` do Prisma compila para
 * `SET contagem = contagem + 1`, atômico sob o lock de linha do Postgres —
 * então dois pedidos concorrentes NÃO escapam pela brecha clássica do
 * "conta, depois insere". E um IP já bloqueado só incrementa o mesmo contador:
 * nem sob flood a tabela ganha linha nova, que é justamente a inflação que a
 * rota precisa impedir.
 *
 * A janela é FIXA, não deslizante: um atacante pode mandar `limite` no fim de
 * uma janela e `limite` no início da seguinte. Para um teto anti-abuso de
 * formulário isso é aceitável, e custa uma linha — não uma máquina de Redis.
 * O dia em que a força bruta virar o risco (não é o caso de um formulário de
 * contato), a troca é por um contador deslizante em Redis, sem mexer nas rotas.
 */
export async function consumirRateLimitPersistente(
  request: Request,
  opcoes: OpcoesRateLimit,
): Promise<void> {
  const agora = Date.now()
  const janelaInicio = BigInt(agora - (agora % opcoes.janelaMs))
  const chave = `${opcoes.balde}:${extrairIp(request)}`

  const { contagem } = await prisma.rateLimitBucket.upsert({
    where: { chave_janelaInicio: { chave, janelaInicio } },
    create: { chave, janelaInicio, contagem: 1 },
    update: { contagem: { increment: 1 } },
    select: { contagem: true },
  })

  if (contagem > opcoes.limite) {
    const segundos = Math.ceil((Number(janelaInicio) + opcoes.janelaMs - agora) / 1000)
    throw new AppError(
      ErrorCode.RATE_LIMITED,
      `Muitas requisições. Tente novamente em ${segundos}s.`,
      { status: 429 },
    )
  }

  // Poda oportunista: sem cron, a limpeza pega carona em ~2% dos pedidos e
  // apaga baldes de janelas já encerradas (todas as chaves que usam este
  // caminho compartilham o tamanho de janela, então `< janelaInicio` só
  // alcança janela passada). O índice em `janelaInicio` cobre o DELETE.
  if (Math.random() < 0.02) {
    await prisma.rateLimitBucket.deleteMany({ where: { janelaInicio: { lt: janelaInicio } } })
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
