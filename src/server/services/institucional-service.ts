import { prisma } from '@/lib/prisma'
import { paraMediaDTO, type GuiaDTO } from '@/server/dto/public-dto'
import { SELECT_GUIA } from '@/server/services/selects'

export type SettingsDTO = {
  whatsappNumber: string
  /** Template com placeholders, editável no CRM. Nunca hardcoded no front. */
  whatsappMessageTemplate: string
  instagramTrekking: string | null
  instagramWear: string | null
  linktree: string | null
  email: string | null
  cadastur: string | null
  pesm: string | null
  heroTitulo: string | null
  heroSubtitulo: string | null
  sobre: string | null
}

/**
 * Configurações públicas do site.
 *
 * O `whatsappMessageTemplate` vem daqui, e não do bundle do front. É o que
 * permite à Caqui ajustar a primeira frase da negociação sem deploy — no
 * projeto de referência, trocar o número de WhatsApp exigia editar 4 arquivos
 * e publicar, e um deles estava dentro de uma URL percent-encoded escrita à
 * mão, praticamente garantindo o esquecimento.
 */
export async function buscarSettings(): Promise<SettingsDTO | null> {
  const s = await prisma.siteSetting.findUnique({
    where: { id: 1 },
    select: {
      whatsappNumber: true,
      whatsappMessageTemplate: true,
      instagramTrekking: true,
      instagramWear: true,
      linktree: true,
      email: true,
      cadasturNumber: true,
      pesmCredentials: true,
      heroTitle: true,
      heroSubtitle: true,
      aboutText: true,
    },
  })

  if (!s) return null

  return {
    whatsappNumber: s.whatsappNumber,
    whatsappMessageTemplate: s.whatsappMessageTemplate,
    instagramTrekking: s.instagramTrekking,
    instagramWear: s.instagramWear,
    linktree: s.linktree,
    email: s.email,
    cadastur: s.cadasturNumber,
    pesm: s.pesmCredentials,
    heroTitulo: s.heroTitle,
    heroSubtitulo: s.heroSubtitle,
    sobre: s.aboutText,
  }
}

export async function listarGuias(): Promise<GuiaDTO[]> {
  const guias = await prisma.guide.findMany({
    where: { active: true, deletedAt: null },
    select: SELECT_GUIA,
    orderBy: { sortOrder: 'asc' },
  })

  return guias.map((g) => ({
    id: g.id,
    nome: g.name,
    bio: g.bio,
    cadastur: g.cadasturNumber,
    pesm: g.pesmCredential,
    fotos: g.photos.map(paraMediaDTO),
  }))
}
