import { isoComOffsetLocal, jaEncerrada } from '@/lib/datetime'
import { centavosParaDecimal } from '@/lib/money'
import { estadoDeVagas } from '@/lib/vagas'

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
  /**
   * A cor que esta foto mostra. `null` = serve para qualquer cor.
   *
   * Só tem significado em foto de PRODUTO. A galeria da peça usa isto para
   * trocar a foto junto com a cor escolhida, seguindo a regra de
   * `lib/media/cor-da-foto.ts`: na dúvida, neutra, nunca a cor errada.
   */
  cor: string | null
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
  /**
   * Quantas vagas sobraram. `null` quando a saída não declara capacidade.
   *
   * SAI na API pública de propósito: "faltam 2 vagas" é a informação que fecha
   * a venda de uma trilha guiada, e é verdadeira ou ausente, nunca inventada.
   * Nunca negativo — o excedente do overbooking é assunto do CRM, não do site.
   */
  vagasRestantes: number | null
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
  /**
   * Distância e ganho de elevação entram no RESUMO, e não só no detalhe.
   *
   * São eles que separam dois roteiros. O índice de expedições existe para
   * responder "para onde dá para ir", e a resposta útil não é o nome bonito da
   * trilha — é "12 km com 840 m de subida" contra "5 km quase plano". Sem esses
   * dois campos, o índice mostrava duração e nível, que três roteiros
   * diferentes compartilham.
   *
   * Não é exposição nova: os dois já saem em `TripDetalheDTO`, na página de
   * cada roteiro. O que muda é chegarem uma tela antes.
   */
  distanciaKm: number | null
  ganhoElevacaoM: number | null
  tags: TagDTO[]
  capa: MediaDTO | null
  /** A próxima saída publicada e futura. `null` quando não há. */
  proximaSaida: SaidaDTO | null
}

export type TripDetalheDTO = TripResumoDTO & {
  descricao: string
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
  /**
   * A SEGUNDA foto da galeria, quando existe.
   *
   * Existe para a troca no hover do card. Vem do mesmo `findMany` com
   * `take: 2` — não custa uma consulta a mais, e sem ela o card teria que
   * buscar a segunda imagem no `mouseenter`, que é tarde: a imagem chegaria
   * depois de o ponteiro já ter saído.
   */
  capaAlternativa: MediaDTO | null
  cores: { nome: string; hex: string | null }[]
  /**
   * Os tamanhos que a peça tem, na ordem da grade (P, M, G, GG).
   *
   * Vem na LISTAGEM, e não só no detalhe, porque "serve em mim?" é a pergunta
   * que decide o clique. Sem isso a pessoa abre quatro peças para descobrir
   * que só uma vai até o GG.
   *
   * Peça de tamanho único sai como lista VAZIA, e não como `['UNICO']`: o card
   * não deve escrever "Tamanho: Único", que ocupa espaço para dizer que não há
   * escolha a fazer.
   */
  tamanhos: string[]
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
  colorName?: string | null
}

export function paraMediaDTO(m: MediaRow): MediaDTO {
  return {
    url: m.url,
    alt: m.alt,
    width: m.width,
    height: m.height,
    blurDataUrl: m.blurDataUrl,
    principal: m.sortOrder === 0,
    // `cor` sai como `null` quando a foto serve para qualquer cor, que é o
    // caso de toda foto de roteiro e de guia. A galeria da peça filtra por
    // ela; as outras ignoram.
    cor: m.colorName ?? null,
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
  capacity: number | null
  seatsTaken: number
  lastSpotsAt: number
  availabilityOverride: string | null
  // NOTA: `internalNotes` e `status` NÃO estão neste tipo, de propósito.
  // Se alguém acrescentar o campo ao `select` do serviço, o TypeScript não
  // reclama — mas o mapper abaixo continua não copiando. Ver o teste
  // `internalNotes nunca vaza` em src/server/services/__tests__.
}

export function paraSaidaDTO(s: SaidaRow, agora: Date = new Date()): SaidaDTO {
  const lat = numero(s.meetingLat)
  const lng = numero(s.meetingLng)

  const vagas = estadoDeVagas({
    capacity: s.capacity,
    seatsTaken: s.seatsTaken,
    lastSpotsAt: s.lastSpotsAt,
    availabilityOverride: s.availabilityOverride as SaidaDTO['disponibilidade'] | null,
  })
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
    // O SELO É CONTA, NÃO CAMPO. Ver `src/lib/vagas.ts`: até 18/08/2026 esta
    // linha copiava uma coluna que alguém digitava à mão, e o site anunciava
    // vaga já vendida no WhatsApp durante o tempo que levasse até alguém
    // lembrar de abrir o CRM.
    disponibilidade: vagas.disponibilidade,
    vagasRestantes: vagas.restantes,
    encerrada: jaEncerrada(s.startAt, agora),
  }
}
