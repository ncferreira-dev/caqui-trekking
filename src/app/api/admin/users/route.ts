import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { AppError, ErrorCode } from '@/lib/api/errors'
import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { exigirOwner } from '@/lib/auth/guard'
import { gerarHash } from '@/lib/auth/password'
import { prisma } from '@/lib/prisma'
import { ipDaRequest, registrarAuditoria } from '@/server/services/audit-service'

export const dynamic = 'force-dynamic'

/**
 * Gestão de usuários — **exclusiva do OWNER**.
 *
 * É a única diferença de permissão entre os dois papéis: ADMIN faz tudo, menos
 * criar e gerenciar usuários. Quem pode criar usuário pode criar outro OWNER e
 * se tornar irremovível — por isso a porta é mais estreita.
 */

const criarSchema = z.object({
  nome: z.string().trim().min(2).max(150),
  email: z.string().trim().toLowerCase().email().max(255),
  senha: z.string().min(12, 'A senha precisa ter pelo menos 12 caracteres.').max(200),
  role: z.enum(['OWNER', 'ADMIN']).default('ADMIN'),
})

/** GET /api/admin/users — nunca devolve `passwordHash`. */
export const GET = rota(async (request: Request) => {
  await exigirOwner(request)

  const usuarios = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      lastLoginAt: true,
      lockedUntil: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  return ok(usuarios)
})

export const POST = rota(async (request: NextRequest) => {
  const owner = await exigirOwner(request)

  const corpo: unknown = await request.json().catch(() => null)
  const dados = validarOuFalhar(criarSchema.safeParse(corpo))

  const jaExiste = await prisma.user.findUnique({
    where: { email: dados.email },
    select: { id: true },
  })

  if (jaExiste) {
    throw new AppError(ErrorCode.CONFLICT, 'Já existe um usuário com este e-mail.', { status: 409 })
  }

  const criado = await prisma.$transaction(async (tx) => {
    const usuario = await tx.user.create({
      data: {
        name: dados.nome,
        email: dados.email,
        passwordHash: await gerarHash(dados.senha),
        role: dados.role,
      },
      select: { id: true, name: true, email: true, role: true },
    })

    await registrarAuditoria(
      {
        userId: owner.userId,
        action: 'user.create',
        entityType: 'User',
        entityId: usuario.id,
        // A senha e o hash NÃO entram na auditoria. O registro guarda o que
        // aconteceu, não a credencial.
        after: { email: usuario.email, role: usuario.role },
        ip: ipDaRequest(request),
      },
      tx,
    )

    return usuario
  })

  return ok(criado)
})
