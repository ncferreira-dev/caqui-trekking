import { isoComOffsetLocal, jaEncerrada } from '@/lib/datetime'
import { centavosParaDecimal } from '@/lib/money'

/**
 * DTOs públicos.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A REGRA: `res.json(registroDoBanco)` é PROIBIDO.
 * ────────────────────────────────────────────────────────────────────────────
 * Toda resposta pública passa por um mapper que lista o que SAI, nunca o que
 * fica. Lista de permissão, não de bloqueio — porque campo novo no schema
 * entra por padrão em resposta quando a regra é "esconder o sensível", e é
 * exatamente assim que se vaza sem perceber.
 *
 * O projeto de referência devolvia o documento cru em `GET /products`, uma
 * rota pública sem auth, com os campos `custo` e `custoEmbalagem` dentro.
 * Um curl sem token entregava a margem do negócio inteiro. Aqui o equivalente
 * seria o custo operacional da saída, o cachê do guia e o `internalNotes` —
 * este último proibido de sair por escrito no briefing.
 *
 * Defesa em profundidade: além destes mappers, os `select` dos serviços nem
 * buscam os campos internos do banco. Duas camadas, porque uma pessoa
 * distraída rompe uma.
 */

export type MediaDTO = {
  /**
   * URL CANÔNICA, sem transformação. As variantes responsivas saem de
   * `srcsetDe(url, width)` em `@/lib/media/urls` — mandar seis URLs por imagem
   * dentro de uma listagem de catálogo engordaria a resposta sem necessidade,
   * já que a construção é determinística.
   */
  url: string
  alt: string
  width: number
  height: number
  blurDataUrl: string | null
  /** Primeira da galeria. Vem resolvido, para o front não derivar posição. */
  principal: boolean
}

export type GuiaDTO = {
  id: number
  nome: string
  bio: string | null
  cadastur: string | null
  pesm: string | null
  fotos: MediaDTO[]
}

export type TagDTO = {
  slug: string
  label: string
  icone: string | null
}

export type SaidaDTO = {
  id: number
  /** Instante em UTC, ISO 8601 com Z. Para cálculo. */
  inicioUtc: string
  /** Mesmo instante com offset de São Paulo. Para exibição e JSON-LD. */
  inicioLocal: string
  fimUtc: string | null
  pontoEncontro: string | null
  horarioEncontro: string | null
  coordenadas: { lat: number; lng: number } | null
  precoCentavos: number
  /** "199.90" — para schema.org e feeds. */
  precoDecimal: string
  precoDeCentavos: number | null
  disponibilidade: 'AVAILABLE' | 'LAST_SPOTS' | 'SOLD_OUT'
  /** Derivado de inicio < agora. Não existe campo no banco. */
  encerrada: boolean
}

export type TripResumoDTO = {
  slug: string
  titulo: string
  subtitulo: string | null
  cidade: string
  estado: string
  regiao: string | null
  dificuldade: string
  duracaoMinutos: number | null
  tags: TagDTO[]
  capa: MediaDTO | null
  /** A próxima saída publicada e futura. `null` quando não há. */
  proximaSaida: SaidaDTO | null
}

export type TripDetalheDTO = TripResumoDTO & {
  descricao: string
  distanciaKm: number | null
  ganhoElevacaoM: number | null
  altitudeMaximaM: number | null
  idadeMinima: number | null
  exigeExperiencia: boolean
  destaques: string[]
  incluso: string[]
  naoIncluso: string[]
  oQueLevar: string[]
  politicaCancelamento: string | null
  imagens: MediaDTO[]
  saidas: SaidaDTO[]
  guias: GuiaDTO[]
}

export type VarianteDTO = {
  id: number
  tamanho: string
  cor: string
  corHex: string | null
  precoCentavos: number
  disponivel: boolean
}

export type ProdutoResumoDTO = {
  slug: string
  nome: string
  categoria: string
  precoCentavos: number
  precoDecimal: string
  capa: MediaDTO | null
  cores: { nome: string; hex: string | null }[]
}

export type ProdutoDetalheDTO = ProdutoResumoDTO & {
  descricao: string | null
  imagens: MediaDTO[]
  variantes: VarianteDTO[]
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

type MediaRow = {
  url: string
  alt: string
  width: number
  height: number
  blurDataUrl: string | null
  sortOrder: number
}

export function paraMediaDTO(m: MediaRow): MediaDTO {
  return {
    url: m.url,
    alt: m.alt,
    width: m.width,
    height: m.height,
    blurDataUrl: m.blurDataUrl,
    principal: m.sortOrder === 0,
  }
}

type DecimalLike = { toNumber(): number } | number | null

function numero(valor: DecimalLike): number | null {
  if (valor === null) return null
  return typeof valor === 'number' ? valor : valor.toNumber()
}

type SaidaRow = {
  id: number
  startAt: Date
  endAt: Date | null
  meetingPoint: string | null
  meetingTimeLocal: string | null
  meetingLat: DecimalLike
  meetingLng: DecimalLike
  priceCents: number
  compareAtPriceCents: number | null
  availability: string
  // NOTA: `internalNotes` e `status` NÃO estão neste tipo, de propósito.
  // Se alguém acrescentar o campo ao `select` do serviço, o TypeScript não
  // reclama — mas o mapper abaixo continua não copiando. Ver o teste
  // `internalNotes nunca vaza` em src/server/services/__tests__.
}

export function paraSaidaDTO(s: SaidaRow, agora: Date = new Date()): SaidaDTO {
  const lat = numero(s.meetingLat)
  const lng = numero(s.meetingLng)

  return {
    id: s.id,
    inicioUtc: s.startAt.toISOString(),
    inicioLocal: isoComOffsetLocal(s.startAt),
    fimUtc: s.endAt?.toISOString() ?? null,
    pontoEncontro: s.meetingPoint,
    horarioEncontro: s.meetingTimeLocal,
    coordenadas: lat !== null && lng !== null ? { lat, lng } : null,
    precoCentavos: s.priceCents,
    precoDecimal: centavosParaDecimal(s.priceCents),
    precoDeCentavos: s.compareAtPriceCents,
    disponibilidade: s.availability as SaidaDTO['disponibilidade'],
    encerrada: jaEncerrada(s.startAt, agora),
  }
}
