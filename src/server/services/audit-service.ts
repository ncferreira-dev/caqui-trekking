import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Trilha de auditoria.
 *
 * Requisito do projeto: toda mutação em Trip, Departure, Product e
 * SiteSetting grava um registro com before/after. Sem exceção.
 *
 * O ponto prático: quando a Caqui perguntar "por que essa saída ficou esgotada
 * no dia 3?" ou "quem mudou o preço dessa expedição?", a resposta precisa
 * existir. No projeto de referência não havia auditoria nenhuma, e o `console`
 * do servidor tinha 3 chamadas no backend inteiro — nenhuma delas logando um
 * erro 500.
 */

export type EntidadeAuditavel =
  | 'Trip'
  | 'Departure'
  | 'Product'
  | 'ProductVariant'
  | 'SiteSetting'
  | 'Guide'
  | 'User'
  | 'MediaAsset'
  | 'ActivityTag'

export type RegistroAuditoria = {
  userId: number
  action: string
  entityType: EntidadeAuditavel
  entityId: string | number
  before?: unknown
  after?: unknown
  ip?: string | null
}

/**
 * Grava o registro. Aceita um client transacional para que a mutação e a
 * auditoria caiam na MESMA transação — no projeto de referência, o saldo de
 * estoque e o registro do ledger eram duas escritas soltas que podiam
 * divergir permanentemente.
 */
export async function registrarAuditoria(
  dados: RegistroAuditoria,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: dados.userId,
      action: dados.action,
      entityType: dados.entityType,
      entityId: String(dados.entityId),
      before: (dados.before ?? null) as Prisma.InputJsonValue,
      after: (dados.after ?? null) as Prisma.InputJsonValue,
      ip: dados.ip ?? null,
    },
  })
}

/** IP da requisição, para a trilha. Ver a ressalva em lib/api/rate-limit.ts. */
export function ipDaRequest(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  const primeiro = forwarded?.split(',')[0]?.trim()
  return primeiro ?? request.headers.get('x-real-ip')
}
