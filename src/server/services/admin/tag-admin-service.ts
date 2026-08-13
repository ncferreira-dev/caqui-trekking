import { AppError, ErrorCode } from '@/lib/api/errors'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/server/services/audit-service'

/**
 * CRUD das tags de atividade (rapel, cachoeira, travessia...).
 *
 * Estava listado como pendência do PROMPT 04 e fecha aqui, junto com a
 * galeria, porque são as duas coisas que o CRM precisa para montar um roteiro
 * sem ninguém abrir o banco na mão.
 *
 * `icon` guarda o NOME do ícone no design system, nunca um caminho de arquivo
 * — é o que o schema já documenta. Tag não tem imagem; se tivesse, seria mais
 * uma coisa para apagar.
 */

type Contexto = { userId: number; ip: string | null }

export type TagAdminDTO = {
  id: number
  slug: string
  label: string
  icone: string | null
  /** Quantos roteiros usam. É o número que decide se dá para apagar. */
  roteiros: number
}

const CAMPOS = {
  id: true,
  slug: true,
  label: true,
  icon: true,
  _count: { select: { trips: true } },
} as const

type Linha = {
  id: number
  slug: string
  label: string
  icon: string | null
  _count: { trips: number }
}

function paraDTO(t: Linha): TagAdminDTO {
  return { id: t.id, slug: t.slug, label: t.label, icone: t.icon, roteiros: t._count.trips }
}

export async function listarTags(): Promise<TagAdminDTO[]> {
  const linhas = await prisma.activityTag.findMany({ orderBy: { label: 'asc' }, select: CAMPOS })
  return linhas.map(paraDTO)
}

export async function criarTag(
  dados: { slug: string; label: string; icone?: string | null },
  ctx: Contexto,
): Promise<TagAdminDTO> {
  const existente = await prisma.activityTag.findUnique({
    where: { slug: dados.slug },
    select: { id: true },
  })

  // 409 com mensagem, não erro de constraint única vazando do Postgres. O
  // projeto de referência devolvia 500 com o texto cru do driver, entregando
  // nome de model e de índice de graça.
  if (existente) {
    throw new AppError(ErrorCode.CONFLICT, `Já existe uma tag com o slug "${dados.slug}".`, {
      status: 409,
    })
  }

  return prisma.$transaction(async (tx) => {
    const criada = await tx.activityTag.create({
      data: { slug: dados.slug, label: dados.label, icon: dados.icone ?? null },
      select: CAMPOS,
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'tag.create',
        entityType: 'ActivityTag',
        entityId: criada.id,
        before: null,
        after: { slug: criada.slug, label: criada.label },
        ip: ctx.ip,
      },
      tx,
    )

    return paraDTO(criada)
  })
}

export async function atualizarTag(
  tagId: number,
  dados: { label?: string; icone?: string | null },
  ctx: Contexto,
): Promise<TagAdminDTO> {
  const antes = await prisma.activityTag.findUnique({ where: { id: tagId }, select: CAMPOS })
  if (!antes) throw new AppError(ErrorCode.TAG_NOT_FOUND, 'Tag não encontrada.')

  // O slug NÃO é editável, de propósito: ele aparece em `/expedicoes?tag=rapel`
  // e em filtros salvos. Mesmo raciocínio do slug do roteiro — renomear muda a
  // URL em silêncio e quebra o que já está indexado.
  return prisma.$transaction(async (tx) => {
    const depois = await tx.activityTag.update({
      where: { id: tagId },
      data: {
        ...(dados.label !== undefined ? { label: dados.label } : {}),
        ...(dados.icone !== undefined ? { icon: dados.icone } : {}),
      },
      select: CAMPOS,
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'tag.update',
        entityType: 'ActivityTag',
        entityId: tagId,
        before: { label: antes.label, icone: antes.icon },
        after: { label: depois.label, icone: depois.icon },
        ip: ctx.ip,
      },
      tx,
    )

    return paraDTO(depois)
  })
}

/**
 * Apaga — mas só se ninguém estiver usando.
 *
 * Tag em uso apagada silenciosamente tiraria o filtro de baixo dos roteiros
 * que dependem dela. Recusar com a contagem é mais útil que apagar e deixar a
 * pessoa descobrir depois.
 */
export async function removerTag(tagId: number, ctx: Contexto): Promise<{ id: number }> {
  const tag = await prisma.activityTag.findUnique({ where: { id: tagId }, select: CAMPOS })
  if (!tag) throw new AppError(ErrorCode.TAG_NOT_FOUND, 'Tag não encontrada.')

  if (tag._count.trips > 0) {
    throw new AppError(
      ErrorCode.CONFLICT,
      `A tag "${tag.label}" está em ${tag._count.trips} roteiro(s). Remova o vínculo antes de apagar.`,
      { status: 409 },
    )
  }

  return prisma.$transaction(async (tx) => {
    await tx.activityTag.delete({ where: { id: tagId } })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'tag.delete',
        entityType: 'ActivityTag',
        entityId: tagId,
        before: { slug: tag.slug, label: tag.label },
        after: null,
        ip: ctx.ip,
      },
      tx,
    )

    return { id: tagId }
  })
}
