import { z } from 'zod'

import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { idSchema } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { arquivarTrip, atualizarTrip } from '@/server/services/admin/content-admin-service'
import { ipDaRequest } from '@/server/services/audit-service'

export const dynamic = 'force-dynamic'

type Contexto = { params: Promise<{ id: string }> }

const atualizarSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    subtitle: z.string().trim().max(300).nullable().optional(),
    description: z.string().trim().min(10).optional(),
    city: z.string().trim().min(2).max(120).optional(),
    state: z.string().trim().length(2).optional(),
    region: z.string().trim().max(120).nullable().optional(),
    difficulty: z.enum(['FACIL', 'MODERADO', 'DIFICIL', 'EXTREMO']).optional(),
    // Decimal com vírgula ou ponto vira string "8.50" — é o formato que o Prisma
    // aceita para a coluna Decimal sem passar por ponto flutuante. O regex barra
    // texto livre; o serviço grava como está.
    distanceKm: z
      .string()
      .regex(/^\d{1,3}([.,]\d{1,2})?$/, 'Distância em km, ex.: 8.5')
      .transform((s) => s.replace(',', '.'))
      .nullable()
      .optional(),
    elevationGainM: z.number().int().min(0).nullable().optional(),
    maxAltitudeM: z.number().int().min(0).nullable().optional(),
    durationMinutes: z.number().int().min(0).nullable().optional(),
    minAge: z.number().int().min(0).max(120).nullable().optional(),
    requiresExperience: z.boolean().optional(),
    highlights: z.array(z.string().trim().max(200)).max(20).optional(),
    included: z.array(z.string().trim().max(200)).max(30).optional(),
    notIncluded: z.array(z.string().trim().max(200)).max(30).optional(),
    whatToBring: z.array(z.string().trim().max(200)).max(30).optional(),
    cancellationPolicy: z.string().trim().max(5000).nullable().optional(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
    featured: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .strict()

/**
 * PATCH /api/admin/trips/:id — editar, publicar, arquivar, destacar, reordenar.
 *
 * O `slug` NÃO está no schema, de propósito: ele é a URL canônica e mudá-lo
 * quebra o ranking de busca e todo link já compartilhado no WhatsApp. Trocar
 * slug precisa ser operação explícita, com redirect 301 — não um efeito
 * colateral de renomear o título.
 */
export const PATCH = rota(async (request: Request, contexto: Contexto) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const { id } = await contexto.params
  const tripId = validarOuFalhar(idSchema.safeParse(id))

  const corpo: unknown = await request.json().catch(() => null)
  const campos = validarOuFalhar(atualizarSchema.safeParse(corpo))

  const resultado = await atualizarTrip(tripId, campos, {
    userId: usuario.userId,
    ip: ipDaRequest(request),
  })

  return ok(resultado)
})

/**
 * DELETE /api/admin/trips/:id — soft delete.
 *
 * Só OWNER: apagar um roteiro afeta o histórico e as saídas ligadas a ele.
 * Nunca hard delete — o registro é arquivado com `deletedAt`.
 */
export const DELETE = rota(async (request: Request, contexto: Contexto) => {
  const usuario = await exigirPapel(request, ['OWNER'])

  const { id } = await contexto.params
  const tripId = validarOuFalhar(idSchema.safeParse(id))

  const resultado = await arquivarTrip(tripId, {
    userId: usuario.userId,
    ip: ipDaRequest(request),
  })

  return ok(resultado)
})
