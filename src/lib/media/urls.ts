/**
 * Construção das variantes responsivas de entrega.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A DECISÃO: UM ORIGINAL ARMAZENADO, VARIANTES POR URL
 * ────────────────────────────────────────────────────────────────────────────
 * O caminho óbvio seria gerar thumb/card/full no upload e guardar três
 * arquivos. Não fazemos isso, por três motivos:
 *
 *  1. Três arquivos são três coisas para apagar. Todo vazamento de storage que
 *     o projeto de referência acumulou nasceu de "esqueci de apagar" — e ele
 *     tinha UM arquivo por imagem. Ver docs/00-analise-dalia.md, seção 7.6.
 *  2. `f_auto` escolhe o formato pelo `Accept` do navegador. Fixar WebP no
 *     upload congela a decisão no dia do upload; hoje entrega AVIF para quem
 *     aceita, e amanhã entrega o que vier depois, sem reprocessar nada.
 *  3. Mudar a largura de um card vira uma constante neste arquivo, não uma
 *     migração de todas as imagens já enviadas.
 *
 * O banco guarda a URL CANÔNICA, sem transformação. Estas funções injetam a
 * transformação na hora de renderizar. É o único lugar do projeto que sabe o
 * formato de URL do provedor — trocar de provedor é reescrever este arquivo.
 */

/** Larguras oferecidas ao navegador no `srcset`. */
export const LARGURAS_SRCSET = [320, 640, 960, 1280, 1600, 2000] as const

/** Atalhos nomeados, para quando não há `srcset` (og:image, e-mail, feed). */
export const LARGURAS = {
  thumb: 320,
  card: 800,
  full: 1600,
} as const

export type NomeDeVariante = keyof typeof LARGURAS

const MARCADOR = '/image/upload/'

/**
 * `c_limit` é o detalhe que importa: reduz quando a imagem é maior que a
 * largura pedida e NÃO faz nada quando é menor. Sem ele, uma foto de 900px
 * pedida em 1600 seria ampliada — mais bytes para entregar menos nitidez.
 */
function transformacao(largura: number): string {
  return `f_auto,q_auto,c_limit,w_${largura}`
}

/** Um segmento é transformação se não for `v123` e tiver cara de parâmetro. */
function ehTransformacao(segmento: string): boolean {
  if (/^v\d+$/.test(segmento)) return false
  return /^[a-z]{1,2}_/.test(segmento)
}

/**
 * Devolve a URL da imagem na largura pedida.
 *
 * URL que não seja do provedor volta INTACTA — o dublê de teste usa URLs
 * próprias, e uma eventual imagem importada de outro lugar não deve virar um
 * link quebrado só por passar por aqui.
 *
 * É idempotente: aplicar duas vezes substitui a transformação, não empilha.
 */
export function urlVariante(url: string, largura: number): string {
  const inicio = url.indexOf(MARCADOR)
  if (inicio === -1) return url

  const corte = inicio + MARCADOR.length
  const resto = url.slice(corte)
  const primeiroSegmento = resto.slice(0, resto.indexOf('/'))

  const semTransformacao = ehTransformacao(primeiroSegmento)
    ? resto.slice(primeiroSegmento.length + 1)
    : resto

  return `${url.slice(0, corte)}${transformacao(largura)}/${semTransformacao}`
}

/** Atalho nomeado: `urlDe(m.url, 'card')`. */
export function urlDe(url: string, nome: NomeDeVariante): string {
  return urlVariante(url, LARGURAS[nome])
}

/**
 * Monta o `srcset`, sem oferecer largura maior que a imagem real.
 *
 * Oferecer `2000w` para uma foto de 880px faria o navegador escolher um
 * candidato que o `c_limit` devolve em 880px de qualquer jeito — o navegador
 * decidiria com base numa largura que não existe e baixaria a imagem errada
 * para o layout.
 */
export function srcsetDe(url: string, larguraReal: number): string {
  const candidatas = LARGURAS_SRCSET.filter((l) => l < larguraReal)
  const larguras = [...candidatas, larguraReal]

  return larguras.map((l) => `${urlVariante(url, l)} ${l}w`).join(', ')
}
