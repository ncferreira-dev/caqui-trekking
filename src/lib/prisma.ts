import { PrismaClient } from '@/generated/prisma/client'
import { createPgAdapter } from '@/lib/db-adapter'
import { env } from '@/lib/env'

/**
 * Cliente Prisma como singleton.
 *
 * Em desenvolvimento, o hot reload do Next reavalia os módulos a cada
 * alteração. Sem o cache no `globalThis`, cada reload cria um PrismaClient
 * novo e abre um pool de conexões novo — em poucos minutos o Postgres recusa
 * conexão com "too many clients already", e o sintoma (o app "para de
 * funcionar sozinho") não aponta para a causa.
 *
 * Em produção o módulo é avaliado uma vez só, então a instância é direta.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Prisma 7 removeu o engine embutido: a conexão passa por um driver adapter
// explícito. O `createPgAdapter` fixa a sessão em UTC — ver o comentário lá,
// é o que impede a data de sair 3 horas errada no banco.
const adapter = createPgAdapter(env.DATABASE_URL)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    // Em dev, logar query ajuda a flagrar N+1 cedo — o projeto de referência
    // disparava 4 requisições do catálogo inteiro por pageview sem ninguém ver.
    log: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  })

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
