import { AppError, ErrorCode } from '@/lib/api/errors'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/server/services/audit-service'
import { gravarSaida, type DadosDaSaida } from '@/server/services/admin/departure-admin-service'
import { slugUnico } from '@/lib/slug'

/** A primeira data, quando ela vem junto do roteiro. Sem `tripId`: o roteiro
 *  ainda não existe no momento em que o formulário é preenchido. */
type DadosDaPrimeiraSaida = Omit<DadosDaSaida, 'tripId'>

/**
 * Mutações de conteúdo: Trip, Product, ProductVariant e SiteSetting.
 *
 * Toda função aqui grava AuditLog com before/after, na mesma transação da
 * escrita. Sem exceção — é requisito do projeto, e o valor prático aparece
 * quando alguém pergunta "quem mudou o preço desta expedição, e quando?".
 */

type Contexto = { userId: number; ip: string | null }

// ─── Trip ────────────────────────────────────────────────────────────────────

export type CamposTrip = {
  title?: string
  subtitle?: string | null
  description?: string
  city?: string
  state?: string
  region?: string | null
  difficulty?: 'FACIL' | 'MODERADO' | 'DIFICIL' | 'EXTREMO'
  distanceKm?: string | null
  elevationGainM?: number | null
  maxAltitudeM?: number | null
  durationMinutes?: number | null
  minAge?: number | null
  requiresExperience?: boolean
  highlights?: string[]
  included?: string[]
  notIncluded?: string[]
  whatToBring?: string[]
  cancellationPolicy?: string | null
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  featured?: boolean
  sortOrder?: number
}

/**
 * Cria um roteiro.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O CRM PASSOU DOIS MESES SEM ISTO, E ERA O GARGALO
 * ════════════════════════════════════════════════════════════════════════════
 * Até 18/08/2026 `/api/admin/trips` tinha apenas GET. Dava para editar,
 * publicar, destacar e arquivar roteiro, e não dava para criar nenhum: os cinco
 * que existiam vieram do seed.
 *
 * `Trip` é a entidade central do sistema. Saída, mídia, tag e mensagem penduram
 * nela. Sem criar roteiro, o CRM não atendia o primeiro roteiro novo que a
 * Caqui abrisse, e a única saída seria escrever no banco à mão.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * O SLUG NASCE AQUI E NÃO MUDA NUNCA MAIS
 * ════════════════════════════════════════════════════════════════════════════
 * Ele é gerado UMA vez, na criação, e depois só muda se alguém editar de
 * propósito. Nunca é derivado do título em tempo de render: renomear o roteiro
 * mudaria a URL canônica em silêncio, quebrando o link já mandado no WhatsApp e
 * zerando o ranking de busca.
 *
 * A unicidade é conferida contra TODOS os slugs, inclusive os arquivados:
 * reaproveitar o slug de um roteiro descontinuado roubaria a URL que ele ainda
 * pode ter em links antigos.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * NASCE EM RASCUNHO, SEMPRE
 * ════════════════════════════════════════════════════════════════════════════
 * Um roteiro recém-criado não tem foto, não tem saída marcada e provavelmente
 * tem a descrição pela metade. Publicar por padrão colocaria isso na vitrine no
 * instante em que alguém clica em "salvar". Publicar é um segundo gesto, e
 * `atualizarTrip` já sabe fazê-lo.
 */
