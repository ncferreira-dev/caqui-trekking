import { AppError, ErrorCode } from '@/lib/api/errors'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/server/services/audit-service'

/**
 * Operações administrativas de saída.
 *
 * Este arquivo concentra os dois fluxos mais repetidos da operação da Caqui:
 * duplicar a saída para o mês seguinte e mudar a disponibilidade. Os dois
 * precisam ser triviais, porque são feitos toda semana, muitas vezes do
 * celular, entre uma conversa e outra do WhatsApp.
 */

type Contexto = { userId: number; ip: string | null }

// ─────────────────────────────────────────────────────────────────────────────
// DUPLICAR PARA OUTRA DATA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sugere a data equivalente no mês seguinte: mesmo dia da semana, mesma
 * posição no mês.
 *
 * "3º sábado de agosto" → "3º sábado de setembro". Não é `+30 dias`, que
 * jogaria um sábado numa segunda — e a Caqui só opera em fim de semana.
 *
 * O horário local é preservado: uma saída de nascer do sol às 03:00 continua
 * às 03:00, não vira 02:00 ou 04:00 por causa de aritmética em UTC.
 */
export function sugerirProximaData(original: Date): Date {
  const FUSO = 'America/Sao_Paulo'

  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(original)

  const p = (t: string): string => partes.find((x) => x.type === t)?.value ?? '00'
  const ano = Number(p('year'))
  const mes = Number(p('month'))
  const dia = Number(p('day'))
  const hora = p('hour')
  const minuto = p('minute')

  // Dia da semana (0=domingo) e qual ocorrência dele no mês (1ª, 2ª, 3ª…).
  const diaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()
  const ocorrencia = Math.ceil(dia / 7)

  // Primeiro dia do mês seguinte.
  const proxMes = mes === 12 ? 1 : mes + 1
  const proxAno = mes === 12 ? ano + 1 : ano
  const primeiroDiaSemana = new Date(Date.UTC(proxAno, proxMes - 1, 1)).getUTCDay()

  // Primeiro dia do mês que cai no mesmo dia da semana, mais (ocorrência-1) semanas.
  const primeiroCompativel = 1 + ((diaSemana - primeiroDiaSemana + 7) % 7)
  let novoDia = primeiroCompativel + (ocorrencia - 1) * 7

  // Se a 5ª ocorrência não existe no mês seguinte, recua para a última.
  const diasNoMes = new Date(Date.UTC(proxAno, proxMes, 0)).getUTCDate()
  while (novoDia > diasNoMes) novoDia -= 7

  const iso = `${proxAno}-${String(proxMes).padStart(2, '0')}-${String(novoDia).padStart(2, '0')}T${hora}:${minuto}:00-03:00`
  return new Date(iso)
}

/**
 * Duplica uma saída para outra data. É a operação mais repetida do sistema —
 * a Caqui faz isso a cada virada de mês.
 *
 * Copia preço, ponto de encontro, horário e guias. NÃO copia a
 * disponibilidade: a saída nova nasce como `AVAILABLE`, porque herdar
 * `SOLD_OUT` da anterior seria o pior default possível — a agenda nova
 * apareceria esgotada.
 *
 * Nasce em `DRAFT`, para a pessoa conferir antes de publicar.
 */
