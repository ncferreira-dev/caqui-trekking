import type { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { AppError, ErrorCode, type ErrorDetail } from '@/lib/api/errors'
import { fail } from '@/lib/api/respond'

/**
 * Envolve um route handler com o tratamento central de erro.
 *
 * Substitui o try/catch copiado em cada rota. No projeto de referência havia
 * ~54 métodos de controller repetindo o mesmo bloco, terminando em
 * `ApiResponse.ERROR(res, 'Erro ao criar cliente: ' + error.message)` — o que
 * devolvia 500 com a mensagem crua do Mongoose ao cliente, incluindo nome de
 * model, campo e índice.
 *
 * Aqui: erro conhecido vira código estável; erro desconhecido vira
 * INTERNAL_ERROR com um requestId, e a causa real vai só para o log.
 */
export function rota<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>,
): (...args: T) => Promise<NextResponse> {
  return async (...args: T) => {
    try {
      return await handler(...args)
    } catch (erro) {
      if (erro instanceof AppError) {
        return fail(erro.code, erro.message, {
          status: erro.status,
          ...(erro.details ? { details: erro.details } : {}),
        })
      }

      if (erro instanceof ZodError) {
        return fail(ErrorCode.VALIDATION_FAILED, 'Dados inválidos.', {
          status: 400,
          details: zodParaDetails(erro),
        })
      }

      // Desconhecido: o cliente recebe um id para reportar, e nada mais.
      const requestId = crypto.randomUUID()
      console.error(`[api] erro não tratado (requestId=${requestId}):`, erro)
      return fail(ErrorCode.INTERNAL_ERROR, 'Erro interno. Tente novamente.', {
        status: 500,
        requestId,
      })
    }
  }
}

/**
 * Converte o erro do Zod em `details` por campo.
 *
 * Devolve TODOS os problemas, não só o primeiro. O projeto de referência fazia
 * `error.details[0].message` em 14 pontos e jogava fora o resto — nos
 * formulários do CRM isso vira corrigir um campo por vez, um submit por erro.
 */
export function zodParaDetails(erro: ZodError): ErrorDetail[] {
  return erro.issues.map((issue) => ({
    field: issue.path.join('.') || '(raiz)',
    code: issue.code,
    message: issue.message,
  }))
}

/** Lança VALIDATION_FAILED a partir de um resultado de `safeParse`. */
export function validarOuFalhar<T>(
  resultado: { success: true; data: T } | { success: false; error: ZodError },
): T {
  if (!resultado.success) {
    throw new AppError(ErrorCode.VALIDATION_FAILED, 'Dados inválidos.', {
      status: 400,
      details: zodParaDetails(resultado.error),
    })
  }
  return resultado.data
}
