import { z } from 'zod'

/**
 * Validação das variáveis de ambiente no boot.
 *
 * Por que isto existe: no projeto de referência (Dália Concept), o segredo de
 * assinatura do JWT era declarado como
 *
 *     const JWT_SECRET = process.env.JWT_SECRET || 'production'
 *
 * Se a variável faltasse no deploy, a API subia normalmente assinando tokens
 * com um segredo que está no código-fonte, e nada no log indicava isso.
 * Qualquer pessoa com acesso ao repositório forjava um token administrativo
 * válido com uma linha. Ver `docs/00-analise-dalia.md`, achado D3.
 *
 * REGRA: nenhuma variável tem fallback. Faltou, o processo não sobe.
 * Falhar cedo e alto é melhor que falhar em silêncio.
 */
const envSchema = z.object({
  // Banco
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL é obrigatória')
    .refine(
      (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
      'DATABASE_URL precisa ser uma connection string PostgreSQL',
    ),

  // Aplicação
  NODE_ENV: z.enum(['development', 'test', 'production']),

  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url('NEXT_PUBLIC_SITE_URL precisa ser uma URL completa (com http:// ou https://)')
    .refine((url) => !url.endsWith('/'), 'NEXT_PUBLIC_SITE_URL não pode terminar com barra'),
})

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const problemas = parsed.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('\n')

    // Mensagem legível em vez de um stack trace do Zod. Quem estiver fazendo o
    // deploy às 23h precisa saber QUAL variável falta, não decifrar um objeto.
    throw new Error(
      `\n\n✖ Variáveis de ambiente inválidas ou ausentes:\n\n${problemas}\n\n` +
        `Copie o .env.example para .env e preencha os valores.\n`,
    )
  }

  return parsed.data
}

export const env = loadEnv()
