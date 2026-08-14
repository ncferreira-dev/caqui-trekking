import { AppError, ErrorCode } from '@/lib/api/errors'
import { chaveMes, mesPorExtenso } from '@/lib/datetime'
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
  dificuldade?: string | undefined
  tag?: string | undefined
  /**
   * A faixa de preço filtra a SAÍDA, não o roteiro. É a Departure que tem
   * preço: o mesmo roteiro custa diferente no feriado e na baixa temporada.
   */
  precoMinCentavos?: number | undefined
  precoMaxCentavos?: number | undefined
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
    trip: {
      status: 'PUBLISHED' as const,
      deletedAt: null,
      ...(filtros.dificuldade ? { difficulty: filtros.dificuldade as never } : {}),
      ...(filtros.tag ? { activityTags: { some: { activityTag: { slug: filtros.tag } } } } : {}),
    },
    ...(filtros.precoMinCentavos !== undefined || filtros.precoMaxCentavos !== undefined
      ? {
          priceCents: {
            ...(filtros.precoMinCentavos !== undefined ? { gte: filtros.precoMinCentavos } : {}),
            ...(filtros.precoMaxCentavos !== undefined ? { lte: filtros.precoMaxCentavos } : {}),
          },
        }
      : {}),
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

// ─── Opções dos filtros ──────────────────────────────────────────────────────

export type OpcoesDeAgenda = {
  meses: { chave: string; rotulo: string; total: number }[]
  tags: { slug: string; label: string }[]
  dificuldades: string[]
}

/**
 * O que oferecer nos filtros da agenda.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A LISTA VEM DOS DADOS, NUNCA DE UMA CONSTANTE
 * ────────────────────────────────────────────────────────────────────────────
 * O caminho fácil seria imprimir os próximos 12 meses e os 4 níveis de
 * dificuldade. Isso produz um filtro que promete o que não existe: escolher
 * "Extremo" e receber "nenhuma saída encontrada" faz a pessoa concluir que o
 * site está quebrado, não que aquele nível não tem data marcada.
 *
 * Aqui só entra na lista o que tem ao menos uma saída na janela. Um filtro que
 * só oferece resultado não-vazio nunca produz o beco sem saída.
 *
 * O agrupamento por mês acontece em JS e não em SQL porque a chave é o mês em
 * AMERICA/SAO_PAULO, e `date_trunc` no Postgres opera no fuso da sessão — que
 * este projeto força para UTC de propósito (ver src/lib/db-adapter.ts). Fazer
 * a conta aqui é uma linha; fazer no banco seria um `AT TIME ZONE` embutido
 * numa query crua, fora do alcance do Prisma e do TypeScript.
 *
 * O teto de 400 linhas existe para a consulta não virar varredura se alguém
 * publicar cinco anos de saídas de uma vez. A agenda real tem dezenas.
 */
export async function opcoesDeAgenda(de: Date): Promise<OpcoesDeAgenda> {
  const linhas = await prisma.departure.findMany({
    where: {
      status: 'PUBLISHED',
      trip: { status: 'PUBLISHED', deletedAt: null },
      startAt: { gte: de },
    },
    select: {
      startAt: true,
      trip: {
        select: {
          difficulty: true,
          activityTags: { select: { activityTag: { select: { slug: true, label: true } } } },
        },
      },
    },
    orderBy: { startAt: 'asc' },
    take: 400,
  })

  const porMes = new Map<string, number>()
  const tags = new Map<string, string>()
  const dificuldades = new Set<string>()

  for (const linha of linhas) {
    const chave = chaveMes(linha.startAt)
    porMes.set(chave, (porMes.get(chave) ?? 0) + 1)
    dificuldades.add(linha.trip.difficulty)
    for (const { activityTag } of linha.trip.activityTags) {
      tags.set(activityTag.slug, activityTag.label)
    }
  }

  return {
    meses: [...porMes.entries()].map(([chave, total]) => ({
      chave,
      rotulo: mesPorExtenso(chave),
      total,
    })),
    // Ordem alfabética: a ordem de inserção seria a ordem cronológica das
    // saídas, que muda a cada publicação e faz o mesmo `<select>` embaralhar
    // entre duas visitas.
    tags: [...tags.entries()]
      .map(([slug, label]) => ({ slug, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    dificuldades: ORDEM_DIFICULDADE.filter((d) => dificuldades.has(d)),
  }
}

/** Do mais leve ao mais pesado — nunca alfabética, que embaralharia a rampa. */
const ORDEM_DIFICULDADE = ['FACIL', 'MODERADO', 'DIFICIL', 'EXTREMO'] as const

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