export async function duplicarSaida(
  departureId: number,
  novaData: Date | undefined,
  ctx: Contexto,
): Promise<{ id: number; startAt: Date }> {
  const original = await prisma.departure.findUnique({
    where: { id: departureId },
    include: { guides: { select: { guideId: true } } },
  })

  if (!original) {
    throw new AppError(ErrorCode.DEPARTURE_NOT_FOUND, 'Saída não encontrada.', { status: 404 })
  }

  const startAt = novaData ?? sugerirProximaData(original.startAt)

  const jaExiste = await prisma.departure.findUnique({
    where: { tripId_startAt: { tripId: original.tripId, startAt } },
    select: { id: true },
  })

  if (jaExiste) {
    // O duplo clique em "duplicar" é o erro clássico aqui. O unique do banco
    // já barraria, mas um 409 com mensagem clara é melhor que um erro de
    // constraint vazando.
    throw new AppError(ErrorCode.CONFLICT, 'Já existe uma saída deste roteiro nesta data e hora.', {
      status: 409,
    })
  }

  return prisma.$transaction(async (tx) => {
    const nova = await tx.departure.create({
      data: {
        tripId: original.tripId,
        startAt,
        endAt: null,
        meetingPoint: original.meetingPoint,
        meetingLat: original.meetingLat,
        meetingLng: original.meetingLng,
        meetingTimeLocal: original.meetingTimeLocal,
        priceCents: original.priceCents,
        compareAtPriceCents: original.compareAtPriceCents,
        availability: 'AVAILABLE',
        status: 'DRAFT',
        internalNotes: original.internalNotes,
        guides: { create: original.guides.map((g) => ({ guideId: g.guideId })) },
      },
      select: { id: true, startAt: true },
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'departure.duplicate',
        entityType: 'Departure',
        entityId: nova.id,
        before: { duplicadaDe: original.id, dataOriginal: original.startAt },
        after: { startAt: nova.startAt, status: 'DRAFT' },
        ip: ctx.ip,
      },
      tx,
    )

    return nova
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPONIBILIDADE — o campo mais mexido do sistema
// ─────────────────────────────────────────────────────────────────────────────

export type Disponibilidade = 'AVAILABLE' | 'LAST_SPOTS' | 'SOLD_OUT'

/**
 * Muda a disponibilidade em uma operação.
 *
 * Precisa ser UM toque na listagem, não um formulário: é o campo mais alterado
 * do sistema inteiro e a pessoa mexe nele do celular.
 *
 * A mudança e o registro do histórico caem na MESMA transação. No projeto de
 * referência, o saldo e o ledger eram duas escritas soltas: se a segunda
 * falhasse, o número mudava sem rastro — exatamente o que a auditoria existe
 * para impedir.
 */
export async function alterarDisponibilidade(
  departureId: number,
  nova: Disponibilidade,
  motivo: string | undefined,
  ctx: Contexto,
): Promise<{ id: number; availability: Disponibilidade }> {
  const atual = await prisma.departure.findUnique({
    where: { id: departureId },
    select: { id: true, availability: true },
  })

  if (!atual) {
    throw new AppError(ErrorCode.DEPARTURE_NOT_FOUND, 'Saída não encontrada.', { status: 404 })
  }

  if (atual.availability === nova) {
    // Não é erro: a pessoa tocou no botão que já estava ativo. Devolve o
    // estado sem gravar histórico de uma mudança que não houve.
    return { id: atual.id, availability: nova }
  }

  return prisma.$transaction(async (tx) => {
    const atualizada = await tx.departure.update({
      where: { id: departureId },
      data: { availability: nova },
      select: { id: true, availability: true },
    })

    await tx.departureAvailabilityChange.create({
      data: {
        departureId,
        from: atual.availability,
        to: nova,
        reason: motivo ?? null,
        userId: ctx.userId,
      },
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'departure.availability',
        entityType: 'Departure',
        entityId: departureId,
        before: { availability: atual.availability },
        after: { availability: nova, motivo: motivo ?? null },
        ip: ctx.ip,
      },
      tx,
    )

    return { id: atualizada.id, availability: atualizada.availability }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// EDITAR — data, hora, preço e ponto de encontro
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Edita uma saída existente.
 *
 * A disponibilidade NÃO entra aqui: ela tem endpoint próprio, com histórico, e
 * misturá-la neste formulário reabriria o caminho lento de "abrir, achar o
 * campo, salvar" que o toque na lista existe para eliminar. O `status`
 * (rascunho → publicado) entra, porque publicar é o que tira a saída da gaveta
 * e a coloca na agenda, e é uma decisão consciente, não um toque de rotina.
 *
 * A troca de data revalida o unique (roteiro + instante): mover a saída para
 * cima de outra do mesmo roteiro é o erro que o banco barraria com uma
 * constraint crua; aqui vira 409 com frase legível, antes da escrita.
 */
export async function atualizarSaida(
  departureId: number,
  campos: {
    startAt?: Date
    priceCents?: number
    compareAtPriceCents?: number | null
    meetingPoint?: string | null
    meetingTimeLocal?: string | null
    meetingLat?: number | null
    meetingLng?: number | null
    status?: 'DRAFT' | 'PUBLISHED'
  },
  ctx: Contexto,
): Promise<{ id: number }> {
  const atual = await prisma.departure.findUnique({
    where: { id: departureId },
    select: { id: true, tripId: true, startAt: true, priceCents: true, status: true },
  })

  if (!atual) {
    throw new AppError(ErrorCode.DEPARTURE_NOT_FOUND, 'Saída não encontrada.', { status: 404 })
  }

  if (atual.status === 'CANCELLED') {
    // Editar uma saída cancelada a ressuscitaria pela porta dos fundos, sem
    // passar pela decisão de republicar. Quem quer a data de volta duplica.
    throw new AppError(
      ErrorCode.CONFLICT,
      'Saída cancelada não é editável. Duplique para recriar.',
      {
        status: 409,
      },
    )
  }

  // Só checa colisão se a data mudou de fato — reenviar a mesma data no submit
  // é o caso comum, e ele não pode falir contra a própria saída.
  if (campos.startAt && campos.startAt.getTime() !== atual.startAt.getTime()) {
    const colisao = await prisma.departure.findUnique({
      where: { tripId_startAt: { tripId: atual.tripId, startAt: campos.startAt } },
      select: { id: true },
    })
    if (colisao && colisao.id !== departureId) {
      throw new AppError(
        ErrorCode.CONFLICT,
        'Já existe uma saída deste roteiro nesta data e hora.',
        { status: 409 },
      )
    }
  }

  return prisma.$transaction(async (tx) => {
    const depois = await tx.departure.update({
      where: { id: departureId },
      data: campos,
      select: { id: true, startAt: true, priceCents: true, status: true },
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'departure.update',
        entityType: 'Departure',
        entityId: departureId,
        before: { startAt: atual.startAt, priceCents: atual.priceCents, status: atual.status },
        after: { startAt: depois.startAt, priceCents: depois.priceCents, status: depois.status },
        ip: ctx.ip,
      },
      tx,
    )

    return { id: depois.id }
  })
}

// ─────────────────────────────────────────────────────────────────────────────

export async function cancelarSaida(
  departureId: number,
  motivo: string | undefined,
  ctx: Contexto,
): Promise<{ id: number }> {
  const atual = await prisma.departure.findUnique({
    where: { id: departureId },
    select: { id: true, status: true, startAt: true, tripId: true },
  })

  if (!atual) {
    throw new AppError(ErrorCode.DEPARTURE_NOT_FOUND, 'Saída não encontrada.', { status: 404 })
  }

  return prisma.$transaction(async (tx) => {
    const cancelada = await tx.departure.update({
      where: { id: departureId },
      data: { status: 'CANCELLED' },
      select: { id: true },
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'departure.cancel',
        entityType: 'Departure',
        entityId: departureId,
        before: { status: atual.status },
        after: { status: 'CANCELLED', motivo: motivo ?? null },
        ip: ctx.ip,
      },
      tx,
    )

    return cancelada
  })
}

/** Cria uma saída a partir de um roteiro, herdando o preço como sugestão. */
export async function criarSaida(
  dados: {
    tripId: number
    startAt: Date
    priceCents: number
    compareAtPriceCents?: number | null
    meetingPoint?: string | undefined
    meetingTimeLocal?: string | undefined
    meetingLat?: number | null
    meetingLng?: number | null
    internalNotes?: string | undefined
  },
  ctx: Contexto,
): Promise<{ id: number }> {
  const trip = await prisma.trip.findFirst({
    where: { id: dados.tripId, deletedAt: null },
    select: { id: true },
  })

  if (!trip) {
    throw new AppError(ErrorCode.TRIP_NOT_FOUND, 'Roteiro não encontrado.', { status: 404 })
  }

  const jaExiste = await prisma.departure.findUnique({
    where: { tripId_startAt: { tripId: dados.tripId, startAt: dados.startAt } },
    select: { id: true },
  })

  if (jaExiste) {
    throw new AppError(ErrorCode.CONFLICT, 'Já existe uma saída deste roteiro nesta data e hora.', {
      status: 409,
    })
  }

  return prisma.$transaction(async (tx) => {
    const nova = await tx.departure.create({
      data: {
        tripId: dados.tripId,
        startAt: dados.startAt,
        priceCents: dados.priceCents,
        compareAtPriceCents: dados.compareAtPriceCents ?? null,
        meetingPoint: dados.meetingPoint ?? null,
        meetingTimeLocal: dados.meetingTimeLocal ?? null,
        meetingLat: dados.meetingLat ?? null,
        meetingLng: dados.meetingLng ?? null,
        internalNotes: dados.internalNotes ?? null,
        availability: 'AVAILABLE',
        status: 'DRAFT',
      },
      select: { id: true },
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'departure.create',
        entityType: 'Departure',
        entityId: nova.id,
        after: { tripId: dados.tripId, startAt: dados.startAt, priceCents: dados.priceCents },
        ip: ctx.ip,
      },
      tx,
    )

    return nova
  })
}
