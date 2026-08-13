import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { consumirRateLimit } from '@/lib/api/rate-limit'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { contatoSchema } from '@/lib/api/schemas'
import { criarMensagemContato } from '@/server/services/captura-service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/contact
 *
 * Rate limit apertado: 5 por IP a cada 10 minutos. É formulário público, e o
 * projeto de referência tinha uma rota pública de escrita sem limite nenhum,
 * que um loop de curl usava para inflar a coleção até o banco recusar escrita.
 */
export const POST = rota(async (request: NextRequest) => {
  consumirRateLimit(request, { balde: 'contact', limite: 5, janelaMs: 10 * 60_000 })

  const corpo: unknown = await request.json().catch(() => null)
  const dados = validarOuFalhar(contatoSchema.safeParse(corpo))

  const { id } = await criarMensagemContato({
    nome: dados.nome,
    email: dados.email,
    telefone: dados.telefone,
    mensagem: dados.mensagem,
    tripSlug: dados.tripSlug,
  })

  return NextResponse.json(
    { data: { id, recebida: true } },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  )
})
