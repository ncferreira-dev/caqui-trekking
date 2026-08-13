import { AppError, ErrorCode } from '@/lib/api/errors'
import { chaveMes } from '@/lib/datetime'
import { prisma } from '@/lib/prisma'
import { paraMediaDTO, paraSaidaDTO, type SaidaDTO } from '@/server/dto/public-dto'
import {
  SELECT_DEPARTURE_PUBLICA,
  SELECT_GUIA,
  SELECT_MEDIA,
  SELECT_TAG,
} from '@/server/services/selects'

export type FiltrosDeparture = {
  de?: Date | undefined
  ate?: Date | undefined
  /**
   * Por padrão a agenda mostra só o que ainda vai acontecer.
   * Com `true`, as saídas passadas voltam marcadas como `encerrada` — elas não
   * somem da página: servem de prova social e histórico.
   */
  incluirEncerradas: boolean
  limit: number
  offset: number
}

export type ItemAgendaDTO = SaidaDTO & {
  /** "2026-08" — a agenda é agrupada por mês na UI. */
  mes: string
  trip: {
    slug: string
    titulo: string
    cidade: string
    estado: string
    dificuldade: string
    duracaoMinutos: number | null
    tags: { slug: string; label: string; icone: string | null }[]
    capa: ReturnType<typeof paraMediaDTO> | null
  }
}

/**
 * Agenda cronológica. É a view central do site.
 */
export async function listarDepartures(
  filtros: FiltrosDeparture,
): Promise<{ saidas: ItemAgendaDTO[]; total: number }> {
  const agora = new Date()

  const limiteInferior = filtros.incluirEncerradas ? filtros.de : (filtros.de ?? agora)

  const where = {
    status: 'PUBLISHED' as const,
    trip: { status: 'PUBLISHED' as const, deletedAt: null },
    ...(limiteInferior || filtros.ate
      ? {
          startAt: {
            ...(limiteInferior ? { gte: limiteInferior } : {}),
            ...(filtros.ate ? { lte: filtros.ate } : {}),
          },
        }
      : {}),
  }

  const [linhas, total] = await Promise.all([
    prisma.departure.findMany({
      where,
      select: {
        ...SELECT_DEPARTURE_PUBLICA,
        trip: {
          select: {
            slug: true,
            title: true,
            city: true,
            state: true,
            difficulty: true,
            durationMinutes: true,
            activityTags: { select: { activityTag: { select: SELECT_TAG } } },
            images: { select: SELECT_MEDIA, orderBy: { sortOrder: 'asc' }, take: 1 },
          },
        },
      },
      orderBy: { startAt: 'asc' },
      take: filtros.limit,
      skip: filtros.offset,
    }),
    prisma.departure.count({ where }),
  ])

  const saidas = linhas.map((d): ItemAgendaDTO => {
    const base = paraSaidaDTO(d, agora)
    return {
      ...base,
      mes: chaveMes(d.startAt),
      trip: {
        slug: d.trip.slug,
        titulo: d.trip.title,
        cidade: d.trip.city,
        estado: d.trip.state,
        dificuldade: d.trip.difficulty,
        duracaoMinutos: d.trip.durationMinutes,
        tags: d.trip.activityTags.map((r) => ({
          slug: r.activityTag.slug,
          label: r.activityTag.label,
          icone: r.activityTag.icon,
        })),
        capa: d.trip.images[0] ? paraMediaDTO(d.trip.images[0]) : null,
      },
    }
  })

  return { saidas, total }
}

export async function buscarDeparturePorId(id: number): Promise<
  ItemAgendaDTO & {
    guias: { id: number; nome: string; cadastur: string | null; pesm: string | null }[]
  }
> {
  const agora = new Date()

  const d = await prisma.departure.findFirst({
    where: { id, status: 'PUBLISHED', trip: { status: 'PUBLISHED', deletedAt: null } },
    select: {
      ...SELECT_DEPARTURE_PUBLICA,
      trip: {
        select: {
          slug: true,
          title: true,
          city: true,
          state: true,
          difficulty: true,
          durationMinutes: true,
          activityTags: { select: { activityTag: { select: SELECT_TAG } } },
          images: { select: SELECT_MEDIA, orderBy: { sortOrder: 'asc' }, take: 1 },
        },
      },
      guides: { select: { guide: { select: SELECT_GUIA } } },
    },
  })

  if (!d) {
    throw new AppError(ErrorCode.DEPARTURE_NOT_FOUND, 'Saída não encontrada.', { status: 404 })
  }

  return {
    ...paraSaidaDTO(d, agora),
    mes: chaveMes(d.startAt),
    trip: {
      slug: d.trip.slug,
      titulo: d.trip.title,
      cidade: d.trip.city,
      estado: d.trip.state,
      dificuldade: d.trip.difficulty,
      duracaoMinutos: d.trip.durationMinutes,
      tags: d.trip.activityTags.map((r) => ({
        slug: r.activityTag.slug,
        label: r.activityTag.label,
        icone: r.activityTag.icon,
      })),
      capa: d.trip.images[0] ? paraMediaDTO(d.trip.images[0]) : null,
    },
    guias: d.guides.map(({ guide }) => ({
      id: guide.id,
      nome: guide.name,
      cadastur: guide.cadasturNumber,
      pesm: guide.pesmCredential,
    })),
  }
}
