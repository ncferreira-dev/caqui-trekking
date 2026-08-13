import { AppError, ErrorCode } from '@/lib/api/errors'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/server/services/audit-service'

/**
 * Mutações de conteúdo: Trip, Product, ProductVariant e SiteSetting.
 *
 * Toda função aqui grava AuditLog com before/after, na mesma transação da
 * escrita. Sem exceção — é requisito do projeto, e o valor prático aparece
 * quando alguém pergunta "quem mudou o preço desta expedição, e quando?".
 */

type Contexto = { userId: number; ip: string | null }

// ─── Trip ────────────────────────────────────────────────────────────────────

export type CamposTrip = {
  title?: string
  subtitle?: string | null
  description?: string
  city?: string
  state?: string
  region?: string | null
  difficulty?: 'FACIL' | 'MODERADO' | 'DIFICIL' | 'EXTREMO'
  distanceKm?: string | null
  elevationGainM?: number | null
  maxAltitudeM?: number | null
  durationMinutes?: number | null
  minAge?: number | null
  requiresExperience?: boolean
  highlights?: string[]
  included?: string[]
  notIncluded?: string[]
  whatToBring?: string[]
  cancellationPolicy?: string | null
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  featured?: boolean
  sortOrder?: number
}

export async function atualizarTrip(
  tripId: number,
  campos: CamposTrip,
  ctx: Contexto,
): Promise<{ id: number }> {
  const antes = await prisma.trip.findFirst({
    where: { id: tripId, deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      difficulty: true,
      featured: true,
      sortOrder: true,
    },
  })

  if (!antes) {
    throw new AppError(ErrorCode.TRIP_NOT_FOUND, 'Roteiro não encontrado.', { status: 404 })
  }

  return prisma.$transaction(async (tx) => {
    const depois = await tx.trip.update({
      where: { id: tripId },
      data: campos,
      select: {
        id: true,
        title: true,
        status: true,
        difficulty: true,
        featured: true,
        sortOrder: true,
      },
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'trip.update',
        entityType: 'Trip',
        entityId: tripId,
        before: antes,
        after: depois,
        ip: ctx.ip,
      },
      tx,
    )

    return { id: depois.id }
  })
}

/**
 * Soft delete. Nunca hard delete.
 *
 * Uma Trip descontinuada é arquivada, não apagada — senão as saídas dela ficam
 * órfãs, exatamente como o projeto de referência produzia ao apagar um produto
 * e deixar movimentações apontando para um id inexistente.
 */
export async function arquivarTrip(tripId: number, ctx: Contexto): Promise<{ id: number }> {
  const antes = await prisma.trip.findFirst({
    where: { id: tripId, deletedAt: null },
    select: { id: true, status: true },
  })

  if (!antes) {
    throw new AppError(ErrorCode.TRIP_NOT_FOUND, 'Roteiro não encontrado.', { status: 404 })
  }

  return prisma.$transaction(async (tx) => {
    const depois = await tx.trip.update({
      where: { id: tripId },
      data: { status: 'ARCHIVED', deletedAt: new Date() },
      select: { id: true },
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'trip.archive',
        entityType: 'Trip',
        entityId: tripId,
        before: antes,
        after: { status: 'ARCHIVED', arquivada: true },
        ip: ctx.ip,
      },
      tx,
    )

    return depois
  })
}

// ─── ProductVariant ──────────────────────────────────────────────────────────

/**
 * Liga/desliga a disponibilidade de uma combinação tamanho+cor.
 *
 * Toggle rápido, endpoint dedicado — mesma lógica do `availability` da saída.
 * NÃO existe quantidade: `available` é um booleano manual, e o briefing é
 * explícito sobre não inventar controle de estoque.
 */
export async function alternarVariante(
  variantId: number,
  disponivel: boolean,
  ctx: Contexto,
): Promise<{ id: number; disponivel: boolean }> {
  const antes = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, available: true, size: true, colorName: true, productId: true },
  })

  if (!antes) {
    throw new AppError(ErrorCode.VARIANT_NOT_FOUND, 'Variante não encontrada.', { status: 404 })
  }

  return prisma.$transaction(async (tx) => {
    const depois = await tx.productVariant.update({
      where: { id: variantId },
      data: { available: disponivel },
      select: { id: true, available: true },
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'variant.toggle',
        entityType: 'ProductVariant',
        entityId: variantId,
        before: { available: antes.available },
        after: { available: disponivel, tamanho: antes.size, cor: antes.colorName },
        ip: ctx.ip,
      },
      tx,
    )

    return { id: depois.id, disponivel: depois.available }
  })
}

// ─── SiteSetting ─────────────────────────────────────────────────────────────

export type CamposSettings = {
  whatsappNumber?: string
  whatsappMessageTemplate?: string
  instagramTrekking?: string | null
  instagramWear?: string | null
  linktree?: string | null
  email?: string | null
  cadasturNumber?: string | null
  pesmCredentials?: string | null
  heroTitle?: string | null
  heroSubtitle?: string | null
  aboutText?: string | null
}

/** Placeholders que o template da mensagem do WhatsApp reconhece. */
export const PLACEHOLDERS_VALIDOS = ['{{itens}}', '{{total}}', '{{cliente}}'] as const

/**
 * Valida os placeholders do template.
 *
 * Um `{{iten}}` com erro de digitação sairia literal na mensagem enviada ao
 * cliente. Melhor recusar no CRM, com a lista do que é válido, do que
 * descobrir pelo WhatsApp de alguém.
 */
export function validarTemplate(template: string): string[] {
  const encontrados = template.match(/\{\{[^}]*\}\}/g) ?? []
  return encontrados.filter((p) => !PLACEHOLDERS_VALIDOS.includes(p as never))
}

export async function atualizarSettings(
  campos: CamposSettings,
  ctx: Contexto,
): Promise<{ id: number }> {
  if (campos.whatsappMessageTemplate) {
    const invalidos = validarTemplate(campos.whatsappMessageTemplate)
    if (invalidos.length > 0) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `Placeholder desconhecido: ${invalidos.join(', ')}. Válidos: ${PLACEHOLDERS_VALIDOS.join(', ')}.`,
        { status: 400 },
      )
    }
  }

  const antes = await prisma.siteSetting.findUnique({ where: { id: 1 } })

  return prisma.$transaction(async (tx) => {
    const depois = await tx.siteSetting.update({
      where: { id: 1 },
      data: campos,
      select: { id: true },
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'settings.update',
        entityType: 'SiteSetting',
        entityId: 1,
        before: antes,
        after: campos,
        ip: ctx.ip,
      },
      tx,
    )

    return depois
  })
}
