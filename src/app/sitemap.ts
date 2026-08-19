import type { MetadataRoute } from 'next'

import { prisma } from '@/lib/prisma'
import { absoluto } from '@/lib/seo/site'

// Dinâmico pela mesma razão das páginas do catálogo: roteiro e peça entram e
// saem pelo CRM, sem deploy. Um sitemap estático, prerenderizado no build,
// apontaria para o estado congelado daquele momento — 404 no que foi arquivado,
// e invisível o que foi cadastrado depois.
export const dynamic = 'force-dynamic'

/**
 * O sitemap.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ELE É DINÂMICO PORQUE O CATÁLOGO MUDA SEM DEPLOY
 * ────────────────────────────────────────────────────────────────────────────
 * Roteiro novo, peça nova, roteiro arquivado — tudo isso acontece pelo CRM, sem
 * publicar código. Um sitemap estático escrito à mão envelheceria no primeiro
 * cadastro: apontaria para uma peça que saiu do ar (404 no índice do Google) e
 * ignoraria a que entrou. Então ele lê o banco, e só lista o que a rota pública
 * mostraria: publicado e não arquivado.
 *
 * O `lastModified` vem do `updatedAt` real de cada registro. Não é enfeite: é o
 * que diz ao Google o que vale revisitar, e mentir nele (usar `new Date()` para
 * tudo) treina o rastreador a ignorar o campo.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * `changeFrequency` E `priority` DIZEM A VERDADE DA OPERAÇÃO
 * ────────────────────────────────────────────────────────────────────────────
 * A agenda muda toda semana e é a página que fecha venda: `weekly`, prioridade
 * alta. Os roteiros mudam por temporada. As páginas institucionais quase nunca
 * mudam. O rastreador usa isso como pista de orçamento; valores inflados (tudo
 * `always`/`1.0`) são ignorados porque nenhum site é todo importante igual.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [roteiros, produtos] = await Promise.all([
    prisma.trip.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.product.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ])

  const agora = new Date()

  const fixas: MetadataRoute.Sitemap = [
    { url: absoluto('/'), lastModified: agora, changeFrequency: 'weekly', priority: 1 },
    { url: absoluto('/agenda'), lastModified: agora, changeFrequency: 'weekly', priority: 0.9 },
    { url: absoluto('/trekking'), lastModified: agora, changeFrequency: 'weekly', priority: 0.8 },
    // Prioridade alta: é página de conversão, e o termo "guia particular" é o
    // que a Caqui quer disputar. Acima da Wear, abaixo da agenda.
    {
      url: absoluto('/guia-particular'),
      lastModified: agora,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    { url: absoluto('/wear'), lastModified: agora, changeFrequency: 'monthly', priority: 0.6 },
    { url: absoluto('/sobre'), lastModified: agora, changeFrequency: 'yearly', priority: 0.4 },
    { url: absoluto('/contato'), lastModified: agora, changeFrequency: 'yearly', priority: 0.4 },
  ]

  const roteiroUrls: MetadataRoute.Sitemap = roteiros.map((t) => ({
    url: absoluto(`/trekking/${t.slug}`),
    lastModified: t.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const produtoUrls: MetadataRoute.Sitemap = produtos.map((p) => ({
    url: absoluto(`/wear/${p.slug}`),
    lastModified: p.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.5,
  }))

  return [...fixas, ...roteiroUrls, ...produtoUrls]
}
