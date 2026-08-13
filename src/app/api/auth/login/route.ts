import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { consumirRateLimit } from '@/lib/api/rate-limit'
import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { aplicarCookieDeSessao } from '@/lib/auth/session'
import { autenticar } from '@/server/services/auth-service'

export const dynamic = 'force-dynamic'

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  senha: z.string().min(1).max(200),
})

/**
 * POST /api/auth/login
 *
 * Duas defesas independentes contra força bruta:
 *  1. Rate limit por IP (aqui) — barra um IP martelando.
 *  2. Bloqueio por conta no banco (auth-service) — barra ataque distribuído
 *     contra uma conta conhecida, e sobrevive a restart e troca de instância.
 *
 * O projeto de referência não tinha nenhuma das duas no servidor: o "3
 * tentativas → 10 min" vivia no localStorage do navegador.
 */
export const POST = rota(async (request: NextRequest) => {
  consumirRateLimit(request, { balde: 'login', limite: 10, janelaMs: 15 * 60_000 })

  const corpo: unknown = await request.json().catch(() => null)
  const { email, senha } = validarOuFalhar(loginSchema.safeParse(corpo))

  const usuario = await autenticar(email, senha)

  // O token NÃO vai no corpo. Ele vive só no cookie httpOnly, fora do alcance
  // de qualquer JavaScript da página.
  const resposta = ok({ nome: usuario.nome, email: usuario.email, role: usuario.role })

  return aplicarCookieDeSessao(resposta, {
    userId: usuario.userId,
    role: usuario.role,
    tokenVersion: usuario.tokenVersion,
  })
})
