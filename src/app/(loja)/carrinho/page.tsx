import type { Metadata } from 'next'

import { CabecalhoDePagina } from '@/components/shell/cabecalho-de-pagina'

import { ResumoDaMochila } from './resumo'

export const metadata: Metadata = {
  title: 'Sua mochila',
  description: 'Os itens que você separou. O pedido é fechado no WhatsApp.',
  robots: { index: false, follow: true },
}

/**
 * A mochila.
 *
 * A revalidação contra o servidor, a edição de quantidade e o handoff para o
 * WhatsApp são o PROMPT 09. O que está aqui é o que o carrinho já guarda de
 * verdade — e a frase que precisa aparecer desde já, porque é a regra de
 * negócio que molda a página inteira: **o pagamento não acontece aqui.**
 */
export default function PaginaCarrinho() {
  return (
    <>
      <CabecalhoDePagina
        sobretitulo="Seu pedido"
        titulo="Sua mochila"
        descricao="O site não processa pagamento. Você monta o pedido aqui e fecha na conversa do WhatsApp, com um guia."
      />

      <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8">
        <ResumoDaMochila />
      </div>
    </>
  )
}
