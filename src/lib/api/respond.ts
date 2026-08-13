import { NextResponse } from 'next/server'

import type { ErrorCode, ErrorDetail } from '@/lib/api/errors'

/**
 * Envelope de resposta, num lugar só.
 *
 * Sucesso: `{ data, meta? }` — sempre. Mesmo para recurso único, para o
 * cliente nunca precisar adivinhar a forma.
 * Erro:    `{ error: { code, message, details? } }`.
 */

export type Meta = {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

type OpcoesCache = {
  /** Segundos de cache na CDN. Omitido = sem cache. */
  sMaxAge?: number
  /** Janela em que a CDN pode servir conteúdo velho enquanto revalida. */
  staleWhileRevalidate?: number
}

export function ok<T>(data: T, options?: { meta?: Meta; cache?: OpcoesCache }): NextResponse {
  const headers = new Headers()

  if (options?.cache?.sMaxAge !== undefined) {
    const swr = options.cache.staleWhileRevalidate ?? options.cache.sMaxAge * 10
    // `public` porque catálogo é conteúdo público e idêntico para todo mundo.
    // `s-maxage` cacheia na CDN sem cachear no navegador da pessoa, que é o
    // que queremos: preço e disponibilidade mudam e o navegador não deve
    // segurar dado velho.
    headers.set(
      'Cache-Control',
      `public, s-maxage=${options.cache.sMaxAge}, stale-while-revalidate=${swr}`,
    )
  } else {
    headers.set('Cache-Control', 'no-store')
  }

  return NextResponse.json(options?.meta ? { data, meta: options.meta } : { data }, { headers })
}

export function fail(
  code: ErrorCode,
  message: string,
  options?: { status?: number; details?: ErrorDetail[]; requestId?: string },
): NextResponse {
  const corpo: {
    error: { code: string; message: string; details?: ErrorDetail[]; requestId?: string }
  } = { error: { code, message } }

  if (options?.details?.length) corpo.error.details = options.details
  if (options?.requestId) corpo.error.requestId = options.requestId

  return NextResponse.json(corpo, {
    status: options?.status ?? 500,
    headers: { 'Cache-Control': 'no-store' },
  })
}
