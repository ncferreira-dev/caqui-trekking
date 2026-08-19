import { AppError, ErrorCode } from '@/lib/api/errors'
import { prisma } from '@/lib/prisma'
import {
  paraMediaDTO,
  paraSaidaDTO,
  type TagDTO,
  type TripDetalheDTO,
  type TripResumoDTO,
} from '@/server/dto/public-dto'
import {
  SELECT_DEPARTURE_PUBLICA,
  SELECT_GUIA,
  SELECT_MEDIA,
  SELECT_TAG,
  WHERE_GUIA_PUBLICA,
} from '@/server/services/selects'

export type FiltrosTrip = {
  dificuldade?: string | undefined
  tag?: string | undefined
  precoMinCentavos?: number | undefined
  precoMaxCentavos?: number | undefined
  limit: number
  offset: number
}

/**
 * Roteiros publicados, cada um com a próxima saída disponível.
 *
 * O filtro de preço opera sobre as SAÍDAS, não sobre a Trip — é a Departure
 * que tem preço. Com faixa de preço pedida, uma Trip só entra se tiver ao menos
 * uma saída futura publicada dentro dela.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SEM FILTRO DE PREÇO, ROTEIRO SEM DATA TAMBÉM APARECE — MUDOU EM 18/08/2026
 * ────────────────────────────────────────────────────────────────────────────
 * Antes o `where` exigia `departures: { some: … }` sempre, e a regra escrita
 * era "roteiro sem agenda não aparece na vitrine". Ela fazia sentido quando a
 * única coisa que se podia fazer com um roteiro era comprar uma vaga numa data:
 * mostrar o que não dá para comprar é frustrar.
 *
 * Deixou de fazer sentido quando `/guia-particular` passou a existir. Agora um
 * roteiro sem data marcada continua sendo vendável — como saída fechada — e
 * escondê-lo esconde metade do que a Caqui sabe fazer. Medido no banco de
 * desenvolvimento: 5 roteiros cadastrados, 2 aparecendo.
 *
 * A vitrine passa a mostrar todos, e `LinhaDeRoteiro` marca os sem data com
 * "Sem data marcada" e "Sob consulta". Com faixa de preço pedida a exigência
 * volta, porque aí a pergunta é sobre preço, e preço só existe em saída.
 */
export async function listarTrips(
  filtros: FiltrosTrip,
): Promise<{ trips: TripResumoDTO[]; total: number }> {
  const agora = new Date()
  const temFiltroDePreco =
    filtros.precoMinCentavos !== undefined || filtros.precoMaxCentavos !== undefined

  const filtroSaida = {
    status: 'PUBLISHED' as const,
    startAt: { gte: agora },
    ...(temFiltroDePreco
      ? {
          priceCents: {
            ...(filtros.precoMinCentavos !== undefined ? { gte: filtros.precoMinCentavos } : {}),
            ...(filtros.precoMaxCentavos !== undefined ? { lte: filtros.precoMaxCentavos } : {}),
          },
        }
      : {}),
  }

  const where = {
    status: 'PUBLISHED' as const,
    deletedAt: null,
    ...(filtros.dificuldade ? { difficulty: filtros.dificuldade as never } : {}),
    ...(filtros.tag ? { activityTags: { some: { activityTag: { slug: filtros.tag } } } } : {}),
    // A exigência de ter saída só vale quando há faixa de preço — ver o bloco
    // acima. Sem ela, roteiro sem data entra e é marcado como "sob consulta".
    ...(temFiltroDePreco ? { departures: { some: filtroSaida } } : {}),
  }

  const [linhas, total] = await Promise.all([
    prisma.trip.findMany({
      where,
      select: {
        slug: true,
        title: true,
        subtitle: true,
        city: true,
        state: true,
        region: true,
        difficulty: true,
        durationMinutes: true,
        distanceKm: true,
        elevationGainM: true,
        activityTags: { select: { activityTag: { select: SELECT_TAG } } },
        images: { select: SELECT_MEDIA, orderBy: { sortOrder: 'asc' }, take: 1 },
        departures: {
          where: filtroSaida,
          select: SELECT_DEPARTURE_PUBLICA,
          orderBy: { startAt: 'asc' },
          take: 1,
        },
      },
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { title: 'asc' }],
      // Teto de página aplicado no schema de entrada: nenhuma rota desta API
      // pode devolver a tabela inteira, nem por acidente.
      take: filtros.limit,
      skip: filtros.offset,
    }),
    prisma.trip.count({ where }),
  ])

  const semOrdem = linhas.map((t): TripResumoDTO => {
    const proxima = t.departures[0]
    return {
      slug: t.slug,
      titulo: t.title,
      subtitulo: t.subtitle,
      cidade: t.city,
      estado: t.state,
      regiao: t.region,
      dificuldade: t.difficulty,
      duracaoMinutos: t.durationMinutes,
      distanciaKm: t.distanceKm ? t.distanceKm.toNumber() : null,
      ganhoElevacaoM: t.elevationGainM,
      tags: t.activityTags.map((r): TagDTO => paraTagDTO(r.activityTag)),
      capa: t.images[0] ? paraMediaDTO(t.images[0]) : null,
      proximaSaida: proxima ? paraSaidaDTO(proxima, agora) : null,
    }
  })

  /**
   * Quem tem data vem primeiro.
   *
   * A ordenação é feita em JS e não no banco porque "tem saída futura" é uma
   * condição sobre uma relação, e ordenar por isso no Prisma exigiria uma view
   * ou um `orderBy` por agregação que o cliente não expõe de forma direta.
   *
   * ⚠️ A ordenação é POR PÁGINA, não global: com paginação, um roteiro sem data
   * na página 1 continua vindo antes de um roteiro com data na página 2. Hoje
   * isso é inofensivo — a página pede `limit: 30` e o catálogo tem 5 —, mas se
   * o catálogo passar de uma página, o certo é resolver a ordem no banco, e não
   * aumentar o limite.
   *
   * `sort` é estável no JS moderno, então a ordem de dentro de cada bloco
   * continua sendo a do banco (destaque, ordem manual, título).
   */
  const trips = [...semOrdem].sort((a, b) => {
    const pesoA = a.proximaSaida ? 0 : 1
    const pesoB = b.proximaSaida ? 0 : 1
    return pesoA - pesoB
  })

  return { trips, total }
}

