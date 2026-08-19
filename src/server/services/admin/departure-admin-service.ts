import { AppError, ErrorCode } from '@/lib/api/errors'
import { prisma } from '@/lib/prisma'
import { estadoDeVagas } from '@/lib/vagas'
import type { Prisma } from '@/generated/prisma/client'
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
// VAGAS E DISPONIBILIDADE
// ─────────────────────────────────────────────────────────────────────────────
//
// Até 18/08/2026 esta seção se chamava "o campo mais mexido do sistema", e o
// nome era honesto: a disponibilidade era um enum que alguém escolhia na mão,
// várias vezes por semana. A Caqui fecha vaga no WhatsApp, e entre fechar a
// última e lembrar de abrir o CRM existia uma janela em que o site anunciava
// vaga já vendida.
//
// Agora são duas operações diferentes, e a distinção é o ponto:
//
//   lancarVagas             o livro do operador. "fechei mais duas."
//   declararDisponibilidade a exceção. "hoje não sai, o parque interditou."
//
// A primeira é o dia a dia; a segunda é rara e precisa de motivo. As duas
// gravam no mesmo histórico, porque quem pergunta "por que essa saída ficou
// esgotada no dia 3?" não quer saber por qual das duas portas isso passou.

export type Disponibilidade = 'AVAILABLE' | 'LAST_SPOTS' | 'SOLD_OUT'

const SELECT_VAGAS = {
  id: true,
  capacity: true,
  seatsTaken: true,
  lastSpotsAt: true,
  availabilityOverride: true,
} as const

type LinhaDeVagas = {
  id: number
  capacity: number | null
  seatsTaken: number
  lastSpotsAt: number
  availabilityOverride: Disponibilidade | null
}

/** O selo que o SITE mostra hoje para esta saída. */
function seloDe(linha: LinhaDeVagas): Disponibilidade {
  return estadoDeVagas(linha).disponibilidade
}

async function exigirSaida(departureId: number): Promise<LinhaDeVagas> {
  const linha = await prisma.departure.findUnique({
    where: { id: departureId },
    select: SELECT_VAGAS,
  })
  if (!linha) {
    throw new AppError(ErrorCode.DEPARTURE_NOT_FOUND, 'Saída não encontrada.', { status: 404 })
  }
  return linha as LinhaDeVagas
}

/**
 * Registra a mudança de selo no histórico, quando houve mudança.
 *
 * `from` e `to` guardam o que o SITE mostrava, não o valor cru da coluna. É a
 * pergunta que alguém realmente faz seis meses depois, e ela não distingue se
 * o selo mudou porque a última vaga fechou ou porque choveu.
 */
async function registrarSelo(
  tx: Prisma.TransactionClient,
  departureId: number,
  de: Disponibilidade,
  para: Disponibilidade,
  motivo: string | null,
  ctx: Contexto,
): Promise<void> {
  if (de === para) return
  await tx.departureAvailabilityChange.create({
    data: { departureId, from: de, to: para, reason: motivo, userId: ctx.userId },
  })
}

/**
 * O LIVRO DO OPERADOR: quantas vagas já fecharam.
 *
 * `seatsTaken` é lançado, não decrementado por reserva: a Caqui não vende no
 * site. Quem fecha a venda na conversa abre o CRM e lança o número total, não
 * um delta — total é o que a pessoa tem na cabeça ("são cinco agora"), e delta
 * exige que ela lembre do valor anterior.
 *
 * ⚠️ OVERBOOKING É ACEITO. Dois guias vendendo ao mesmo tempo acontece, e um
 * sistema que recusa o lançamento faz a pessoa mentir o número para conseguir
 * salvar — e aí o relatório de lucro nasce errado. O excedente vira alerta no
 * painel, não erro na tela.
 */
