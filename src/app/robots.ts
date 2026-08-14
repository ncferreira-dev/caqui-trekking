import type { MetadataRoute } from 'next'

import { absoluto, URL_BASE } from '@/lib/seo/site'

/**
 * O robots.txt.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUE ESTÁ BLOQUEADO, E POR QUE NÃO É "SEGURANÇA"
 * ────────────────────────────────────────────────────────────────────────────
 * `/crm` e `/api` saem do índice porque não são conteúdo público — um resultado
 * de busca para "painel caqui trekking" não ajuda ninguém e só expõe a
 * existência da área. Mas isto é ETIQUETA, não trava: robots.txt é uma
 * sugestão que rastreador educado respeita e rastreador malicioso ignora. Quem
 * barra o acesso de verdade é o guard do backend, rota a rota.
 *
 * É o oposto exato do projeto de referência, que LISTAVA `/login`, `/dashboard`
 * e `/admin/` no robots.txt — entregando o mapa da área administrativa a
 * qualquer um que abrisse o arquivo. Aqui o `Disallow` é por prefixo, sem
 * enumerar as rotas internas.
 *
 * `/carrinho` também sai: é uma tela de estado do navegador, sem conteúdo
 * indexável, e uma URL de carrinho no Google só gera resultado morto.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/crm', '/api/', '/carrinho'],
    },
    sitemap: absoluto('/sitemap.xml'),
    host: URL_BASE,
  }
}