/** Detalhe do roteiro, com todas as saídas futuras publicadas. */
export async function buscarTripPorSlug(slug: string): Promise<TripDetalheDTO> {
  const agora = new Date()

  const t = await prisma.trip.findFirst({
    where: { slug, status: 'PUBLISHED', deletedAt: null },
    select: {
      slug: true,
      title: true,
      subtitle: true,
      description: true,
      city: true,
      state: true,
      region: true,
      difficulty: true,
      distanceKm: true,
      elevationGainM: true,
      maxAltitudeM: true,
      durationMinutes: true,
      minAge: true,
      requiresExperience: true,
      highlights: true,
      included: true,
      notIncluded: true,
      whatToBring: true,
      cancellationPolicy: true,
      activityTags: { select: { activityTag: { select: SELECT_TAG } } },
      images: { select: SELECT_MEDIA, orderBy: { sortOrder: 'asc' } },
      departures: {
        where: { status: 'PUBLISHED', startAt: { gte: agora } },
        select: {
          ...SELECT_DEPARTURE_PUBLICA,
          // `WHERE_GUIA_PUBLICA`: sem ele, guia desativado ou arquivado continua
          // saindo aqui com nome, Cadastur e PESM. Ver o comentário do token em
          // `selects.ts`.
          guides: { where: WHERE_GUIA_PUBLICA, select: { guide: { select: SELECT_GUIA } } },
        },
        orderBy: { startAt: 'asc' },
      },
    },
  })

  if (!t) {
    throw new AppError(ErrorCode.TRIP_NOT_FOUND, 'Roteiro não encontrado.', { status: 404 })
  }

  // Guias, deduplicados entre as saídas.
  const porId = new Map<number, (typeof t.departures)[number]['guides'][number]['guide']>()
  for (const saida of t.departures) {
    for (const { guide } of saida.guides) porId.set(guide.id, guide)
  }

  return {
    slug: t.slug,
    titulo: t.title,
    subtitulo: t.subtitle,
    descricao: t.description,
    cidade: t.city,
    estado: t.state,
    regiao: t.region,
    dificuldade: t.difficulty,
    distanciaKm: t.distanceKm ? t.distanceKm.toNumber() : null,
    ganhoElevacaoM: t.elevationGainM,
    altitudeMaximaM: t.maxAltitudeM,
    duracaoMinutos: t.durationMinutes,
    idadeMinima: t.minAge,
    exigeExperiencia: t.requiresExperience,
    destaques: t.highlights,
    incluso: t.included,
    naoIncluso: t.notIncluded,
    oQueLevar: t.whatToBring,
    politicaCancelamento: t.cancellationPolicy,
    tags: t.activityTags.map((r) => paraTagDTO(r.activityTag)),
    imagens: t.images.map(paraMediaDTO),
    capa: t.images[0] ? paraMediaDTO(t.images[0]) : null,
    saidas: t.departures.map((s) => paraSaidaDTO(s, agora)),
    proximaSaida: t.departures[0] ? paraSaidaDTO(t.departures[0], agora) : null,
    guias: [...porId.values()].map((g) => ({
      id: g.id,
      nome: g.name,
      bio: g.bio,
      cadastur: g.cadasturNumber,
      pesm: g.pesmCredential,
      fotos: g.photos.map(paraMediaDTO),
    })),
  }
}

function paraTagDTO(tag: { slug: string; label: string; icon: string | null }): TagDTO {
  return { slug: tag.slug, label: tag.label, icone: tag.icon }
}
