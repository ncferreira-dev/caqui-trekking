import bcrypt from 'bcryptjs'

import { PrismaClient } from '../src/generated/prisma/client'
import { createPgAdapter } from '../src/lib/db-adapter'
import { ContentStatus, DepartureStatus, Difficulty } from '../src/generated/prisma/enums'

/**
 * Seed idempotente.
 *
 * Rodar duas vezes NÃO duplica nada: tudo entra por `upsert` sobre a chave
 * natural (slug, email, id do singleton, par único da variante). O projeto de
 * referência tinha 6 scripts de backfill sem registro de execução — descobrir
 * se um já havia rodado exigia abrir o banco e olhar.
 *
 *   npx prisma db seed
 */

const connectionString = process.env['DATABASE_URL']
if (!connectionString) {
  throw new Error('DATABASE_URL não definida. Copie o .env.example para .env')
}

const prisma = new PrismaClient({ adapter: createPgAdapter(connectionString) })

/** Converte um horário local de São Paulo para o instante UTC correspondente. */
function saoPaulo(dataHoraLocal: string): Date {
  // O offset do Brasil é fixo em -03:00 desde o fim do horário de verão (2019).
  // Explicitar aqui é melhor que depender do fuso da máquina que roda o seed —
  // no projeto de referência, `grep timeZone` no código inteiro retornava zero.
  return new Date(`${dataHoraLocal}-03:00`)
}

// =============================================================================
// TAGS DE ATIVIDADE
// =============================================================================

const TAGS = [
  { slug: 'rapel', label: 'Rapel', icon: 'rope' },
  { slug: 'tirolesa', label: 'Tirolesa', icon: 'zipline' },
  { slug: 'cachoeira', label: 'Cachoeira', icon: 'waterfall' },
  { slug: 'trilha', label: 'Trilha', icon: 'boot' },
  { slug: 'escalaminhada', label: 'Escalaminhada', icon: 'climb' },
  { slug: 'nascer-do-sol', label: 'Nascer do sol', icon: 'sunrise' },
  { slug: 'camping', label: 'Camping', icon: 'tent' },
  { slug: 'boia-cross', label: 'Boia cross', icon: 'raft' },
] as const

// =============================================================================
// EXPEDIÇÕES — agenda real de agosto/2026
// =============================================================================
// A saída de 08/08 JÁ PASSOU de propósito: serve para verificar a exibição de
// saída encerrada, que é derivada de `startAt < now()` e não de um campo.

