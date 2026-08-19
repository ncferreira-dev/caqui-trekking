/**
 * `select` compartilhados entre os serviços públicos.
 *
 * Primeira camada da defesa: o campo interno não é sequer BUSCADO do banco.
 * Nenhum destes selects inclui `internalNotes`, `deletedAt` ou qualquer coisa
 * que não vá para o público. A segunda camada são os mappers em
 * `src/server/dto/public-dto.ts`, que copiam campo a campo.
 *
 * Manter os selects aqui, e não espalhados, é o que torna auditável a
 * pergunta "o que exatamente esta API expõe?".
 */

/**
 * `publicId` está deliberadamente FORA: é identificador interno do provedor de
 * storage e não serve para nada no navegador. O que sai é a URL de entrega.
 */
export const SELECT_MEDIA = {
  url: true,
  alt: true,
  width: true,
  height: true,
  blurDataUrl: true,
  // Sai para o DTO derivar `principal`, e nunca cru: o front recebe o booleano
  // pronto, não a posição para interpretar por conta própria.
  sortOrder: true,
  // A cor que a foto mostra. Só significa alguma coisa em foto de PRODUTO;
  // em roteiro e guia é sempre nulo, e nulo já quer dizer "serve para todas".
  // Ver `lib/media/cor-da-foto.ts`.
  colorName: true,
} as const

/**
 * Campos públicos de uma saída.
 *
 * ATENÇÃO: `internalNotes` está deliberadamente FORA. É requisito escrito do
 * projeto que ele nunca saia na API pública. Há um teste que falha se ele
 * aparecer em qualquer resposta.
 */
export const SELECT_DEPARTURE_PUBLICA = {
  id: true,
  startAt: true,
  endAt: true,
  meetingPoint: true,
  meetingTimeLocal: true,
  meetingLat: true,
  meetingLng: true,
  priceCents: true,
  compareAtPriceCents: true,
  // A CONTA DE VAGAS. Os quatro juntos, sempre: `estadoDeVagas` precisa dos
  // quatro para responder, e trazer três produz um selo errado em silêncio.
  capacity: true,
  seatsTaken: true,
  lastSpotsAt: true,
  availabilityOverride: true,
} as const

export const SELECT_TAG = {
  slug: true,
  label: true,
  icon: true,
} as const

/**
 * O FILTRO DO GUIA NA API PÚBLICA.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O DEFEITO QUE ORIGINOU ISTO, ENCONTRADO EM 18/08/2026
 * ════════════════════════════════════════════════════════════════════════════
 * `/api/guides` sempre filtrou `active` e `deletedAt`. Os JOINS de saída e de
 * roteiro NÃO filtravam nada, e é aí que mora a diferença que ninguém percebe:
 * desativar ou arquivar um guia o tirava da página institucional, dando a
 * impressão de que ele havia saído do ar, enquanto ele continuava sendo servido
 * com NOME COMPLETO, BIO, CADASTUR e CREDENCIAL PESM em
 * `GET /api/trips/:slug` e `GET /api/departures/:id` — e portanto na página
 * pública de todo roteiro em que já guiou.
 *
 * Cadastur e PESM são registro profissional nominal. De uma pessoa que saiu da
 * equipe, publicados em rota anônima e cacheada na CDN.
 *
 * É o buraco conhecido da regra 3 do schema: o filtro automático de soft delete
 * vale para o nível de cima da consulta, e RELAÇÃO ANINHADA precisa do filtro
 * escrito à mão.
 *
 * Um `where` só, num lugar só, usado pelos dois joins. Ver
 * `src/test/guia-arquivado.test.ts`.
 */
export const WHERE_GUIA_PUBLICA = { guide: { active: true, deletedAt: null } } as const

export const SELECT_GUIA = {
  id: true,
  name: true,
  bio: true,
  cadasturNumber: true,
  pesmCredential: true,
  photos: { select: SELECT_MEDIA, orderBy: { sortOrder: 'asc' } },
} as const