export async function criarTrip(
  campos: CamposTrip & {
    title: string
    description: string
    city: string
    state: string
    /**
     * A ESTREIA DA TRILHA, opcional.
     *
     * ────────────────────────────────────────────────────────────────────────
     * POR QUE ROTEIRO E DATA NASCEM JUNTOS
     * ────────────────────────────────────────────────────────────────────────
     * Pedido do cliente em 20/08/2026, e o argumento dele é melhor que o meu:
     * no site o cliente final não vê "roteiros" e "saídas" em lugares
     * separados. Ele abre a página da trilha e escolhe uma data ali mesmo. A
     * divisão que existia no CRM era a divisão do BANCO, não a de quem usa.
     *
     * O efeito colateral importa mais que a comodidade: hoje três dos cinco
     * roteiros estão publicados sem nenhuma data futura, e o site os mostra
     * como "sob consulta". Cadastrar os dois no mesmo gesto ataca isso na
     * origem, em vez de avisar depois que já aconteceu.
     *
     * OPCIONAL de propósito. "Sob consulta" é estado legítimo do site, e às
     * vezes o texto da trilha é escrito antes de a data fechar com o guia.
     * Exigir a data faria a pessoa inventar uma para conseguir salvar, e data
     * inventada vira agenda errada.
     */
    primeiraSaida?: DadosDaPrimeiraSaida | null | undefined
  },
  ctx: Contexto,
): Promise<{ id: number; slug: string; saidaId: number | null }> {
  const usados = await prisma.trip.findMany({ select: { slug: true } })
  const slug = slugUnico(
    campos.title,
    usados.map((t) => t.slug),
  )

  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.create({
      data: {
        slug,
        title: campos.title,
        subtitle: campos.subtitle ?? null,
        description: campos.description,
        city: campos.city,
        state: campos.state,
        region: campos.region ?? null,
        difficulty: campos.difficulty ?? 'MODERADO',
        distanceKm: campos.distanceKm ?? null,
        elevationGainM: campos.elevationGainM ?? null,
        maxAltitudeM: campos.maxAltitudeM ?? null,
        durationMinutes: campos.durationMinutes ?? null,
        minAge: campos.minAge ?? null,
        requiresExperience: campos.requiresExperience ?? false,
        highlights: campos.highlights ?? [],
        included: campos.included ?? [],
        notIncluded: campos.notIncluded ?? [],
        whatToBring: campos.whatToBring ?? [],
        cancellationPolicy: campos.cancellationPolicy ?? null,
        // Rascunho, sempre. Ver o bloco acima.
        status: 'DRAFT',
        featured: false,
      },
      select: { id: true, slug: true },
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'trip.create',
        entityType: 'Trip',
        entityId: trip.id,
        after: { slug, titulo: campos.title, cidade: campos.city, estado: campos.state },
        ip: ctx.ip,
      },
      tx,
    )

    // A data entra na MESMA transação, e é o ponto todo: se ela falhar, o
    // roteiro não fica salvo pela metade com a impressão de que deu certo. Ou
    // nascem os dois, ou não nasce nenhum.
    //
    // `gravarSaida` recebe o `tx` justamente por isso — `criarSaida` abre a
    // própria transação e o Prisma não aninha. Ver o comentário lá.
    const saida = campos.primeiraSaida
      ? await gravarSaida(tx, { ...campos.primeiraSaida, tripId: trip.id }, ctx)
      : null

    return { ...trip, saidaId: saida?.id ?? null }
  })
}

export async function atualizarTrip(
  tripId: number,
  /**
   * `activityTagIds` vem SEPARADO dos campos escalares de propósito: ele não é
   * uma coluna de `Trip`, é a tabela de ligação `TripActivityTag`. Misturá-lo
   * em `campos` faria o `tx.trip.update({ data: campos })` receber uma chave
   * que o Prisma não conhece, e o erro só apareceria em runtime.
   */
  campos: CamposTrip & { activityTagIds?: number[] },
  ctx: Contexto,
): Promise<{ id: number }> {
  const { activityTagIds, ...colunas } = campos

  const antes = await prisma.trip.findFirst({
    where: { id: tripId, deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      difficulty: true,
      featured: true,
      sortOrder: true,
      activityTags: { select: { activityTagId: true } },
    },
  })

  if (!antes) {
    throw new AppError(ErrorCode.TRIP_NOT_FOUND, 'Roteiro não encontrado.', { status: 404 })
  }

  // ── As atividades pedidas precisam EXISTIR ────────────────────────────
  // Conferido ANTES da primeira escrita, e não descoberto no meio: um id
  // inválido no meio da lista deixaria o roteiro com metade das atividades
  // trocadas e a outra metade não. Um `createMany` com chave estrangeira
  // quebrada aborta a transação, mas a mensagem que chega na tela seria a do
  // banco, e não "esta atividade não existe".
  const desejadas = activityTagIds ? [...new Set(activityTagIds)] : null

  if (desejadas && desejadas.length > 0) {
    const encontradas = await prisma.activityTag.count({ where: { id: { in: desejadas } } })
    if (encontradas !== desejadas.length) {
      throw new AppError(ErrorCode.TAG_NOT_FOUND, 'Alguma atividade escolhida não existe.', {
        status: 404,
      })
    }
  }

  return prisma.$transaction(async (tx) => {
    const depois = await tx.trip.update({
      where: { id: tripId },
      data: colunas,
      select: {
        id: true,
        title: true,
        status: true,
        difficulty: true,
        featured: true,
        sortOrder: true,
      },
    })

    if (desejadas) {
      // Substituição inteira: apaga e recria. Com no máximo 20 linhas por
      // roteiro, calcular o delta custaria mais código do que economiza
      // escrita, e o "apaga tudo" é o que garante que o estado final é
      // exatamente o que o formulário mostrava.
      await tx.tripActivityTag.deleteMany({ where: { tripId } })
      if (desejadas.length > 0) {
        await tx.tripActivityTag.createMany({
          data: desejadas.map((activityTagId) => ({ tripId, activityTagId })),
        })
      }
    }

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'trip.update',
        entityType: 'Trip',
        entityId: tripId,
        before: { ...antes, activityTags: antes.activityTags.map((t) => t.activityTagId) },
        after: desejadas ? { ...depois, activityTags: desejadas } : depois,
        ip: ctx.ip,
      },
      tx,
    )

    return { id: depois.id }
  })
}

/**
 * Soft delete. Nunca hard delete.
 *
 * Uma Trip descontinuada é arquivada, não apagada — senão as saídas dela ficam
 * órfãs, exatamente como o projeto de referência produzia ao apagar um produto
 * e deixar movimentações apontando para um id inexistente.
 */
