import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { ok } from '@/lib/api/respond'
import { rota, validarOuFalhar } from '@/lib/api/route-handler'
import { paginacaoSchema, queryParaObjeto } from '@/lib/api/schemas'
import { exigirPapel } from '@/lib/auth/guard'
import { instanteLocal } from '@/lib/datetime'
import { prisma } from '@/lib/prisma'
import { criarTrip } from '@/server/services/admin/content-admin-service'
import { ipDaRequest } from '@/server/services/audit-service'

export const dynamic = 'force-dynamic'

/** Rótulo de parede: "2026-08-20T06:00". O mesmo do POST de saída. */
const PAREDE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

/**
 * GET /api/admin/trips
 *
 * A listagem administrativa dos roteiros. Diferente da pública em três coisas,
 * e as três são o motivo de ela existir:
 *
 *  1. **Traz rascunho e arquivado.** A vitrine mostra só `PUBLISHED`; o painel
 *     precisa mostrar o que ainda não foi ao ar, senão não há como publicar.
 *  2. **Conta as saídas futuras.** É o número que responde "este roteiro está
 *     vendável?" — roteiro publicado com zero saídas futuras está no ar sem
 *     ninguém poder comprar, e é um dos alertas do dashboard.
 *  3. **Não devolve descrição nem galeria.** A lista não desenha isso, e
 *     trazer `description` de 30 roteiros para renderizar 30 títulos é peso
 *     puro numa tela que a Caqui abre do celular.
 *
 * `deletedAt` é o único filtro que permanece: arquivar é soft delete, e
 * ressuscitar roteiro é operação de banco, não de tela.
 */
export const GET = rota(async (request: NextRequest) => {
  await exigirPapel(request, ['OWNER', 'ADMIN'])

  const url = new URL(request.url)
  const { limit, offset } = validarOuFalhar(paginacaoSchema.safeParse(queryParaObjeto(url)))

  const agora = new Date()

  const where = { deletedAt: null }

  const [roteiros, total] = await Promise.all([
    prisma.trip.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        city: true,
        state: true,
        difficulty: true,
        durationMinutes: true,
        status: true,
        featured: true,
        sortOrder: true,
        activityTags: { select: { activityTag: { select: { slug: true, label: true } } } },
        images: { select: { url: true, alt: true }, orderBy: { sortOrder: 'asc' }, take: 1 },
        // `_count` com filtro: o Postgres conta, e não vêm 40 linhas de saída
        // por roteiro só para o front descobrir um número.
        _count: {
          select: {
            departures: { where: { status: 'PUBLISHED', startAt: { gte: agora } } },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { title: 'asc' }],
      take: limit,
      skip: offset,
    }),
    prisma.trip.count({ where }),
  ])

  const dados = roteiros.map((t) => ({
    id: t.id,
    slug: t.slug,
    titulo: t.title,
    cidade: t.city,
    estado: t.state,
    dificuldade: t.difficulty,
    duracaoMinutos: t.durationMinutes,
    status: t.status,
    destaque: t.featured,
    ordem: t.sortOrder,
    tags: t.activityTags.map((r) => r.activityTag),
    capa: t.images[0] ?? null,
    saidasFuturas: t._count.departures,
  }))

  return ok(dados, { meta: { total, limit, offset, hasMore: offset + dados.length < total } })
})

/**
 * O QUE É OBRIGATÓRIO PARA UM ROTEIRO NASCER.
 *
 * Cinco campos, e nenhum a mais: título, descrição, cidade, estado e
 * dificuldade. Todo o resto (distância, desnível, o que levar, política) é
 * preenchido depois, editando.
 *
 * Isso é decisão de produto, não preguiça de schema. Um formulário de criação
 * com vinte campos obrigatórios faz a pessoa abandonar no meio ou preencher
 * qualquer coisa para conseguir salvar, e "qualquer coisa" vira o texto que o
 * site publica. Os cinco de baixo são os que não dá para adivinhar depois.
 *
 * `state` com exatamente 2 letras: é a sigla, e o banco tem `VarChar(2)`.
 */
const criarSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().min(10),
    city: z.string().trim().min(2).max(120),
    state: z
      .string()
      .trim()
      .length(2)
      .transform((s) => s.toUpperCase()),
    difficulty: z.enum(['FACIL', 'MODERADO', 'DIFICIL', 'EXTREMO']),

    // Daqui para baixo é tudo opcional: dá para preencher agora, se a pessoa
    // já tiver o dado na mão, ou deixar para a edição.
    subtitle: z.string().trim().max(300).nullable().optional(),
    region: z.string().trim().max(120).nullable().optional(),
    durationMinutes: z.number().int().min(0).nullable().optional(),
    distanceKm: z
      .string()
      .regex(/^\d{1,3}([.,]\d{1,2})?$/, 'Distância em km, ex.: 8.5')
      .transform((s) => s.replace(',', '.'))
      .nullable()
      .optional(),
    elevationGainM: z.number().int().min(0).nullable().optional(),

    // ────────────────────────────────────────────────────────────────────────
    // A PRIMEIRA DATA, JUNTO
    // ────────────────────────────────────────────────────────────────────────
    // Pedido do cliente em 20/08/2026: no site o cliente final vê a trilha e
    // as datas dela na MESMA página, então cadastrar em dois lugares é uma
    // divisão do banco vazando para quem usa.
    //
    // Objeto inteiro opcional, e `.strict()` por dentro também: mandar
    // `primeiraSaida: {}` pela metade tem que dar 400 dizendo o campo, e não
    // criar uma saída sem preço.
    primeiraSaida: z
      .object({
        startAt: z.string().regex(PAREDE, 'Data e hora em formato inválido.'),
        priceCents: z.number().int().min(0).max(100_000_00),
        meetingPoint: z.string().trim().max(300).nullable().optional(),
        meetingTimeLocal: z
          .string()
          .regex(/^\d{2}:\d{2}$/, 'Use o formato HH:MM.')
          .nullable()
          .optional(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict()

/**
 * POST /api/admin/trips — cria um roteiro, em RASCUNHO.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ESTA ROTA FALTAVA, E ERA O GARGALO DO CRM
 * ════════════════════════════════════════════════════════════════════════════
 * Até 18/08/2026 este arquivo tinha apenas GET. Dava para editar, publicar,
 * destacar e arquivar roteiro, e não dava para criar nenhum: os cinco que
 * existiam vieram do seed. `Trip` é a entidade central do sistema, e sem esta
 * rota o CRM não atendia o primeiro roteiro novo que a Caqui abrisse.
 *
 * ADMIN pode: escrever roteiro é o trabalho do dia a dia de quem opera. Quem
 * PUBLICA também é ADMIN (`PATCH`), e destruir continua sendo só do OWNER.
 *
 * Nasce em `DRAFT` sem opção de nascer publicado. Ver `criarTrip`.
 */
export const POST = rota(async (request: NextRequest) => {
  const usuario = await exigirPapel(request, ['OWNER', 'ADMIN'])

  const corpo: unknown = await request.json().catch(() => null)
  const { primeiraSaida, ...campos } = validarOuFalhar(criarSchema.safeParse(corpo))

  const trip = await criarTrip(
    {
      ...campos,
      // A hora chega como rótulo de parede ("2026-08-20T06:00") e vira instante
      // em São Paulo aqui, na borda — mesma conversão que o POST de saída faz.
      // O banco só recebe UTC.
      ...(primeiraSaida
        ? { primeiraSaida: { ...primeiraSaida, startAt: instanteLocal(primeiraSaida.startAt) } }
        : {}),
    },
    {
      userId: usuario.userId,
      ip: ipDaRequest(request),
    },
  )

  // `ok` e não um 201 próprio: o projeto inteiro responde 200 com `{ data }` em
  // POST administrativo (ver `criarProduto` e `duplicarSaida`), e um único
  // endpoint com contrato diferente é a pedra que o cliente tropeça.
  return ok(trip)
})
