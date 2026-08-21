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

      // Prisma P2025: a operação dependia de um registro que não existe (ex.:
      // `update` inline num id já apagado). É 404, não 500 — e vale para a
      // CLASSE toda, não só para a rota onde apareceu.
      if (codigoDoPrisma(erro) === 'P2025') {
        return fail(ErrorCode.NOT_FOUND, 'Registro não encontrado.', { status: 404 })
      }

      // Prisma P2002: violação de restrição única.
      //
      // As rotas conferem antes de inserir e devolvem 409 com texto próprio —
      // "Já existe uma saída deste roteiro nesta data e hora." Este ramo cobre
      // a CORRIDA: duas requisições passam pela conferência no mesmo instante e
      // quem barra é o índice do banco, não o `if`.
      //
      // Sem ele o erro caía no ramo do desconhecido e virava 500 "Erro
      // interno", que é o oposto da verdade. A pessoa dava duplo clique em
      // "duplicar para o mês seguinte", via um erro de sistema, tentava de novo
      // e ficava sem saber se tinha criado duas saídas.
      if (codigoDoPrisma(erro) === 'P2002') {
        const campos = camposDoP2002(erro)
        return fail(ErrorCode.CONFLICT, 'Já existe um registro com estes dados.', {
          status: 409,
          details: campos.map((field) => ({
            field,
            code: 'unique',
            message: 'Já está em uso.',
          })),
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
 * O código de erro do Prisma, ou `null` quando não é um erro do Prisma.
 *
 * Existe para o teste de `código === 'P2002'` não repetir a mesma escada de
 * `instanceof` + `'code' in` + cast em cada ramo. O cliente do Prisma é
 * gerado em `src/generated`, e importar a classe de erro dele aqui amarraria o
 * tratador central ao artefato gerado; checar a forma custa menos.
 */
function codigoDoPrisma(erro: unknown): string | null {
  if (!(erro instanceof Error) || !('code' in erro)) return null
  const codigo = (erro as { code?: unknown }).code
  return typeof codigo === 'string' ? codigo : null
}

/**
 * Os campos que colidiram num P2002.
 *
 * O Prisma põe isso em `meta.target`, e o formato VARIA: no Postgres costuma
 * ser o array de colunas (`['email']`), mas em certos caminhos vem o nome do
 * índice como string única. Os dois entram aqui; qualquer outra coisa devolve
 * lista vazia, e a resposta fica só com a mensagem genérica.
 *
 * Vale lembrar que `details` aqui é dica de UI, não a barreira. Quem garante a
 * unicidade é o índice do banco.
 */
function camposDoP2002(erro: unknown): string[] {
  const meta = (erro as { meta?: unknown }).meta
  if (typeof meta !== 'object' || meta === null) return []

  const alvo = (meta as { target?: unknown }).target
  if (typeof alvo === 'string') return [alvo]
  if (Array.isArray(alvo)) return alvo.filter((c): c is string => typeof c === 'string')

  return []
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
