import { z } from 'zod'

import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { exigirPapel } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'
import {
  atualizarSettings,
  PLACEHOLDERS_VALIDOS,
} from '@/server/services/admin/content-admin-service'
import { ipDaRequest } from '@/server/services/audit-service'

export const dynamic = 'force-dynamic'

const settingsSchema = z.object({
  whatsappNumber: z
    .string()
    .regex(/^\d{12,13}$/, 'Só dígitos, com DDI e DDD. Ex.: 5511943017232')
    .optional(),
  whatsappMessageTemplate: z.string().min(10).max(2000).optional(),
  instagramTrekking: z.string().max(100).nullable().optional(),
  instagramWear: z.string().max(100).nullable().optional(),
  linktree: z.string().max(255).nullable().optional(),
  email: z.string().email().max(255).nullable().optional(),
  cadasturNumber: z.string().max(50).nullable().optional(),
  pesmCredentials: z.string().max(255).nullable().optional(),
  heroTitle: z.string().max(200).nullable().optional(),
  heroSubtitle: z.string().max(300).nullable().optional(),
  aboutText: z.string().max(5000).nullable().optional(),
})

/** GET /api/admin/settings — inclui a lista de placeholders válidos. */
export const GET = rota(async (request: Request) => {
  await exigirPapel(request, ['OWNER', 'ADMIN'])

  const settings = await prisma.siteSetting.findUnique({ where: { id: 1 } })

  return ok({ settings, placeholdersValidos: PLACEHOLDERS_VALIDOS })
})

/**
 * PUT /api/admin/settings
 *
 * O template da mensagem do WhatsApp é validado: placeholder desconhecido é
 * recusado com a lista do que existe. Um `{{iten}}` com erro de digitação
 * sairia literal na conversa com o cliente.
 */
export const PUT = rota(async (request: Request) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const corpo: unknown = await request.json().catch(() => null)
  const campos = validarOuFalhar(settingsSchema.safeParse(corpo))

  const resultado = await atualizarSettings(campos, {
    userId: usuario.userId,
    ip: ipDaRequest(request),
  })

  return ok(resultado)
})
