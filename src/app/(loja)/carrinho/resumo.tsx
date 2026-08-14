'use client'

import { ConteudoDaMochila } from '@/components/carrinho/conteudo'

/**
 * A mochila em página.
 *
 * O corpo é o mesmo do drawer — ver `components/carrinho/conteudo.tsx`. O que
 * a página tem e o drawer não é URL: dá para recarregar, compartilhar e chegar
 * de fora. É por isso que ela continua existindo mesmo com o atalho lateral.
 *
 * `robots: noindex` está na página, não aqui: mochila é estado de uma pessoa,
 * não conteúdo de catálogo.
 */
export function ResumoDaMochila() {
  return <ConteudoDaMochila />
}
