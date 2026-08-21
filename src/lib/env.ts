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
/**
 * Trata string vazia como AUSENTE.
 *
 * Só para as variáveis opcionais. Numa obrigatória, isto seria exatamente o
 * fallback silencioso que o cabeçalho deste arquivo existe para proibir: a
 * `DATABASE_URL=""` precisa continuar derrubando o boot, alto e cedo.
 */
function vazio<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema)
}

const envSchema = z
  .object({
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

    // Autenticação
    AUTH_SECRET: z
      .string()
      .min(
        32,
        'AUTH_SECRET precisa ter pelo menos 32 caracteres. Gere com: openssl rand -base64 48',
      ),

    // ─── Mídia ───────────────────────────────────────────────────────────────
    // As três são OPCIONAIS em conjunto e OBRIGATÓRIAS em conjunto (ver o
    // superRefine abaixo). Opcionais porque o site inteiro — catálogo, agenda,
    // carrinho, CRM — funciona sem elas; só o upload não. Exigi-las no boot
    // impediria `npm run dev` de subir antes de alguém criar a conta do
    // provedor, e o remédio seria pior que a doença: valor de mentira no .env
    // só para o processo levantar.
    //
    // O que NÃO fazemos é o que o projeto de referência fazia com o
    // `JWT_SECRET`: aceitar a ausência em silêncio e seguir com um default.
    // Aqui a rota de upload responde 503 MEDIA_STORAGE_UNCONFIGURED nomeando
    // as variáveis que faltam. Ausência vira erro alto, na hora do uso.
    //
    // `vazio` ANTES do schema, e isso é uma correção de 21/08/2026.
    //
    // O `.env.example` deste projeto entrega as três como `""`. Sem o
    // `vazio`, string vazia não é "ausente": é presente e curta demais, o
    // `min(1)` reprova, e o processo NÃO SOBE. Ou seja: copiar o
    // `.env.example` como o próprio arquivo manda derrubava a aplicação
    // inteira, incluindo o site público, que não tem nada a ver com foto.
    //
    // Aconteceu de verdade aqui, três vezes seguidas, enquanto as
    // credenciais eram preenchidas uma a uma. A tela do CRM ficava na
    // sobreposição de erro do Next e parecia travada.
    //
    // Isto NÃO afrouxa a regra do topo do arquivo. Nada ganhou fallback:
    // vazio passa a significar ausente, que é o que a pessoa quis dizer ao
    // deixar as aspas em branco, e ausente continua levando a 503 na hora do
    // upload, nomeando o que falta. O que muda é só o momento da falha: no
    // uso, e não no boot de um site que funciona sem isto.
    CLOUDINARY_CLOUD_NAME: vazio(z.string().min(1).optional()),
    CLOUDINARY_API_KEY: vazio(z.string().min(1).optional()),
    CLOUDINARY_API_SECRET: vazio(z.string().min(1).optional()),
  })
  .superRefine((valores, ctx) => {
    const chaves = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] as const
    const preenchidas = chaves.filter((k) => valores[k])

    // Configuração pela metade é a pior das três situações: parece
    // configurado, sobe, e falha só quando alguém tenta subir uma foto.
    if (preenchidas.length > 0 && preenchidas.length < chaves.length) {
      const faltando = chaves.filter((k) => !valores[k])
      ctx.addIssue({
        code: 'custom',
        path: [faltando[0] ?? 'CLOUDINARY_CLOUD_NAME'],
        message:
          `configuração do Cloudinary incompleta. Preencha as três variáveis ou nenhuma. ` +
          `Faltando: ${faltando.join(', ')}`,
      })
    }
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

/**
 * O schema, exposto SÓ para o teste.
 *
 * `env` é avaliado na importação, com o `process.env` real — então testar por
 * ele testaria a máquina. O underscore segue a convenção de
 * `_definirStorageDeTeste`: existe, mas ninguém de produção deve chamar.
 */
export const _envSchema = envSchema

export const env = loadEnv()