const EXPEDICOES = [
  {
    slug: 'fazenda-santa-rita-cachoeira-do-paredao',
    title: 'Fazenda Santa Rita · Cachoeira do Paredão',
    subtitle: 'Rapel na cachoeira, café da manhã e feijoada',
    description:
      'Dia completo na Fazenda Santa Rita: trilha até a Cachoeira do Paredão, rapel na parede da queda e ' +
      'almoço de feijoada na sede. Roteiro tranquilo, bom para quem está começando e quer experimentar ' +
      'rapel com segurança e acompanhamento de monitor credenciado.',
    city: 'Mogi das Cruzes',
    state: 'SP',
    region: 'Alto Tietê',
    difficulty: Difficulty.MODERADO,
    distanceKm: '6.50',
    elevationGainM: 280,
    durationMinutes: 480,
    minAge: 12,
    tags: ['cachoeira', 'rapel', 'trilha'],
    highlights: [
      'Rapel na parede da cachoeira',
      'Café da manhã caseiro',
      'Feijoada na sede da fazenda',
    ],
    included: ['Guia Cadastur', 'Equipamento de rapel', 'Café da manhã', 'Feijoada', 'Seguro'],
    notIncluded: ['Transporte até a fazenda', 'Bebidas alcoólicas'],
    whatToBring: [
      'Tênis fechado',
      'Roupa que possa molhar',
      'Protetor solar',
      'Água (1,5 L)',
      'Toalha',
    ],
    departure: {
      startAtLocal: '2026-08-08T07:00:00',
      meetingPoint: 'Portaria da Fazenda Santa Rita, Mogi das Cruzes/SP',
      capacity: 15,
      seatsTaken: 4,
      meetingTimeLocal: '07:00',
      priceCents: 19_990,
    },
  },
  {
    slug: 'pedra-grande-de-quatinga',
    title: 'Pedra Grande de Quatinga',
    subtitle: 'Rapel e trilha com vista do Alto Tietê',
    description:
      'Trilha até a Pedra Grande de Quatinga, com vista aberta do vale, e rapel na face da pedra. ' +
      'É o roteiro de entrada da Caqui: distância curta, técnica baixa e a primeira experiência de rapel ' +
      'de muita gente que hoje sai com a gente todo mês.',
    city: 'Mogi das Cruzes',
    state: 'SP',
    region: 'Alto Tietê',
    difficulty: Difficulty.MODERADO,
    distanceKm: '5.00',
    elevationGainM: 320,
    maxAltitudeM: 980,
    durationMinutes: 360,
    minAge: 10,
    tags: ['rapel', 'trilha'],
    highlights: ['Vista aberta do vale do Tietê', 'Rapel de 35 m', 'Roteiro ideal para iniciantes'],
    included: ['Guia Cadastur', 'Equipamento de rapel', 'Seguro'],
    notIncluded: ['Transporte', 'Alimentação'],
    whatToBring: ['Tênis fechado', 'Água (2 L)', 'Lanche', 'Protetor solar', 'Boné'],
    departure: {
      startAtLocal: '2026-08-15T06:00:00',
      meetingPoint: 'Praça de Quatinga, Mogi das Cruzes/SP',
      capacity: 20,
      seatsTaken: 6,
      meetingTimeLocal: '06:00',
      priceCents: 9_000,
    },
  },
  {
    slug: 'mega-tirolesa-2km-e-rapel-50m',
    title: 'Mega Tirolesa de 2 km + Rapel de 50 m',
    subtitle: 'Dois quilômetros de tirolesa sobre o vale',
    description:
      'A maior tirolesa da região, com 2 km de extensão sobre o vale, somada a um rapel de 50 m. ' +
      'Não exige preparo físico: é adrenalina com deslocamento curto a pé, boa para grupos e para quem ' +
      'quer a experiência sem encarar uma trilha longa.',
    city: 'Mogi das Cruzes',
    state: 'SP',
    region: 'Alto Tietê',
    difficulty: Difficulty.FACIL,
    distanceKm: '2.00',
    durationMinutes: 300,
    minAge: 12,
    tags: ['tirolesa', 'rapel'],
    highlights: ['Tirolesa de 2 km', 'Rapel de 50 m', 'Sem exigência de preparo físico'],
    included: ['Monitor credenciado PESM', 'Equipamento completo', 'Seguro'],
    notIncluded: ['Transporte', 'Alimentação', 'Fotos profissionais'],
    whatToBring: ['Tênis fechado', 'Água', 'Protetor solar'],
    departure: {
      startAtLocal: '2026-08-16T08:00:00',
      meetingPoint: 'Base da tirolesa, estrada de Taiaçupeba, Mogi das Cruzes/SP',
      capacity: 10,
      seatsTaken: 10,
      meetingTimeLocal: '08:00',
      priceCents: 29_900,
    },
  },
  {
    slug: 'nascer-do-sol-pico-do-lopo',
    title: 'Nascer do Sol no Pico do Lopo',
    subtitle: 'Trilha noturna e rapel na descida',
    description:
      'Saída de madrugada para pegar o nascer do sol no alto do Pico do Lopo, com mar de nuvens em dias ' +
      'frios, e rapel na descida. Exige disposição para caminhar no escuro com lanterna de cabeça e ' +
      'alguma experiência prévia em trilha.',
    city: 'Extrema',
    state: 'MG',
    region: 'Serra da Mantiqueira',
    difficulty: Difficulty.DIFICIL,
    distanceKm: '8.00',
    elevationGainM: 720,
    maxAltitudeM: 1750,
    durationMinutes: 480,
    minAge: 16,
    requiresExperience: true,
    tags: ['nascer-do-sol', 'trilha', 'rapel'],
    highlights: ['Nascer do sol no cume', 'Mar de nuvens em dias frios', 'Rapel na descida'],
    included: ['Guia Cadastur', 'Equipamento de rapel', 'Seguro'],
    notIncluded: ['Transporte', 'Alimentação', 'Lanterna de cabeça'],
    whatToBring: [
      'Lanterna de cabeça (obrigatória)',
      'Blusa de frio e corta-vento',
      'Tênis de trilha',
      'Água (2 L)',
      'Lanche de trilha',
    ],
    departure: {
      startAtLocal: '2026-08-23T03:00:00',
      meetingPoint: 'Portal de Extrema/MG, na Fernão Dias',
      capacity: 12,
      seatsTaken: 5,
      meetingTimeLocal: '03:00',
      priceCents: 27_900,
    },
  },
  {
    slug: 'escalavrado-teresopolis',
    title: 'Escalavrado · Teresópolis',
    subtitle: '1.420 m no Parque Nacional da Serra dos Órgãos',
    description:
      'O Escalavrado é uma das silhuetas mais reconhecíveis da Serra dos Órgãos e faz parte do perfil do ' +
      'Dedo de Deus visto de Teresópolis. Roteiro de nível difícil, com trechos de escalaminhada expostos ' +
      'e uso de corda. Vagas extremamente limitadas por exigência técnica.',
    city: 'Teresópolis',
    state: 'RJ',
    region: 'Serra dos Órgãos',
    difficulty: Difficulty.DIFICIL,
    distanceKm: '9.50',
    elevationGainM: 900,
    maxAltitudeM: 1420,
    durationMinutes: 600,
    minAge: 18,
    requiresExperience: true,
    tags: ['trilha', 'escalaminhada'],
    highlights: ['Cume a 1.420 m', 'Trechos de escalaminhada com corda', 'Vista do Dedo de Deus'],
    included: ['Guia Cadastur', 'Equipamento de segurança', 'Seguro'],
    notIncluded: ['Transporte até Teresópolis', 'Hospedagem', 'Alimentação'],
    whatToBring: [
      'Tênis de trilha com boa aderência',
      'Luva de escalada',
      'Água (2,5 L)',
      'Lanche de trilha',
      'Corta-vento',
    ],
    departure: {
      startAtLocal: '2026-08-29T05:00:00',
      meetingPoint: 'Sede Teresópolis do PARNASO, Teresópolis/RJ',
      capacity: 8,
      seatsTaken: 6,
      meetingTimeLocal: '05:00',
      priceCents: 42_500,
    },
  },
] as const

