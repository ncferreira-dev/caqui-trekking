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
  availability: true,
} as const

export const SELECT_TAG = {
  slug: true,
  label: true,
  icon: true,
} as const

export const SELECT_GUIA = {
  id: true,
  name: true,
  bio: true,
  cadasturNumber: true,
  pesmCredential: true,
  photos: { select: SELECT_MEDIA, orderBy: { sortOrder: 'asc' } },
} as const