export async function lancarVagas(
  departureId: number,
  entrada: { seatsTaken: number; capacity?: number | null; lastSpotsAt?: number },
  ctx: Contexto,
): Promise<LinhaDeVagas> {
  const atual = await exigirSaida(departureId)
  const seloAntes = seloDe(atual)

  const dados = {
    seatsTaken: entrada.seatsTaken,
    ...(entrada.capacity !== undefined ? { capacity: entrada.capacity } : {}),
    ...(entrada.lastSpotsAt !== undefined ? { lastSpotsAt: entrada.lastSpotsAt } : {}),
  }

  return prisma.$transaction(async (tx) => {
    const depois = (await tx.departure.update({
      where: { id: departureId },
      data: dados,
      select: SELECT_VAGAS,
    })) as LinhaDeVagas

    await registrarSelo(tx, departureId, seloAntes, seloDe(depois), 'lançamento de vagas', ctx)

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'departure.vagas',
        entityType: 'Departure',
        entityId: departureId,
        before: { seatsTaken: atual.seatsTaken, capacity: atual.capacity },
        after: { seatsTaken: depois.seatsTaken, capacity: depois.capacity },
        ip: ctx.ip,
      },
      tx,
    )

    return depois
  })
}

/**
 * A EXCEÇÃO: forçar um selo contra a conta, ou desfazer a exceção.
 *
 * `null` devolve o controle para a contagem. É a operação que faltava no
 * sistema antigo: com um campo só, não havia como dizer "esqueça o que eu
 * marquei, use o número" — a pessoa tinha que adivinhar qual valor recolocar.
 *
 * Exige motivo justamente porque é exceção. Um override sem motivo, seis meses
 * depois, é indistinguível de um clique errado.
 */
export async function declararDisponibilidade(
  departureId: number,
  excecao: Disponibilidade | null,
  motivo: string | undefined,
  ctx: Contexto,
): Promise<LinhaDeVagas> {
  const atual = await exigirSaida(departureId)

  if (atual.availabilityOverride === excecao) {
    // A pessoa tocou no botão que já estava ativo. Devolve o estado sem gravar
    // histórico de uma mudança que não houve.
    return atual
  }

  const seloAntes = seloDe(atual)

  return prisma.$transaction(async (tx) => {
    const depois = (await tx.departure.update({
      where: { id: departureId },
      data: { availabilityOverride: excecao },
      select: SELECT_VAGAS,
    })) as LinhaDeVagas

    await registrarSelo(tx, departureId, seloAntes, seloDe(depois), motivo ?? null, ctx)

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'departure.disponibilidade',
        entityType: 'Departure',
        entityId: departureId,
        before: { override: atual.availabilityOverride, selo: seloAntes },
        after: { override: excecao, selo: seloDe(depois), motivo: motivo ?? null },
        ip: ctx.ip,
      },
      tx,
    )

    return depois
  })
}

/**
 * O FECHAMENTO, depois de a saída acontecer.
 *
 * Receita e custo são LANÇADOS, nunca calculados de `preço × pessoas`. Essa
 * conta está errada em quase toda saída real — desconto, cortesia, criança,
 * guia convidado, pagamento parcial — e calculada ela produz um relatório de
 * lucro bonito e falso, do tipo que alguém usa para decidir preço.
 *
 * `closedAt` é o que tira a saída da fila "por fechar" do painel. A fila é uma
 * busca que precisa voltar vazia, não um botão que alguém lembra de apertar.
 */