// =============================================================================
// CAQUI WEAR
// =============================================================================
// Peças e preços reais, tirados das fotos do catálogo da marca.

const PRODUTOS = [
  {
    slug: 'camiseta-dry-fit-caqui',
    name: 'Camiseta Dry Fit Caqui',
    description:
      'Camiseta dry fit com proteção UV, leve e de secagem rápida. Feita para trilha em dia quente.',
    category: 'CAMISETA',
    priceCents: 5_000,
    featured: true,
    variants: [
      { size: 'P', colorName: 'Azul Marinho', colorHex: '#1B2A4A' },
      { size: 'M', colorName: 'Azul Marinho', colorHex: '#1B2A4A' },
      { size: 'G', colorName: 'Azul Marinho', colorHex: '#1B2A4A' },
      { size: 'GG', colorName: 'Azul Marinho', colorHex: '#1B2A4A' },
      { size: 'P', colorName: 'Cinza Chumbo', colorHex: '#4A4A4A' },
      { size: 'M', colorName: 'Cinza Chumbo', colorHex: '#4A4A4A' },
      // Combinação esgotada de propósito: a UI precisa mostrar o desabilitado,
      // não sumir com a opção. A pessoa precisa saber que ela existe.
      { size: 'G', colorName: 'Cinza Chumbo', colorHex: '#4A4A4A', available: false },
    ],
  },
  {
    slug: 'baby-look-dry-fit-caqui',
    name: 'Baby Look Dry Fit Caqui',
    description: 'Baby look dry fit com proteção UV. Modelagem feminina, secagem rápida.',
    category: 'CAMISETA',
    priceCents: 5_000,
    featured: true,
    variants: [
      { size: 'P', colorName: 'Laranja', colorHex: '#F26522' },
      { size: 'M', colorName: 'Laranja', colorHex: '#F26522' },
      { size: 'G', colorName: 'Laranja', colorHex: '#F26522' },
      { size: 'P', colorName: 'Fúcsia', colorHex: '#C2185B' },
      { size: 'M', colorName: 'Fúcsia', colorHex: '#C2185B' },
      { size: 'P', colorName: 'Cinza Prata', colorHex: '#B0B3B8' },
      { size: 'M', colorName: 'Cinza Prata', colorHex: '#B0B3B8' },
    ],
  },
  {
    slug: 'caneca-caqui-trekking',
    name: 'Caneca Caqui Trekking',
    description: 'Caneca de cerâmica 325 ml com a logo da Caqui. Para o café antes de subir.',
    category: 'ACESSORIO',
    priceCents: 3_500,
    variants: [{ size: 'UNICO', colorName: 'Branca', colorHex: '#FFFFFF' }],
  },

  // ── Óculos de sol ─────────────────────────────────────────────────────────
  // 10 modelos, levantados foto a foto. Ver docs/09-oculos.md.
  //
  // FORMATO é produto e COR é variante, porque o eixo de variante do schema é
  // `size × colorName` e não existe eixo de formato. Todas com `size: UNICO`.
  //
  // O preço acompanha o material da haste — acetato R$ 59,90, madeira R$ 71,90,
  // espelhado R$ 89,90 — então a linha caiu pronta do próprio catálogo.
  {
    slug: 'oculos-glacier-caqui',
    name: 'Óculos Glacier Caqui',
    description:
      'Óculos de sol estilo montanhismo, com aba lateral perfurada que corta a luz que entra pelo canto do olho. Lente marrom, armação em acetato.',
    category: 'ACESSORIO',
    priceCents: 5_990,
    sortOrder: 10,
    variants: [{ size: 'UNICO', colorName: 'Marrom Escuro', colorHex: '#4A3B32' }],
  },
  {
    slug: 'oculos-quadrado-caqui',
    name: 'Óculos Quadrado Caqui',
    description: 'Armação quadrada preta fosca em acetato, com lente espelhada prateada.',
    category: 'ACESSORIO',
    priceCents: 5_990,
    sortOrder: 11,
    variants: [{ size: 'UNICO', colorName: 'Preto', colorHex: '#0D0D0D' }],
  },
  {
    slug: 'oculos-redondo-caqui',
    name: 'Óculos Redondo Caqui',
    description: 'Armação redonda em acetato translúcido, lente marrom. Silhueta clássica.',
    category: 'ACESSORIO',
    priceCents: 5_990,
    sortOrder: 12,
    variants: [{ size: 'UNICO', colorName: 'Vinho Translúcido', colorHex: '#6B2F2F' }],
  },
  {
    slug: 'oculos-aviador-redondo-caqui',
    name: 'Óculos Aviador Redondo Caqui',
    description:
      'Lentes redondas com ponte dupla, a barra reta ligando os aros, do aviador clássico. Lente cinza escura.',
    category: 'ACESSORIO',
    priceCents: 5_990,
    sortOrder: 13,
    variants: [{ size: 'UNICO', colorName: 'Marrom Escuro', colorHex: '#3A2E28' }],
  },
  {
    slug: 'oculos-wayfarer-caqui',
    name: 'Óculos Wayfarer Caqui',
    description: 'O wayfarer da Caqui em acetato, com a marca gravada na haste. Quatro cores.',
    category: 'ACESSORIO',
    priceCents: 5_990,
    sortOrder: 14,
    variants: [
      { size: 'UNICO', colorName: 'Preto', colorHex: '#0D0D0D' },
      { size: 'UNICO', colorName: 'Preto Degradê', colorHex: '#2B2B2B' },
      { size: 'UNICO', colorName: 'Marrom Degradê', colorHex: '#6E6058' },
      { size: 'UNICO', colorName: 'Marrom Avermelhado', colorHex: '#5A3A32' },
    ],
  },
  {
    slug: 'oculos-quadrado-madeira-caqui',
    name: 'Óculos Quadrado Madeira Caqui',
    description: 'Armação quadrada com haste de madeira e a marca gravada. Lente polarizada.',
    category: 'ACESSORIO',
    priceCents: 7_190,
    sortOrder: 15,
    variants: [
      { size: 'UNICO', colorName: 'Preto', colorHex: '#0D0D0D' },
      { size: 'UNICO', colorName: 'Vinho Translúcido', colorHex: '#6B2F2F' },
    ],
  },
  {
    slug: 'oculos-redondo-madeira-caqui',
    name: 'Óculos Redondo Madeira Caqui',
    description: 'Aro redondo com haste de madeira. Lente marrom.',
    category: 'ACESSORIO',
    priceCents: 7_190,
    sortOrder: 16,
    variants: [
      { size: 'UNICO', colorName: 'Preto', colorHex: '#0D0D0D' },
      { size: 'UNICO', colorName: 'Marrom Avermelhado', colorHex: '#5A3A32' },
    ],
  },
  {
    slug: 'oculos-wayfarer-madeira-caqui',
    name: 'Óculos Wayfarer Madeira Caqui',
    description: 'O wayfarer com haste de madeira e a marca gravada. Três cores.',
    category: 'ACESSORIO',
    priceCents: 7_190,
    sortOrder: 17,
    variants: [
      { size: 'UNICO', colorName: 'Preto', colorHex: '#0D0D0D' },
      { size: 'UNICO', colorName: 'Marrom Escuro', colorHex: '#4A3B32' },
      { size: 'UNICO', colorName: 'Vinho Translúcido', colorHex: '#6B2F2F' },
    ],
  },
  {
    slug: 'oculos-hexagonal-madeira-caqui',
    name: 'Óculos Hexagonal Madeira Caqui',
    description: 'Aro hexagonal com haste de madeira e lente espelhada dourada.',
    category: 'ACESSORIO',
    priceCents: 7_190,
    sortOrder: 18,
    variants: [{ size: 'UNICO', colorName: 'Preto', colorHex: '#0D0D0D' }],
  },
  {
    slug: 'oculos-espelhado-laranja-caqui',
    name: 'Óculos Espelhado Laranja Caqui',
    description:
      'Wayfarer laranja fosco com lente espelhada laranja, a cor da marca inteira, do aro à lente.',
    category: 'ACESSORIO',
    priceCents: 8_990,
    sortOrder: 19,
    // O único com a cor da marca do aro à lente. Vitrine.
    featured: true,
    variants: [{ size: 'UNICO', colorName: 'Laranja', colorHex: '#F26522' }],
  },
] as const

