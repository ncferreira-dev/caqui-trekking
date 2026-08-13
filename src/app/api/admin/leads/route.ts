import type { NextRequest } from 'next/server'

import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { paginacaoSchema, queryParaObjeto } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/leads
 *
 * `consentAt` vem na resposta de propósito: é o que diz se aquele contato pode
 * entrar numa campanha. Lead sem consentimento aparece na lista, mas com o
 * campo nulo — e o CRM precisa respeitar isso ao montar qualquer disparo.
 */
export const GET = rota(async (request: NextRequest) => {
  await exigirPapel(request, ['OWNER', 'ADMIN'])

  const url = new URL(request.url)
  const { limit, offset } = validarOuFalhar(paginacaoSchema.safeParse(queryParaObjeto(url)))

  const [leads, total, comConsentimento] = await Promise.all([
    prisma.lead.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        source: true,
        consentAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.lead.count(),
    prisma.lead.count({ where: { consentAt: { not: null } } }),
  ])

  return ok(
    { leads, podemReceberCampanha: comConsentimento },
    { meta: { total, limit, offset, hasMore: offset + leads.length < total } },
  )
})
