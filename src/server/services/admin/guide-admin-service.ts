import { AppError, ErrorCode } from '@/lib/api/errors'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/server/services/audit-service'

/**
 * Os guias, no painel.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * NÃO EXISTIA ROTA NENHUMA. O QUE ESTÁ NO SITE VEIO DO SEED
 * ────────────────────────────────────────────────────────────────────────────
 * `Guide` tinha só `GET /api/guides`, público. Nome, Cadastur e credencial do
 * PESM eram imutáveis pelo painel — e são exatamente os dados que o site
 * publica como prova de que a operação é regular. Trocar de guia, corrigir um
 * número de Cadastur ou tirar do ar quem saiu da equipe exigia escrever no
 * banco à mão.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * "DESATIVAR" E "ARQUIVAR" SÃO COISAS DIFERENTES, E AS DUAS EXISTEM
 * ────────────────────────────────────────────────────────────────────────────
 *  • `active: false` é o guia que continua na equipe e não aparece agora:
 *    licença, período fora, ainda sem foto. Reversível em um clique.
 *  • `deletedAt` é a saída definitiva. Continua sendo SOFT DELETE porque as
 *    saídas passadas apontam para ele: apagar de verdade deixaria o histórico
 *    com guia inexistente, que é o defeito que o projeto de referência
 *    produzia ao apagar produto com movimentação apontando para ele.
 *
 * Os dois somem do site pelo mesmo filtro, `WHERE_GUIA_PUBLICA`
 * (`{ active: true, deletedAt: null }`), que já existia e já é aplicado nas
 * saídas. Ver `selects.ts`.
 */

/** Igual aos outros serviços de admin: quem fez, e de onde. */
type Contexto = { userId: number; ip: string | null }

export type GuiaAdminDTO = {
  id: number
  nome: string
  bio: string | null
  cadastur: string | null
  pesm: string | null
  ativo: boolean
  ordem: number
  /** Em quantas saídas ele está escalado. Decide se o arquivar assusta. */
  saidas: number
}

const CAMPOS = {
  id: true,
  name: true,
  bio: true,
  cadasturNumber: true,
  pesmCredential: true,
  active: true,
  sortOrder: true,
  _count: { select: { departures: true } },
} as const

type Linha = {
  id: number
  name: string
  bio: string | null
  cadasturNumber: string | null
  pesmCredential: string | null
  active: boolean
  sortOrder: number
  _count: { departures: number }
}

function paraDTO(g: Linha): GuiaAdminDTO {
  return {
    id: g.id,
    nome: g.name,
    bio: g.bio,
    cadastur: g.cadasturNumber,
    pesm: g.pesmCredential,
    ativo: g.active,
    ordem: g.sortOrder,
    saidas: g._count.departures,
  }
}

export type CamposGuia = {
  nome?: string
  bio?: string | null
  cadastur?: string | null
  pesm?: string | null
  ativo?: boolean
  ordem?: number
}

/** O arquivado não volta na listagem: para ele, o caminho de volta é o banco. */
export async function listarGuias(): Promise<GuiaAdminDTO[]> {
  const linhas = await prisma.guide.findMany({
    where: { deletedAt: null },
    select: CAMPOS,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return linhas.map(paraDTO)
}

export async function criarGuia(
  dados: CamposGuia & { nome: string },
  ctx: Contexto,
): Promise<GuiaAdminDTO> {
  // A ordem padrão põe o novo no FIM, e não em zero. Zero o jogaria para o
  // topo da página "Quem guia" na frente de quem já está lá, sem ninguém pedir.
  const ultimo = await prisma.guide.findFirst({
    where: { deletedAt: null },
    select: { sortOrder: true },
    orderBy: { sortOrder: 'desc' },
  })

  return prisma.$transaction(async (tx) => {
    const guia = await tx.guide.create({
      data: {
        name: dados.nome,
        bio: dados.bio ?? null,
        cadasturNumber: dados.cadastur ?? null,
        pesmCredential: dados.pesm ?? null,
        active: dados.ativo ?? true,
        sortOrder: dados.ordem ?? (ultimo ? ultimo.sortOrder + 1 : 0),
      },
      select: CAMPOS,
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'guide.create',
        entityType: 'Guide',
        entityId: guia.id,
        after: { nome: guia.name, cadastur: guia.cadasturNumber },
        ip: ctx.ip,
      },
      tx,
    )

    return paraDTO(guia)
  })
}

export async function atualizarGuia(
  guideId: number,
  dados: CamposGuia,
  ctx: Contexto,
): Promise<GuiaAdminDTO> {
  const antes = await prisma.guide.findFirst({
    where: { id: guideId, deletedAt: null },
    select: CAMPOS,
  })
  if (!antes) throw new AppError(ErrorCode.GUIDE_NOT_FOUND, 'Guia não encontrado.', { status: 404 })

  return prisma.$transaction(async (tx) => {
    const depois = await tx.guide.update({
      where: { id: guideId },
      data: {
        ...(dados.nome !== undefined ? { name: dados.nome } : {}),
        ...(dados.bio !== undefined ? { bio: dados.bio } : {}),
        ...(dados.cadastur !== undefined ? { cadasturNumber: dados.cadastur } : {}),
        ...(dados.pesm !== undefined ? { pesmCredential: dados.pesm } : {}),
        ...(dados.ativo !== undefined ? { active: dados.ativo } : {}),
        ...(dados.ordem !== undefined ? { sortOrder: dados.ordem } : {}),
      },
      select: CAMPOS,
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'guide.update',
        entityType: 'Guide',
        entityId: guideId,
        before: { nome: antes.name, ativo: antes.active, cadastur: antes.cadasturNumber },
        after: { nome: depois.name, ativo: depois.active, cadastur: depois.cadasturNumber },
        ip: ctx.ip,
      },
      tx,
    )

    return paraDTO(depois)
  })
}

/**
 * Arquivar. NUNCA `delete`.
 *
 * As saídas já realizadas guardam quem guiou, e é essa a prova de que a trilha
 * teve guia credenciado. Um `DELETE` de verdade levaria junto as linhas de
 * `DepartureGuide` por cascade e reescreveria o passado.
 */
export async function arquivarGuia(guideId: number, ctx: Contexto): Promise<{ id: number }> {
  const guia = await prisma.guide.findFirst({
    where: { id: guideId, deletedAt: null },
    select: { id: true, name: true },
  })
  if (!guia) throw new AppError(ErrorCode.GUIDE_NOT_FOUND, 'Guia não encontrado.', { status: 404 })

  return prisma.$transaction(async (tx) => {
    await tx.guide.update({
      where: { id: guideId },
      // `active: false` junto: o filtro público olha os dois, e deixar
      // `active` verdadeiro num registro arquivado é um estado que não
      // significa nada e confunde quem lê o banco.
      data: { deletedAt: new Date(), active: false },
    })

    await registrarAuditoria(
      {
        userId: ctx.userId,
        action: 'guide.archive',
        entityType: 'Guide',
        entityId: guideId,
        before: { nome: guia.name },
        ip: ctx.ip,
      },
      tx,
    )

    return { id: guideId }
  })
}
