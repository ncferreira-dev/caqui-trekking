import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { consumirRateLimit } from '@/lib/api/rate-limit'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { leadSchema } from '@/lib/api/schemas'
import { criarLead } from '@/server/services/captura-service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/leads
 *
 * Captura com CONSENTIMENTO EXPLÍCITO: o schema exige `consentimento: true`.
 * Não existe lead capturado por padrão — ou a pessoa marcou a caixa, ou o
 * contato não pode virar campanha. É requisito de LGPD, e o `consentAt` grava
 * QUANDO, não só que sim.
 *
 * Uso principal: o "Avise-me" da saída esgotada.
 */
export const POST = rota(async (request: NextRequest) => {
  consumirRateLimit(request, { balde: 'leads', limite: 10, janelaMs: 10 * 60_000 })

  const corpo: unknown = await request.json().catch(() => null)
  const dados = validarOuFalhar(leadSchema.safeParse(corpo))

  const { id } = await criarLead({
    email: dados.email,
    telefone: dados.telefone,
    nome: dados.nome,
    origem: dados.origem,
    consentimento: dados.consentimento,
  })

  return NextResponse.json(
    { data: { id, registrado: true } },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  )
})