// =============================================================================
// GUIAS
// =============================================================================
// Dados de exemplo — os reais entram pelo CRM. Servem para a página de
// expedição ter o bloco "guias responsáveis" testável desde já.

/**
 * ⚠️ OS EXEMPLOS NÃO CARREGAM NÚMERO DE CREDENCIAL. NUNCA.
 *
 * Até 18/08/2026 estes dois registros traziam `cadasturNumber:
 * '00.000000.00-0'` e `pesmCredential: 'PESM-0000'` — e o site EM PRODUÇÃO
 * publicava os dois em `/sobre`, dentro de uma etiqueta escrita "Cadastur".
 *
 * Cadastur é registro do Ministério do Turismo e PESM é credenciamento do
 * Parque Estadual da Serra do Mar. Publicar um número inventado ao lado desses
 * nomes é alegar credencial de atividade regulada. O "(exemplo)" no nome
 * atenua para quem lê com atenção e não atenua nada para quem bate o olho na
 * etiqueta — nem para um print em conversa de WhatsApp.
 *
 * A regra que fica: dado de credencial é `null` até a Caqui informar o real.
 * Ausência é honesta; número de mentira não é. É a mesma doutrina que já vale
 * para `cadasturNumber` e `pesmCredentials` em `site_settings`, retirados do
 * seed pelo mesmo motivo.
 */
