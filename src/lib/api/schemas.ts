import { z } from 'zod'

import { MAX_UNIDADES } from '@/lib/carrinho/limites'

/**
 * Schemas de entrada compartilhados.
 *
 * TODA rota valida entrada — inclusive `params` e `query`. No projeto de
 * referência nenhum `req.params` era validado, e por isso `GET /clients/abc`
 * devolvia **500** com a mensagem crua do Mongoose ("Cast to ObjectId failed
 * ... for model Client"), entregando o nome dos models de graça. Aqui, id
 * malformado é 400 com `INVALID_PARAM`.
 */

/**
 * Paginação com TETO OBRIGATÓRIO.
 *
 * Nenhuma rota desta API pode devolver a tabela inteira, nem por acidente. O
 * projeto de referência não tinha paginação em rota nenhuma: `GET /products`
 * devolvia o catálogo completo, sem projeção e sem limite, e a home o pedia
 * quatro vezes em paralelo a cada visita.
 */
export const paginacaoSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export const slugSchema = z
  .string()
  .min(1)
  .max(120)
  // Slug é gerado pelo sistema: minúsculas, dígitos e hífen. Restringir aqui
  // barra caractere estranho antes de ele virar consulta.
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido.')

export const idSchema = z.coerce.number().int().positive()

export const dificuldadeSchema = z.enum(['FACIL', 'MODERADO', 'DIFICIL', 'EXTREMO'])

export const categoriaProdutoSchema = z.enum(['CAMISETA', 'REGATA', 'MOCHILA', 'BONE', 'ACESSORIO'])

/** Filtros de `GET /api/trips`. */
export const filtrosTripSchema = paginacaoSchema.extend({
  dificuldade: dificuldadeSchema.optional(),
  tag: slugSchema.optional(),
  precoMin: z.coerce.number().int().min(0).optional(),
  precoMax: z.coerce.number().int().min(0).optional(),
})

/**
 * Chave de mês da agenda: "2026-08".
 *
 * O regex trava o formato, e o `refine` trava o INTERVALO — sem ele,
 * `?mes=2026-99` passaria pela forma e viraria um `Date` inválido lá dentro,
 * produzindo uma consulta com `NaN` e um 500 no lugar de um 400.
 *
 * O ANO também é limitado, e não por preciosismo: `?mes=9999-12` passa no
 * regex e no intervalo do mês, mas `intervaloDoMes` precisa montar o mês
 * SEGUINTE — "10000-01" — e o formato ISO exige ano expandido com sinal
 * (`+010000`) acima de 9999. `new Date('10000-01-01T00:00:00Z')` devolve
 * Invalid Date, e o `Intl` lá dentro lança `RangeError`. Mesmo 500 pela porta
 * dos fundos.
 *
 * 2000–2100 cobre qualquer agenda que este site vá ter.
 */
export const chaveMesSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Mês inválido.')
  .refine((v) => {
    const ano = Number(v.slice(0, 4))
    const mes = Number(v.slice(5, 7))
    return ano >= 2000 && ano <= 2100 && mes >= 1 && mes <= 12
  }, 'Mês inválido.')

/** Filtros de `GET /api/departures`. */
export const filtrosDepartureSchema = paginacaoSchema.extend({
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
  mes: chaveMesSchema.optional(),
  dificuldade: dificuldadeSchema.optional(),
  tag: slugSchema.optional(),
  precoMin: z.coerce.number().int().min(0).optional(),
  precoMax: z.coerce.number().int().min(0).optional(),
  incluirEncerradas: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default(false),
})

/** Filtros de `GET /api/products`. */
export const filtrosProdutoSchema = paginacaoSchema.extend({
  categoria: categoriaProdutoSchema.optional(),
})

/**
 * Corpo de `POST /api/cart/validate`.
 *
 * O cliente manda REFERÊNCIA e QUANTIDADE. O preço é opcional e serve
 * exclusivamente para o servidor detectar divergência — nunca para calcular.
 */
export const itemCarrinhoSchema = z.discriminatedUnion('tipo', [
  z.object({
    lineId: z.string().min(1).max(120),
    tipo: z.literal('DEPARTURE'),
    departureId: idSchema,
    quantidade: z.number().int().min(1).max(MAX_UNIDADES.DEPARTURE),
    precoCentavosNoCarrinho: z.number().int().min(0).optional(),
  }),
  z.object({
    lineId: z.string().min(1).max(120),
    tipo: z.literal('WEAR'),
    variantId: idSchema,
    quantidade: z.number().int().min(1).max(MAX_UNIDADES.WEAR),
    precoCentavosNoCarrinho: z.number().int().min(0).optional(),
  }),
])