export async function arquivarTrip(tripId: number, ctx: Contexto): Promise<{ id: number }> {
  const antes = await prisma.trip.findFirst({
    where: { id: tripId, deletedAt: null },
    select: { id: true, status: true },
  })

  if (!antes) {
    throw new AppError(ErrorCode.TRIP_NOT_FOUND, 'Roteiro não encontrado.', { status: 404 })
  }

  return prisma.$transaction(async (tx) => {
    const depois = await tx.trip.update({
      where: { id: tripId },
      data: { status: 'ARCHIVED', deletedAt: new Date() },
      select: { id: true },
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'trip.archive',
        entityType: 'Trip',
        entityId: tripId,
        before: antes,
        after: { status: 'ARCHIVED', arquivada: true },
        ip: ctx.ip,
      },
      tx,
    )

    return depois
  })
}

// ─── ProductVariant ──────────────────────────────────────────────────────────

/**
 * Liga/desliga a disponibilidade de uma combinação tamanho+cor.
 *
 * Toggle rápido, endpoint dedicado — mesma lógica do `availability` da saída.
 * NÃO existe quantidade: `available` é um booleano manual, e o briefing é
 * explícito sobre não inventar controle de estoque.
 */
export async function alternarVariante(
  variantId: number,
  disponivel: boolean,
  ctx: Contexto,
): Promise<{ id: number; disponivel: boolean }> {
  const antes = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, available: true, size: true, colorName: true, productId: true },
  })

  if (!antes) {
    throw new AppError(ErrorCode.VARIANT_NOT_FOUND, 'Variante não encontrada.', { status: 404 })
  }

  return prisma.$transaction(async (tx) => {
    const depois = await tx.productVariant.update({
      where: { id: variantId },
      data: { available: disponivel },
      select: { id: true, available: true },
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'variant.toggle',
        entityType: 'ProductVariant',
        entityId: variantId,
        before: { available: antes.available },
        after: { available: disponivel, tamanho: antes.size, cor: antes.colorName },
        ip: ctx.ip,
      },
      tx,
    )

    return { id: depois.id, disponivel: depois.available }
  })
}

// ─── SiteSetting ─────────────────────────────────────────────────────────────

export type CamposSettings = {
  whatsappNumber?: string
  whatsappMessageTemplate?: string
  instagramTrekking?: string | null
  instagramWear?: string | null
  linktree?: string | null
  email?: string | null
  cadasturNumber?: string | null
  pesmCredentials?: string | null
  heroTitle?: string | null
  heroSubtitle?: string | null
  aboutText?: string | null
}

/**
 * Placeholders que o template da mensagem do WhatsApp reconhece.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * `{{cliente}}` SAIU DAQUI EM 18/08/2026, E NÃO DEVE VOLTAR SEM O DADO
 * ────────────────────────────────────────────────────────────────────────────
 * Ele estava na lista, o editor do CRM o oferecia como opção clicável, e
 * `montarMensagem` nunca o substituía. O motivo é estrutural, não
 * esquecimento: o nome do cliente NÃO EXISTE em lugar nenhum deste fluxo. O
 * site não pede nome, a mochila não tem cadastro, e o primeiro contato É a
 * mensagem do WhatsApp — o nome chega depois dela, não antes.
 *
 * Ou seja: bastava a Caqui aceitar o convite do próprio painel para toda
 * mensagem do site sair com "Olá {{cliente}}" escrito literalmente.
 *
 * Se um dia a mochila passar a pedir o nome antes do handoff, ele volta para
 * cá NO MESMO commit em que `montarMensagem` aprender a substituí-lo.
 */
export const PLACEHOLDERS_VALIDOS = ['{{itens}}', '{{total}}'] as const

/**
 * Valida os placeholders do template.
 *
 * Um `{{iten}}` com erro de digitação sairia literal na mensagem enviada ao
 * cliente. Melhor recusar no CRM, com a lista do que é válido, do que
 * descobrir pelo WhatsApp de alguém.
 */
export function validarTemplate(template: string): string[] {
  const encontrados = template.match(/\{\{[^}]*\}\}/g) ?? []
  return encontrados.filter((p) => !PLACEHOLDERS_VALIDOS.includes(p as never))
}

export async function atualizarSettings(
  campos: CamposSettings,
  ctx: Contexto,
): Promise<{ id: number }> {
  if (campos.whatsappMessageTemplate) {
    const invalidos = validarTemplate(campos.whatsappMessageTemplate)
    if (invalidos.length > 0) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        `Placeholder desconhecido: ${invalidos.join(', ')}. Válidos: ${PLACEHOLDERS_VALIDOS.join(', ')}.`,
        { status: 400 },
      )
    }
  }

  const antes = await prisma.siteSetting.findUnique({ where: { id: 1 } })

  return prisma.$transaction(async (tx) => {
    const depois = await tx.siteSetting.update({
      where: { id: 1 },
      data: campos,
      select: { id: true },
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'settings.update',
        entityType: 'SiteSetting',
        entityId: 1,
        before: antes,
        after: campos,
        ip: ctx.ip,
      },
      tx,
    )

    return depois
  })
}