const GUIAS = [
  {
    name: 'Guia responsável (exemplo)',
    bio: 'Guia de turismo cadastrado no Cadastur, com atuação em trilhas e rapel no Alto Tietê.',
    sortOrder: 1,
  },
  {
    name: 'Monitor credenciado PESM (exemplo)',
    bio: 'Monitor ambiental credenciado pelo Parque Estadual da Serra do Mar.',
    sortOrder: 2,
  },
] as const

// =============================================================================
async function main() {
  console.log('▸ Seed iniciado\n')

  // --- SiteSetting (singleton) ----------------------------------------------
  const template = [
    'Olá! Vim pelo site 🌄',
    '',
    '*MEU PEDIDO*',
    '',
    '{{itens}}',
    '',
    '*Total: {{total}}*',
  ].join('\n')

  await prisma.siteSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      whatsappNumber: '5511943017232',
      whatsappMessageTemplate: template,
      instagramTrekking: '@caquitrekking',
      instagramWear: '@caqui.wear',
      // Cadastur e PESM ficam VAZIOS de propósito: são credenciais reais, e o
      // rodapé só mostra a linha quando há valor (footer.tsx). Preencher com um
      // texto-placeholder ("a preencher", "monitores credenciados") fazia o
      // site exibir isso como se fosse a credencial. O dono coloca a real no
      // CRM (Config); até lá, não aparece nada — melhor que aparecer um rótulo.
      heroTitle: 'A serra começa aqui',
      heroSubtitle: 'Ecoturismo e aventura em Mogi das Cruzes e região',
    },
  })
  console.log('  ✓ SiteSetting')

  // --- Tags -----------------------------------------------------------------
  for (const tag of TAGS) {
    await prisma.activityTag.upsert({
      where: { slug: tag.slug },
      update: { label: tag.label, icon: tag.icon },
      create: { slug: tag.slug, label: tag.label, icon: tag.icon },
    })
  }
  console.log(`  ✓ ${TAGS.length} tags de atividade`)

  // --- Guias ----------------------------------------------------------------
  // Guide não tem chave natural única, então a idempotência é por nome.
  const guiaIds: number[] = []
  for (const guia of GUIAS) {
    const existente = await prisma.guide.findFirst({ where: { name: guia.name } })
    const salvo = existente
      ? await prisma.guide.update({ where: { id: existente.id }, data: { ...guia } })
      : await prisma.guide.create({ data: { ...guia } })
    guiaIds.push(salvo.id)
  }
  console.log(`  ✓ ${GUIAS.length} guias`)

  // --- Expedições e saídas --------------------------------------------------
  for (const exp of EXPEDICOES) {
    const { departure, tags, ...dadosTrip } = exp

    const trip = await prisma.trip.upsert({
      where: { slug: exp.slug },
      update: {},
      create: {
        ...dadosTrip,
        highlights: [...dadosTrip.highlights],
        included: [...dadosTrip.included],
        notIncluded: [...dadosTrip.notIncluded],
        whatToBring: [...dadosTrip.whatToBring],
        status: ContentStatus.PUBLISHED,
        cancellationPolicy:
          'Cancelamento com até 7 dias de antecedência: reembolso integral. ' +
          'Entre 7 e 3 dias: 50%. Menos de 3 dias: sem reembolso. ' +
          'Cancelamento por chuva forte é remarcado sem custo.',
      },
    })

    for (const slugTag of tags) {
      const tag = await prisma.activityTag.findUniqueOrThrow({ where: { slug: slugTag } })
      await prisma.tripActivityTag.upsert({
        where: { tripId_activityTagId: { tripId: trip.id, activityTagId: tag.id } },
        update: {},
        create: { tripId: trip.id, activityTagId: tag.id },
      })
    }

    const startAt = saoPaulo(departure.startAtLocal)
    const saida = await prisma.departure.upsert({
      where: { tripId_startAt: { tripId: trip.id, startAt } },
      update: {},
      create: {
        tripId: trip.id,
        startAt,
        meetingPoint: departure.meetingPoint,
        meetingTimeLocal: departure.meetingTimeLocal,
        priceCents: departure.priceCents,
        // A DISPONIBILIDADE NÃO É SEMEADA. Ela sai da conta.
        //
        // Até 18/08/2026 cada saída trazia um `availability` fixo aqui, e o
        // seed era mais um lugar capaz de escrever aquele campo sem passar
        // pelo histórico. Agora o seed semeia os dois números do livro do
        // operador, e o selo do site é derivado deles em
        // `src/lib/vagas.ts` — inclusive o "esgotado" da tirolesa (10 de 10) e
        // o "últimas vagas" do Escalavrado (2 restantes, limiar 3).
        capacity: departure.capacity,
        seatsTaken: departure.seatsTaken,
        status: DepartureStatus.PUBLISHED,
      },
    })

    for (const guiaId of guiaIds) {
      await prisma.departureGuide.upsert({
        where: { departureId_guideId: { departureId: saida.id, guideId: guiaId } },
        update: {},
        create: { departureId: saida.id, guideId: guiaId },
      })
    }
  }
  console.log(`  ✓ ${EXPEDICOES.length} expedições, cada uma com 1 saída`)

  // --- Caqui Wear -----------------------------------------------------------
  for (const prod of PRODUTOS) {
    const { variants, ...dadosProduto } = prod

    const produto = await prisma.product.upsert({
      where: { slug: prod.slug },
      update: {},
      create: { ...dadosProduto, status: ContentStatus.PUBLISHED },
    })

    for (const [i, v] of variants.entries()) {
      await prisma.productVariant.upsert({
        where: {
          productId_size_colorName: {
            productId: produto.id,
            size: v.size,
            colorName: v.colorName,
          },
        },
        update: {},
        create: {
          productId: produto.id,
          size: v.size,
          colorName: v.colorName,
          colorHex: v.colorHex,
          available: 'available' in v ? v.available : true,
          sortOrder: i,
        },
      })
    }
  }
  const totalVariantes = PRODUTOS.reduce((n, p) => n + p.variants.length, 0)
  console.log(`  ✓ ${PRODUTOS.length} produtos, ${totalVariantes} variantes`)

  // --- Usuário OWNER --------------------------------------------------------
  // Senha vem do ambiente. Nunca literal no código, nunca lida em runtime pela
  // aplicação — só aqui, no seed.
  const ownerEmail = process.env['SEED_OWNER_EMAIL']
  const ownerPassword = process.env['SEED_OWNER_PASSWORD']

  if (!ownerEmail || !ownerPassword) {
    throw new Error(
      'SEED_OWNER_EMAIL e SEED_OWNER_PASSWORD são obrigatórias para criar o usuário OWNER.\n' +
        'Defina as duas no .env antes de rodar o seed.',
    )
  }
  if (ownerPassword.length < 12) {
    throw new Error('SEED_OWNER_PASSWORD precisa ter pelo menos 12 caracteres.')
  }

  await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: {
      email: ownerEmail,
      // Cost 12: o padrão 10 é fraco demais para uma credencial que abre o CRM
      // inteiro. O projeto de referência comparava a senha com `===` contra uma
      // variável de ambiente, sem hash nenhum.
      passwordHash: await bcrypt.hash(ownerPassword, 12),
      name: 'Caqui Trekking',
      role: 'OWNER',
    },
  })
  console.log('  ✓ usuário OWNER')

  console.log('\n▸ Seed concluído.')
}

main()
  .catch((erro: unknown) => {
    console.error('\n✖ Seed falhou:\n', erro)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
