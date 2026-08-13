/**
 * Códigos de erro da API.
 *
 * O código é o CONTRATO — estável, legível, em SCREAMING_SNAKE. A `message` é
 * texto para humano, em pt-BR, e pode mudar sem quebrar ninguém. O front
 * ramifica pelo código, nunca pela mensagem.
 *
 * No projeto de referência não existia código nenhum: o discriminador era uma
 * frase em português concatenada à mão, e os 34 pontos do front que liam erro
 * liam `err.response.data.message`. Com isso, a revalidação do carrinho seria
 * impossível de implementar direito — quando uma saída lota ou muda de preço,
 * o front precisa saber QUAL item mudou e POR QUÊ, não receber uma frase.
 */
export const ErrorCode = {
  // Genéricos
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_PARAM: 'INVALID_PARAM',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // Domínio
  TRIP_NOT_FOUND: 'TRIP_NOT_FOUND',
  DEPARTURE_NOT_FOUND: 'DEPARTURE_NOT_FOUND',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  VARIANT_NOT_FOUND: 'VARIANT_NOT_FOUND',

  // Carrinho — usados como motivo POR ITEM na revalidação, não como erro
  // da requisição inteira.
  DEPARTURE_NOT_AVAILABLE: 'DEPARTURE_NOT_AVAILABLE',
  DEPARTURE_PAST: 'DEPARTURE_PAST',
  VARIANT_UNAVAILABLE: 'VARIANT_UNAVAILABLE',
  PRICE_CHANGED: 'PRICE_CHANGED',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export type ErrorDetail = {
  field: string
  code: string
  message: string
}

/**
 * Erro da aplicação, com código e status HTTP embutidos.
 *
 * Carregar o `status` na classe é o que permite ao handler central mapear erro
 * → resposta sem uma escada de `instanceof` em cada rota. No projeto de
 * referência a classe de erro tinha só `message`, e por isso o mapeamento para
 * HTTP era reescrito em cada um dos ~54 blocos catch.
 */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details: ErrorDetail[] | undefined

  constructor(
    code: ErrorCode,
    message: string,
    options?: { status?: number; details?: ErrorDetail[]; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined)
    this.name = 'AppError'
    this.code = code
    this.status = options?.status ?? statusPadrao(code)
    this.details = options?.details
  }
}

function statusPadrao(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.VALIDATION_FAILED:
    case ErrorCode.INVALID_PARAM:
      return 400
    case ErrorCode.NOT_FOUND:
    case ErrorCode.TRIP_NOT_FOUND:
    case ErrorCode.DEPARTURE_NOT_FOUND:
    case ErrorCode.PRODUCT_NOT_FOUND:
    case ErrorCode.VARIANT_NOT_FOUND:
      return 404
    case ErrorCode.RATE_LIMITED:
      return 429
    default:
      return 500
  }
}

export function naoEncontrado(code: ErrorCode, mensagem: string): AppError {
  return new AppError(code, mensagem, { status: 404 })
}
