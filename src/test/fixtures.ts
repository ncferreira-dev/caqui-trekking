import { prisma } from '@/lib/prisma'

/**
 * Dados de teste, criados do zero a cada arquivo.
 *
 * `limparBanco` trunca com CASCADE e reinicia as sequências, para os ids serem
 * previsíveis entre execuções. O setup já garante que a URL aponta para um
 * banco `_test`.
 */
export async function limparBanco(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "departure_availability_changes",
      "departure_guides",
      "trip_activity_tags",
      "media_assets",
      "departures",
      "activity_tags",
      "trips",
      "product_variants",
      "products",
      "guides",
      "contact_messages",
      "leads",
      "audit_logs",
      "rate_limit_buckets",
      "users",
      "site_settings"
    RESTART IDENTITY CASCADE
  `)
}

export type Fixtures = Awaited<ReturnType<typeof criarFixtures>>

export async function criarFixtures() {
  const agora = new Date()
  const emUmMes = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000)
  const emDoisMeses = new Date(agora.getTime() + 60 * 24 * 60 * 60 * 1000)
  const mesPassado = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000)

  await prisma.siteSetting.create({
    data: {
      id: 1,
      whatsappNumber: '5511943017232',
      whatsappMessageTemplate: 'Olá! Vim pelo site 🌄\n\n{{itens}}\n\n*Total: {{total}}*',
      instagramTrekking: '@caquitrekking',
    },
  })

  const tag = await prisma.activityTag.create({
    data: { slug: 'rapel', label: 'Rapel', icon: 'rope' },
  })

  const guia = await prisma.guide.create({
    data: { name: 'Guia de Teste', cadasturNumber: '00.000000.00-0', sortOrder: 1 },
  })

  const trip = await prisma.trip.create({
    data: {
      slug: 'trilha-de-teste',
      title: 'Trilha de Teste',
      description: 'Descrição da trilha de teste.',
      city: 'Mogi das Cruzes',
      state: 'SP',
      difficulty: 'MODERADO',
      highlights: ['Vista'],
      included: ['Guia'],
      notIncluded: ['Transporte'],
      whatToBring: ['Água'],
      status: 'PUBLISHED',
      activityTags: { create: { activityTagId: tag.id } },
    },
  })

  /** Roteiro em rascunho: NÃO pode aparecer em nenhuma rota pública. */
  const tripRascunho = await prisma.trip.create({
    data: {
      slug: 'trilha-rascunho',
      title: 'Trilha em Rascunho',
      description: 'Não publicada.',
      city: 'Mogi das Cruzes',
      state: 'SP',
      difficulty: 'FACIL',
      highlights: [],
      included: [],
      notIncluded: [],
      whatToBring: [],
      status: 'DRAFT',
    },
  })

  const saidaDisponivel = await prisma.departure.create({
    data: {
      tripId: trip.id,
      startAt: emUmMes,
      priceCents: 9_000,
      availability: 'AVAILABLE',
      status: 'PUBLISHED',
      meetingPoint: 'Praça de Quatinga',
      meetingTimeLocal: '06:00',
      // O campo que NUNCA pode vazar. O valor é distintivo de propósito: os
      // testes procuram por esta string em todas as respostas.
      internalNotes: 'SEGREDO-INTERNO-NAO-PODE-VAZAR',
      guides: { create: { guideId: guia.id } },
    },
  })

  const saidaEsgotada = await prisma.departure.create({
    data: {
      tripId: trip.id,
      startAt: emDoisMeses,
      priceCents: 12_000,
      availability: 'SOLD_OUT',
      status: 'PUBLISHED',
      internalNotes: 'SEGREDO-INTERNO-NAO-PODE-VAZAR',
    },
  })

  const saidaPassada = await prisma.departure.create({
    data: {
      tripId: trip.id,
      startAt: mesPassado,
      priceCents: 8_000,
      availability: 'AVAILABLE',
      status: 'PUBLISHED',
      internalNotes: 'SEGREDO-INTERNO-NAO-PODE-VAZAR',
    },
  })

  const saidaRascunho = await prisma.departure.create({
    data: {
      tripId: tripRascunho.id,
      startAt: emUmMes,
      priceCents: 5_000,
      availability: 'AVAILABLE',
      status: 'DRAFT',
    },
  })

  const produto = await prisma.product.create({
    data: {
      slug: 'camiseta-de-teste',
      name: 'Camiseta de Teste',
      category: 'CAMISETA',
      priceCents: 5_000,
      status: 'PUBLISHED',
      variants: {
        create: [
          { size: 'M', colorName: 'Preto', colorHex: '#000000', available: true, sortOrder: 0 },
          { size: 'G', colorName: 'Preto', colorHex: '#000000', available: false, sortOrder: 1 },
          // Variante com preço próprio, sobrescrevendo o do produto.
          {
            size: 'GG',
            colorName: 'Azul',
            colorHex: '#0000FF',
            available: true,
            priceCents: 6_000,
            sortOrder: 2,
          },
        ],
      },
    },
    include: { variants: { orderBy: { sortOrder: 'asc' } } },
  })

  const [varianteDisponivel, varianteIndisponivel, varianteComPrecoProprio] = produto.variants

  return {
    trip,
    tripRascunho,
    saidaDisponivel,
    saidaEsgotada,
    saidaPassada,
    saidaRascunho,
    produto,
    varianteDisponivel: varianteDisponivel!,
    varianteIndisponivel: varianteIndisponivel!,
    varianteComPrecoProprio: varianteComPrecoProprio!,
    guia,
    tag,
  }
}

/** Monta uma Request para chamar o route handler direto, sem subir servidor. */
export function get(url: string): Request {
  return new Request(`http://localhost:3000${url}`)
}

export function post(url: string, corpo: unknown, headers?: Record<string, string>): Request {
  return new Request(`http://localhost:3000${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(corpo),
  })
}