export async function fecharSaida(
  departureId: number,
  entrada: {
    attendeeCount: number
    revenueCents: number | null
    costCents: number | null
    closingNotes?: string | null
  },
  ctx: Contexto,
): Promise<{ id: number; closedAt: Date | null }> {
  const atual = await prisma.departure.findUnique({
    where: { id: departureId },
    select: { id: true, closedAt: true, startAt: true },
  })

  if (!atual) {
    throw new AppError(ErrorCode.DEPARTURE_NOT_FOUND, 'Saída não encontrada.', { status: 404 })
  }

  // Fechar uma saída que ainda não aconteceu não é erro de digitação: é o
  // relatório do mês nascendo com uma viagem que não saiu. O guard é aqui e
  // não na tela porque a tela não é a única porta.
  if (atual.startAt > new Date()) {
    throw new AppError(
      ErrorCode.CONFLICT,
      'Esta saída ainda não aconteceu. Só dá para fechar depois da data.',
      { status: 409 },
    )
  }

  return prisma.$transaction(async (tx) => {
    const fechada = await tx.departure.update({
      where: { id: departureId },
      data: {
        closedAt: new Date(),
        attendeeCount: entrada.attendeeCount,
        revenueCents: entrada.revenueCents,
        costCents: entrada.costCents,
        closingNotes: entrada.closingNotes ?? null,
      },
      select: { id: true, closedAt: true },
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: atual.closedAt ? 'departure.refechar' : 'departure.fechar',
        entityType: 'Departure',
        entityId: departureId,
        before: { closedAt: atual.closedAt },
        after: {
          closedAt: fechada.closedAt,
          attendeeCount: entrada.attendeeCount,
          revenueCents: entrada.revenueCents,
          costCents: entrada.costCents,
        },
        ip: ctx.ip,
      },
      tx,
    )

    return fechada
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
    /**
     * O recado interno da saída. NUNCA sai em rota pública: `SELECT_DEPARTURE_PUBLICA`
     * não o inclui, e `api.test.ts` procura a string do fixture em toda resposta.
     *
     * Ele era gravável só na CRIAÇÃO: o POST aceitava o campo, o PATCH não, e
     * nenhuma tela o mostrava. Uma nota escrita ali era imutável e invisível
     * para sempre, o que é a mesma coisa que não existir.
     */
    internalNotes?: string | null
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

// ─────────────────────────────────────────────────────────────────────────────
// EXCLUIR — apagar de vez uma saída já encerrada ou cancelada
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exclui uma saída do banco, de verdade.
 *
 * A regra do projeto é soft delete — nada some — e ela vale para Trip, Product
 * e Guide, que têm vitrine e histórico vivo. A saída é o caso diferente: depois
 * que passou, é uma linha de calendário que já cumpriu o papel, e o dono quer
 * poder limpar a lista. Então o excluir existe, mas CERCADO em três pontos:
 *
 *  1. Só o OWNER (a rota aplica): destruir é decisão de dono, não de rotina.
 *  2. Só saída JÁ ENCERRADA (passou) ou CANCELADA — validado aqui, no servidor,
 *     não só na UI. Saída futura no ar NÃO se apaga: cancela primeiro. Isso
 *     fecha o acidente de tirar do site uma data que alguém ainda ia reservar.
 *  3. A auditoria grava o retrato ANTES de apagar, na mesma transação — então
 *     "quem apagou o quê, e quando" sobrevive à exclusão. O que o CASCADE leva
 *     junto (o histórico de disponibilidade daquela saída) é registro de uma
 *     data que deixou de existir.
 */
export async function excluirSaida(departureId: number, ctx: Contexto): Promise<{ id: number }> {
  const atual = await prisma.departure.findUnique({
    where: { id: departureId },
    select: {
      id: true,
      tripId: true,
      startAt: true,
      status: true,
      priceCents: true,
      capacity: true,
      seatsTaken: true,
      availabilityOverride: true,
      meetingPoint: true,
    },
  })

  if (!atual) {
    throw new AppError(ErrorCode.DEPARTURE_NOT_FOUND, 'Saída não encontrada.', { status: 404 })
  }

  const jaPassou = atual.startAt.getTime() < Date.now()
  if (!jaPassou && atual.status !== 'CANCELLED') {
    throw new AppError(
      ErrorCode.CONFLICT,
      'Só dá para excluir saída que já aconteceu ou foi cancelada. Cancele a saída antes.',
      { status: 409 },
    )
  }

  return prisma.$transaction(async (tx) => {
    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'departure.delete',
        entityType: 'Departure',
        entityId: departureId,
        before: {
          tripId: atual.tripId,
          startAt: atual.startAt,
          status: atual.status,
          priceCents: atual.priceCents,
          capacity: atual.capacity,
          seatsTaken: atual.seatsTaken,
          availabilityOverride: atual.availabilityOverride,
          meetingPoint: atual.meetingPoint,
        },
        ip: ctx.ip,
      },
      tx,
    )

    await tx.departure.delete({ where: { id: departureId } })

    return { id: departureId }
  })
}

/** Cria uma saída a partir de um roteiro, herdando o preço como sugestão. */
export async function criarSaida(
  dados: {
    tripId: number
    startAt: Date
    priceCents: number
    compareAtPriceCents?: number | null
    // `| null` porque é o que o formulário manda com o campo em branco, e o
    // que a coluna opcional guarda. O tipo estreito escondia a divergência com
    // o schema da rota, que respondia 400 em toda criação sem ponto de
    // encontro. Ver o cabeçalho do schema em `api/admin/departures/route.ts`.
    meetingPoint?: string | null | undefined
    meetingTimeLocal?: string | null | undefined
    meetingLat?: number | null
    meetingLng?: number | null
    internalNotes?: string | null | undefined
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
