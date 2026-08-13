import { NextResponse } from 'next/server'

import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'

/**
 * Health check da aplicação e do banco.
 *
 * Nunca cacheado: um health check cacheado responde "ok" com o banco fora do
 * ar, que é exatamente o oposto do que ele existe para fazer.
 */
export const dynamic = 'force-dynamic'

type Estado = 'ok' | 'erro'

type HealthPayload = {
  status: Estado
  timestamp: string
  ambiente: string
  servicos: {
    app: { status: Estado }
    banco: { status: Estado; latenciaMs: number | null; erro?: string }
  }
}

export async function GET() {
  const inicio = performance.now()

  let bancoOk = false
  let latenciaMs: number | null = null
  let erroBanco: string | undefined

  try {
    await prisma.$queryRaw`SELECT 1`
    bancoOk = true
    latenciaMs = Math.round(performance.now() - inicio)
  } catch (erro) {
    // A mensagem real vai para o log do servidor; o cliente recebe uma
    // descrição genérica. O projeto de referência concatenava `error.message`
    // em toda resposta e entregava nome de model, campo e índice do banco
    // para quem chamasse (ver docs/00-analise-dalia.md, achado D22).
    console.error('[health] falha ao consultar o banco:', erro)
    erroBanco = 'não foi possível conectar ao banco'
  }

  const payload: HealthPayload = {
    status: bancoOk ? 'ok' : 'erro',
    timestamp: new Date().toISOString(),
    ambiente: env.NODE_ENV,
    servicos: {
      app: { status: 'ok' },
      banco: {
        status: bancoOk ? 'ok' : 'erro',
        latenciaMs,
        ...(erroBanco ? { erro: erroBanco } : {}),
      },
    },
  }

  // 503 quando o banco está fora: monitoramento externo precisa distinguir
  // "no ar" de "no ar e funcional". Devolver 200 com status:'erro' faz o
  // health check mentir para quem só olha o código HTTP.
  return NextResponse.json(payload, { status: bancoOk ? 200 : 503 })
}
