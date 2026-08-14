import type { Metadata } from 'next'

import { absoluto } from '@/lib/seo/site'

/**
 * O metadata de uma página pública, com canônica e Open Graph.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A CANÔNICA É POR PÁGINA, E ISSO NÃO PODE SER GLOBAL
 * ────────────────────────────────────────────────────────────────────────────
 * A tentação é declarar `alternates.canonical` uma vez no layout. Erro: o
 * layout vale para todas as rotas, então TODA página apontaria a canônica para
 * a mesma URL, e o Google concluiria que o site inteiro é uma página só. A
 * canônica precisa nascer com o caminho de cada página — por isso ela é o
 * argumento obrigatório desta função.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * O QUE VEM DAQUI E O QUE VEM DO LAYOUT
 * ────────────────────────────────────────────────────────────────────────────
 * `siteName`, `locale`, `type` e o cartão do Twitter são iguais em todo lugar e
 * moram no layout raiz, herdados. Aqui entra só o que muda por página: título,
 * descrição, a URL canônica e a `og:url`. Título e descrição do Open Graph o
 * Next preenche a partir de `title`/`description` quando não são passados — daí
 * eles não se repetirem aqui.
 *
 * A imagem do Open Graph (a foto que aparece no card do WhatsApp) entra quando
 * o Cloudinary estiver configurado. Até lá o card sai sem imagem, o que é
 * correto: melhor um card de texto do que um link para uma imagem quebrada.
 */
export function metadataDaPagina({
  titulo,
  descricao,
  caminho,
}: {
  /** Sem o sufixo "· Caqui Trekking" — o template do layout acrescenta. */
  titulo: string
  descricao: string
  /** Caminho absoluto do site, com barra inicial. Ex.: "/agenda". */
  caminho: string
}): Metadata {
  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: caminho },
    openGraph: {
      url: absoluto(caminho),
      title: titulo,
      description: descricao,
    },
  }
}