export const validarCarrinhoSchema = z.object({
  // Teto de 50 linhas: carrinho maior que isso é abuso, não pedido.
  itens: z.array(itemCarrinhoSchema).min(1).max(50),
})

/** Corpo de `POST /api/contact`. */
export const contatoSchema = z
  .object({
    nome: z.string().trim().min(2).max(150),
    email: z.string().trim().email().max(255).optional(),
    telefone: z.string().trim().min(8).max(20).optional(),
    mensagem: z.string().trim().min(10).max(2000),
    tripSlug: slugSchema.optional(),
  })
  .strict()

/**
 * Corpo de `POST /api/leads`.
 *
 * `consentimento` é obrigatório e precisa ser `true` — LGPD. Não existe lead
 * capturado "por padrão": ou a pessoa marcou a caixa, ou não vira contato de
 * campanha.
 */
export const leadSchema = z
  .object({
    email: z.string().trim().email().max(255).optional(),
    telefone: z.string().trim().min(8).max(20).optional(),
    nome: z.string().trim().min(2).max(150).optional(),
    origem: z.string().trim().min(2).max(60),
    consentimento: z.literal(true, {
      message: 'É necessário consentir com o uso dos dados.',
    }),
  })
  .strict()
  .refine((d) => Boolean(d.email ?? d.telefone), {
    message: 'Informe ao menos um e-mail ou telefone.',
    path: ['email'],
  })

// ─── Mídia ───────────────────────────────────────────────────────────────────

/**
 * Quem é o dono da imagem.
 *
 * Exatamente UM dos três. O banco já tem o CHECK
 * `media_assets_exatamente_um_dono`, mas o CHECK responde com erro de
 * constraint; aqui a recusa vira 400 com uma frase que o CRM mostra.
 */
export const donoDeMidiaSchema = z
  .object({
    tripId: idSchema.optional(),
    productId: idSchema.optional(),
    guideId: idSchema.optional(),
  })
  .strict()
  .refine(
    (d) => [d.tripId, d.productId, d.guideId].filter((v) => v !== undefined).length === 1,
    'Informe exatamente um dono: tripId, productId ou guideId.',
  )
  .transform((d) => {
    if (d.tripId !== undefined) return { tipo: 'trip' as const, id: d.tripId }
    if (d.productId !== undefined) return { tipo: 'product' as const, id: d.productId }
    return { tipo: 'guide' as const, id: d.guideId as number }
  })

/**
 * Texto alternativo. Obrigatório estar PRESENTE; pode ser vazio.
 *
 * String vazia é a marcação correta para imagem decorativa (`alt=""` faz o
 * leitor de tela pular). O que não pode é o campo faltar — aí o leitor de tela
 * lê o nome do arquivo. No projeto de referência o campo nem existia no model.
 */
export const altSchema = z.string().max(300, 'O texto alternativo tem no máximo 300 caracteres.')

export const reordenarMidiaSchema = z
  .object({
    tripId: idSchema.optional(),
    productId: idSchema.optional(),
    guideId: idSchema.optional(),
    /** Manifesto COMPLETO da galeria. O primeiro id é a imagem principal. */
    ids: z.array(idSchema).min(1).max(100),
  })
  .strict()

export const atualizarAltSchema = z.object({ alt: altSchema }).strict()

// ─── Tags ────────────────────────────────────────────────────────────────────

export const criarTagSchema = z
  .object({
    slug: slugSchema,
    label: z.string().trim().min(2).max(80),
    icone: z.string().trim().max(60).nullable().optional(),
  })
  .strict()

// Sem `.strict()`, de propósito — e é o único schema de corpo assim. O `slug`
// é campo CONHECIDO e IMUTÁVEL: o editor de tag pode mandá-lo junto, e a regra
// é tolerar e ignorar, não recusar. Mudar o slug em silêncio quebraria o que
// já está indexado (`/expedicoes?tag=rapel`) e os filtros salvos — então ele
// simplesmente não entra na atualização. O teste "edita label sem deixar mexer
// no slug" (media.test.ts) trava esse comportamento; strict o transformaria em
// 400 e contrariaria a decisão.
export const atualizarTagSchema = z.object({
  label: z.string().trim().min(2).max(80).optional(),
  icone: z.string().trim().max(60).nullable().optional(),
})

/** Converte `URLSearchParams` em objeto simples para o Zod. */
export function queryParaObjeto(url: URL): Record<string, string> {
  return Object.fromEntries(url.searchParams.entries())
}
